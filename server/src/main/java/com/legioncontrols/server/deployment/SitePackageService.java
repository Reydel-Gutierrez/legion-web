package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.enums.Deploymentpackagestatus;
import com.legioncontrols.server.jooq.generated.enums.Deploymentsource;
import com.legioncontrols.server.jooq.generated.tables.records.DeploymentpackagerecordRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteversionRecord;
import com.legioncontrols.server.lspkg.Checksum;
import com.legioncontrols.server.lspkg.Diff;
import com.legioncontrols.server.lspkg.PackageBuilder;
import com.legioncontrols.server.lspkg.Storage;
import com.legioncontrols.server.releases.ReleaseService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

import static com.legioncontrols.server.jooq.generated.tables.Building.BUILDING;
import static com.legioncontrols.server.jooq.generated.tables.Deploymentauditentry.DEPLOYMENTAUDITENTRY;
import static com.legioncontrols.server.jooq.generated.tables.Deploymentpackagerecord.DEPLOYMENTPACKAGERECORD;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;

/**
 * Java port of backend/src/modules/siteVersions/sitePackage.service.js — the Engineering-side
 * package workflow (LC-ARCH-002 §6 "Deployment Semantics"): Validate Project, Build Site Package,
 * Export Site Package. Engineering never activates a package locally — it produces a portable,
 * checksummed {@code .lspkg} and either hands it to the caller (export) or transfers it to a
 * configured LS-100 (direct deploy — see {@link DirectDeployService}), which alone decides
 * whether/when to activate it.
 */
@Service
public class SitePackageService {

    private final DSLContext dsl;
    private final JsonUtil json;
    private final PackageBuilder packageBuilder;
    private final Storage storage;
    private final ReleaseService releaseService;

    public SitePackageService(DSLContext dsl, JsonUtil json, PackageBuilder packageBuilder, Storage storage,
                               ReleaseService releaseService) {
        this.dsl = dsl;
        this.json = json;
        this.packageBuilder = packageBuilder;
        this.storage = storage;
        this.releaseService = releaseService;
    }

    public record ValidationResult(boolean ok, List<String> errors, List<String> warnings) {
    }

    /**
     * Structural validation gate for "Build Site Package must require successful validation"
     * (LC-ARCH-002 §12). Blocking errors mean there is nothing coherent to package; unresolved
     * references (pending point bindings — normal before on-site commissioning) are warnings, not
     * blockers.
     */
    public ValidationResult validateProjectForPackage(String siteId) {
        boolean siteExists = dsl.fetchExists(dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)));
        if (!siteExists) throw ApiException.notFound("Site not found");

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        int buildingCount = dsl.fetchCount(dsl.selectFrom(BUILDING).where(BUILDING.SITEID.eq(siteId)));
        if (buildingCount == 0) errors.add("Site has no buildings — nothing to package.");

        int equipmentCount = dsl.fetchCount(dsl.selectFrom(EQUIPMENT).where(EQUIPMENT.SITEID.eq(siteId)));
        if (equipmentCount == 0) errors.add("Site has no equipment — nothing to package.");

        if (errors.isEmpty()) {
            JsonNode unresolved = buildChangePreviewOnly(siteId).get("unresolved");
            if (unresolved != null && unresolved.isArray()) {
                for (JsonNode item : unresolved) {
                    warnings.add(item.get("collection").asString() + " " + item.get("id").asString() + ": " + item.get("reason").asString());
                }
            }
        }

        return new ValidationResult(errors.isEmpty(), errors, warnings);
    }

    private JsonNode buildChangePreviewOnly(String siteId) {
        SiteversionRecord working = releaseService.syncWorkingPayloadFromDb(siteId);
        JsonNode engineeringPayload = releaseService.payloadFor(working);
        if (engineeringPayload == null) engineeringPayload = json.newObject();
        PackageBuilder.BuiltPackage built = packageBuilder.buildSitePackage(siteId, new PackageBuilder.BuildOptions(
            null, null, null, false, null, null, engineeringPayload, "preview-only" // never persisted; unresolved-reference scan only
        ));
        return Diff.computeChangePreview(java.util.Map.of(), built.files());
    }

    public record BuildResult(DeploymentpackagerecordRecord record, String fileName, ValidationResult validation) {
    }

    /**
     * Build Site Package. Persists a DeploymentPackageRecord on this (Engineering) database purely
     * as the local build/export history — Engineering never activates it locally.
     */
    public BuildResult buildProjectPackage(String siteId, String author, String releaseNotes, String deploymentScope, boolean simulationPackage) {
        ValidationResult validation = validateProjectForPackage(siteId);
        if (!validation.ok()) {
            throw ApiException.unprocessable("Project failed validation: " + String.join("; ", validation.errors()));
        }

        releaseService.getOrCreateWorkingVersion(siteId);
        SiteversionRecord working = releaseService.syncWorkingPayloadFromDb(siteId);
        JsonNode engineeringPayload = releaseService.payloadFor(working);
        if (engineeringPayload == null) engineeringPayload = json.newObject();

        PackageBuilder.BuiltPackage built = packageBuilder.buildSitePackage(siteId, new PackageBuilder.BuildOptions(
            author, releaseNotes, deploymentScope, simulationPackage, null, null, engineeringPayload, null
        ));

        DeploymentpackagerecordRecord record = dsl.newRecord(DEPLOYMENTPACKAGERECORD);
        record.setId(UUID.randomUUID().toString());
        record.setPackageid(built.manifest().get("packageId").asString());
        record.setSiteid(siteId);
        record.setSitename(built.manifest().get("siteName").asString());
        record.setPackageversion(built.manifest().get("projectVersion").asString());
        record.setSchemaversion(built.manifest().get("packageSchemaVersion").asInt());
        record.setStatus(Deploymentpackagestatus.STAGED); // "built, sitting on the Engineering side" — Engineering does not activate
        record.setSource(Deploymentsource.DIRECT);
        record.setChecksumsha256(Checksum.sha256Hex(built.buffer()));
        record.setManifestjson(json.toJsonb(built.manifest()));
        if (built.changePreview() != null) record.setChangepreviewjson(json.toJsonb(built.changePreview()));
        record.setReceivedat(LocalDateTime.now());
        record.setFilepath(""); // set immediately below once we know the record id
        record.insert();
        record.setFilepath(storage.writeStagedPackage(record.getId(), built.buffer()));
        record.update();

        ObjectNode details = json.newObject();
        details.put("fileName", built.fileName());
        var warningsArray = json.newArray();
        validation.warnings().forEach(warningsArray::add);
        details.set("validationWarnings", warningsArray);
        var auditRow = dsl.newRecord(DEPLOYMENTAUDITENTRY);
        auditRow.setId(UUID.randomUUID().toString());
        auditRow.setSiteid(siteId);
        auditRow.setPackagerecordid(record.getId());
        auditRow.setAction("BUILD");
        auditRow.setResult(com.legioncontrols.server.jooq.generated.enums.Deploymentauditresult.SUCCESS);
        auditRow.setActor(author);
        auditRow.setDetailsjson(json.toJsonb(details));
        auditRow.setCreatedat(LocalDateTime.now());
        auditRow.insert();

        return new BuildResult(record, built.fileName(), validation);
    }

    public record BuiltPackageBuffer(byte[] buffer, DeploymentpackagerecordRecord record) {
    }

    public BuiltPackageBuffer getBuiltPackageBuffer(String packageRecordId) {
        DeploymentpackagerecordRecord record = dsl.selectFrom(DEPLOYMENTPACKAGERECORD).where(DEPLOYMENTPACKAGERECORD.ID.eq(packageRecordId)).fetchOne();
        if (record == null) throw ApiException.notFound("Package record not found");
        return new BuiltPackageBuffer(storage.readStagedPackage(record.getFilepath()), record);
    }
}
