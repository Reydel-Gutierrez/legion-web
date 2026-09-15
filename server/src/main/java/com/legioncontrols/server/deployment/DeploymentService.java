package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.enums.Deploymentauditresult;
import com.legioncontrols.server.jooq.generated.enums.Deploymentpackagestatus;
import com.legioncontrols.server.jooq.generated.enums.Deploymentsource;
import com.legioncontrols.server.jooq.generated.enums.Lscommissionstate;
import com.legioncontrols.server.jooq.generated.tables.records.DeploymentauditentryRecord;
import com.legioncontrols.server.jooq.generated.tables.records.DeploymentbackuprecordRecord;
import com.legioncontrols.server.jooq.generated.tables.records.DeploymentpackagerecordRecord;
import com.legioncontrols.server.jooq.generated.tables.records.LscommissioningRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteversionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteversionpayloadRecord;
import com.legioncontrols.server.lspkg.Checksum;
import com.legioncontrols.server.lspkg.Diff;
import com.legioncontrols.server.lspkg.Manifest;
import com.legioncontrols.server.lspkg.Parser;
import com.legioncontrols.server.lspkg.Storage;
import com.legioncontrols.server.lspkg.Zip;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import static com.legioncontrols.server.jooq.generated.tables.Deploymentauditentry.DEPLOYMENTAUDITENTRY;
import static com.legioncontrols.server.jooq.generated.tables.Deploymentbackuprecord.DEPLOYMENTBACKUPRECORD;
import static com.legioncontrols.server.jooq.generated.tables.Deploymentpackagerecord.DEPLOYMENTPACKAGERECORD;
import static com.legioncontrols.server.jooq.generated.tables.Lscommissioning.LSCOMMISSIONING;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static com.legioncontrols.server.jooq.generated.tables.Siteversion.SITEVERSION;
import static com.legioncontrols.server.jooq.generated.tables.Siteversionpayload.SITEVERSIONPAYLOAD;

/**
 * Java port of backend/src/modules/deployment/deployment.service.js — the LS-100 commissioning /
 * deployment pipeline (LC-ARCH-002 §5 state machine, §7 activation/rollback). One pipeline serves
 * both entry methods (LC-ARCH-002 §4/DEP-004): a direct-deploy HTTP POST and an offline-import file
 * upload both end up calling {@link #stagePackage} with the same buffer.
 */
@Service
public class DeploymentService {

    private static final Logger log = LoggerFactory.getLogger(DeploymentService.class);
    private static final String COMMISSIONING_ID = "ls100";

    private final DSLContext dsl;
    private final JsonUtil json;
    private final Parser parser;
    private final Storage storage;
    private final ActivationService activationService;
    private final com.legioncontrols.server.runtime.RuntimeService runtimeService;

    public DeploymentService(DSLContext dsl, JsonUtil json, Parser parser, Storage storage,
                              ActivationService activationService, com.legioncontrols.server.runtime.RuntimeService runtimeService) {
        this.dsl = dsl;
        this.json = json;
        this.parser = parser;
        this.storage = storage;
        this.activationService = activationService;
        this.runtimeService = runtimeService;
    }

    private LscommissioningRecord getCommissioning() {
        LscommissioningRecord existing = dsl.selectFrom(LSCOMMISSIONING).where(LSCOMMISSIONING.ID.eq(COMMISSIONING_ID)).fetchOne();
        if (existing != null) return existing;
        LscommissioningRecord created = dsl.newRecord(LSCOMMISSIONING);
        created.setId(COMMISSIONING_ID);
        created.setState(Lscommissionstate.UNCOMMISSIONED);
        created.setUpdatedat(LocalDateTime.now());
        created.insert();
        return created;
    }

    private void audit(DSLContext ctx, String siteId, String packageRecordId, String action, boolean success, String actor, ObjectNode details) {
        DeploymentauditentryRecord row = ctx.newRecord(DEPLOYMENTAUDITENTRY);
        row.setId(UUID.randomUUID().toString());
        row.setSiteid(siteId);
        row.setPackagerecordid(packageRecordId);
        row.setAction(action);
        row.setResult(success ? Deploymentauditresult.SUCCESS : Deploymentauditresult.FAILURE);
        row.setActor(actor);
        row.setDetailsjson(details != null ? json.toJsonb(details) : null);
        row.setCreatedat(LocalDateTime.now());
        row.insert();
    }

    /**
     * DEP-001 one-active-Site enforcement. Returns an error string, or null if the package's site is
     * allowed to (re)activate on this LS-100 given its current commissioning state.
     */
    private String checkOneActiveSitePolicy(LscommissioningRecord commissioning, String manifestSiteId) {
        if (commissioning.getActivesiteid() == null) return null; // UNCOMMISSIONED/recommissioned: any Site may commission
        if (commissioning.getActivesiteid().equals(manifestSiteId)) return null; // same-Site upgrade
        return "This LS-100 already has an active Site (" + commissioning.getActivesiteid() + "). "
            + "Activating a package for a different Site (" + manifestSiteId + ") is rejected until an explicit "
            + "recommissioning operation archives/removes the existing Site.";
    }

    public DeploymentpackagerecordRecord stagePackage(byte[] buffer, String source, String actor) {
        if (!"DIRECT".equals(source) && !"OFFLINE_IMPORT".equals(source)) {
            throw ApiException.badRequest("source must be DIRECT or OFFLINE_IMPORT");
        }

        Parser.ParseResult parsed = parser.parseSitePackage(buffer);
        String checksum = Checksum.sha256Hex(buffer);

        if (!parsed.ok()) {
            JsonNode manifest = parsed.manifest();
            String packageId = manifest != null && manifest.hasNonNull("packageId") ? manifest.get("packageId").asString() : "unknown";
            String siteId = manifest != null && manifest.hasNonNull("siteId") ? manifest.get("siteId").asString() : "unknown";
            String siteName = manifest != null && manifest.hasNonNull("siteName") ? manifest.get("siteName").asString() : "unknown";
            String packageVersion = manifest != null && manifest.hasNonNull("projectVersion") ? manifest.get("projectVersion").asString() : "unknown";
            int schemaVersion = manifest != null && manifest.hasNonNull("packageSchemaVersion") ? manifest.get("packageSchemaVersion").asInt() : 0;

            DeploymentpackagerecordRecord record = dsl.newRecord(DEPLOYMENTPACKAGERECORD);
            record.setId(UUID.randomUUID().toString());
            record.setPackageid(packageId);
            record.setSiteid(siteId);
            record.setSitename(siteName);
            record.setPackageversion(packageVersion);
            record.setSchemaversion(schemaVersion);
            record.setStatus(Deploymentpackagestatus.FAILED);
            record.setSource(Deploymentsource.valueOf(source));
            record.setChecksumsha256(checksum);
            record.setManifestjson(json.toJsonb(manifest != null ? manifest : json.newObject()));
            record.setFailurereason(String.join("; ", parsed.errors()));
            record.setReceivedat(LocalDateTime.now());
            record.setFilepath(""); // set immediately below once we know the record id
            record.insert();
            record.setFilepath(storage.writeStagedPackage(record.getId(), buffer));
            record.update();

            ObjectNode details = json.newObject();
            ArrayNode errorsArray = json.newArray();
            parsed.errors().forEach(errorsArray::add);
            details.set("errors", errorsArray);
            audit(dsl, record.getSiteid(), record.getId(), "STAGE", false, actor, details);
            throw ApiException.unprocessable("Package rejected: " + String.join("; ", parsed.errors()));
        }

        JsonNode manifest = parsed.manifest();
        DeploymentpackagerecordRecord record = dsl.newRecord(DEPLOYMENTPACKAGERECORD);
        record.setId(UUID.randomUUID().toString());
        record.setPackageid(manifest.get("packageId").asString());
        record.setSiteid(manifest.get("siteId").asString());
        record.setSitename(manifest.get("siteName").asString());
        record.setPackageversion(manifest.get("projectVersion").asString());
        record.setSchemaversion(manifest.get("packageSchemaVersion").asInt());
        record.setStatus(Deploymentpackagestatus.STAGED);
        record.setSource(Deploymentsource.valueOf(source));
        record.setChecksumsha256(checksum);
        record.setManifestjson(json.toJsonb(manifest));
        record.setReceivedat(LocalDateTime.now());
        record.setFilepath(""); // set immediately below once we know the record id
        record.insert();
        record.setFilepath(storage.writeStagedPackage(record.getId(), buffer));
        record.update();

        ObjectNode details = json.newObject();
        details.put("source", source);
        ArrayNode warningsArray = json.newArray();
        parsed.warnings().forEach(warningsArray::add);
        details.set("warnings", warningsArray);
        audit(dsl, record.getSiteid(), record.getId(), "STAGE", true, actor, details);
        return record;
    }

    /**
     * Validate a staged package: re-parse from disk, enforce one-active-Site policy, compute the
     * change preview, and create the pre-deployment backup (LC-ARCH-002 §7: preview and backup both
     * precede the operator's activate action).
     */
    public DeploymentpackagerecordRecord validatePackage(String packageRecordId, String actor) {
        DeploymentpackagerecordRecord record = dsl.selectFrom(DEPLOYMENTPACKAGERECORD).where(DEPLOYMENTPACKAGERECORD.ID.eq(packageRecordId)).fetchOne();
        if (record == null) throw ApiException.notFound("Package record not found");
        if (record.getStatus() != Deploymentpackagestatus.STAGED && record.getStatus() != Deploymentpackagestatus.VALIDATED && record.getStatus() != Deploymentpackagestatus.FAILED) {
            throw ApiException.conflict("Package is in status " + record.getStatus() + " and cannot be (re)validated");
        }

        byte[] buffer = storage.readStagedPackage(record.getFilepath());
        Parser.ParseResult parsed = parser.parseSitePackage(buffer);
        if (!parsed.ok()) {
            record.setStatus(Deploymentpackagestatus.FAILED);
            record.setFailurereason(String.join("; ", parsed.errors()));
            record.setValidatedat(LocalDateTime.now());
            record.update();
            ObjectNode details = json.newObject();
            ArrayNode errorsArray = json.newArray();
            parsed.errors().forEach(errorsArray::add);
            details.set("errors", errorsArray);
            audit(dsl, record.getSiteid(), record.getId(), "VALIDATE", false, actor, details);
            return record;
        }

        LscommissioningRecord commissioning = getCommissioning();
        String policyError = checkOneActiveSitePolicy(commissioning, parsed.manifest().get("siteId").asString());
        if (policyError != null) {
            record.setStatus(Deploymentpackagestatus.FAILED);
            record.setFailurereason(policyError);
            record.setValidatedat(LocalDateTime.now());
            record.update();
            ObjectNode details = json.newObject();
            details.put("reason", policyError);
            audit(dsl, record.getSiteid(), record.getId(), "VALIDATE", false, actor, details);
            return record;
        }

        String manifestSiteId = parsed.manifest().get("siteId").asString();
        SiteRecord currentSite = dsl.selectFrom(SITE).where(SITE.ID.eq(manifestSiteId)).fetchOne();
        JsonNode previousFiles = null;
        String activeReleaseVersionId = currentSite != null ? currentSite.getActivereleaseversionid() : null;
        if (activeReleaseVersionId != null) {
            SiteversionpayloadRecord payloadRow = dsl.selectFrom(SITEVERSIONPAYLOAD).where(SITEVERSIONPAYLOAD.SITEVERSIONID.eq(activeReleaseVersionId)).fetchOne();
            previousFiles = payloadRow != null ? json.toJsonNode(payloadRow.getPayloadjson()) : null;
        }
        JsonNode changePreview = Diff.computeChangePreview(Diff.toBundle(previousFiles), parsed.files());

        // Pre-deployment backup: the previous release's own `files` bundle, so a later rollback can
        // re-apply it through the exact same activation code path (no separate "undo" logic to trust).
        DeploymentbackuprecordRecord backup = dsl.newRecord(DEPLOYMENTBACKUPRECORD);
        backup.setId(UUID.randomUUID().toString());
        backup.setSiteid(manifestSiteId);
        backup.setPackagerecordid(record.getId());
        backup.setReason("PRE_ACTIVATION");
        ObjectNode snapshot = json.newObject();
        if (previousFiles != null) {
            snapshot.put("siteVersionId", activeReleaseVersionId);
            snapshot.set("files", previousFiles);
        } else {
            snapshot.put("firstActivation", true);
        }
        backup.setSnapshotjson(json.toJsonb(snapshot));
        backup.setCreatedat(LocalDateTime.now());
        backup.insert();

        ObjectNode backupDetails = json.newObject();
        backupDetails.put("backupId", backup.getId());
        audit(dsl, manifestSiteId, record.getId(), "BACKUP", true, actor, backupDetails);

        record.setStatus(Deploymentpackagestatus.VALIDATED);
        record.setValidatedat(LocalDateTime.now());
        record.setChangepreviewjson(json.toJsonb(changePreview));
        record.setFailurereason(null);
        record.update();

        ObjectNode details = json.newObject();
        ArrayNode warningsArray = json.newArray();
        parsed.warnings().forEach(warningsArray::add);
        details.set("warnings", warningsArray);
        audit(dsl, record.getSiteid(), record.getId(), "VALIDATE", true, actor, details);
        return record;
    }

    public DeploymentpackagerecordRecord previewPackage(String packageRecordId) {
        DeploymentpackagerecordRecord record = dsl.selectFrom(DEPLOYMENTPACKAGERECORD).where(DEPLOYMENTPACKAGERECORD.ID.eq(packageRecordId)).fetchOne();
        if (record == null) throw ApiException.notFound("Package record not found");
        if (record.getStatus() == Deploymentpackagestatus.STAGED) {
            DeploymentpackagerecordRecord validated = validatePackage(packageRecordId, null);
            if (validated.getStatus() != Deploymentpackagestatus.VALIDATED) return validated;
            return validated;
        }
        return record;
    }

    /**
     * Activate a VALIDATED package (LC-ARCH-002 §7 "Activation requirements"). The relational apply
     * runs inside one transaction, so a thrown error rolls back every write Postgres made for this
     * attempt automatically — "no partially created hierarchy records" is a property of the
     * transaction, not of extra bookkeeping here.
     */
    public DeploymentpackagerecordRecord activatePackage(String packageRecordId, String actor) {
        DeploymentpackagerecordRecord record = dsl.selectFrom(DEPLOYMENTPACKAGERECORD).where(DEPLOYMENTPACKAGERECORD.ID.eq(packageRecordId)).fetchOne();
        if (record == null) throw ApiException.notFound("Package record not found");
        if (record.getStatus() != Deploymentpackagestatus.VALIDATED) {
            throw ApiException.conflict("Package must be VALIDATED before activation (current status: " + record.getStatus() + ")");
        }

        LscommissioningRecord commissioning = getCommissioning();
        String policyError = checkOneActiveSitePolicy(commissioning, record.getSiteid());
        if (policyError != null) throw ApiException.conflict(policyError);

        byte[] buffer = storage.readStagedPackage(record.getFilepath());
        Parser.ParseResult parsed = parser.parseSitePackage(buffer);
        if (!parsed.ok()) {
            throw ApiException.unprocessable("Package failed re-validation at activation time: " + String.join("; ", parsed.errors()));
        }

        record.setStatus(Deploymentpackagestatus.ACTIVATING);
        record.update();
        commissioning.setState(Lscommissionstate.ACTIVATING);
        commissioning.setUpdatedat(LocalDateTime.now());
        commissioning.update();

        String priorActiveSiteId = commissioning.getActivesiteid();
        String priorActivePackageRecordId = commissioning.getActivepackagerecordid();
        Lscommissionstate priorState = priorActiveSiteId != null ? Lscommissionstate.ACTIVE : Lscommissionstate.UNCOMMISSIONED;

        try {
            ActivationService.ApplyResult result = dsl.transactionResult(cfg -> {
                DSLContext ctx = org.jooq.impl.DSL.using(cfg);
                return activationService.applyPackageFiles(ctx, record.getSiteid(), parsed.files(), manifestReleaseNotes(parsed.manifest()));
            });

            // Post-activation health check: the pointer we just set must actually resolve.
            SiteRecord check = dsl.selectFrom(SITE).where(SITE.ID.eq(record.getSiteid())).fetchOne();
            if (check == null || check.getActivereleaseversionid() == null || !check.getActivereleaseversionid().equals(result.siteVersionId())) {
                throw new IllegalStateException("Post-activation validation failed: active release pointer did not resolve to the new version");
            }

            dsl.update(DEPLOYMENTPACKAGERECORD)
                .set(DEPLOYMENTPACKAGERECORD.STATUS, Deploymentpackagestatus.SUPERSEDED)
                .set(DEPLOYMENTPACKAGERECORD.SUPERSEDEDAT, LocalDateTime.now())
                .where(DEPLOYMENTPACKAGERECORD.SITEID.eq(record.getSiteid()), DEPLOYMENTPACKAGERECORD.STATUS.eq(Deploymentpackagestatus.ACTIVE), DEPLOYMENTPACKAGERECORD.ID.ne(record.getId()))
                .execute();

            record.setStatus(Deploymentpackagestatus.ACTIVE);
            record.setActivatedat(LocalDateTime.now());
            record.setCreatedsiteversionid(result.siteVersionId());
            record.update();

            commissioning.setState(Lscommissionstate.ACTIVE);
            commissioning.setActivesiteid(record.getSiteid());
            commissioning.setActivepackagerecordid(record.getId());
            commissioning.setUpdatedat(LocalDateTime.now());
            commissioning.update();

            ObjectNode details = json.newObject();
            details.put("siteVersionId", result.siteVersionId());
            details.put("versionNumber", result.versionNumber());
            audit(dsl, record.getSiteid(), record.getId(), "ACTIVATE", true, actor, details);

            try {
                runtimeService.resyncLiveSimBindings();
            } catch (Exception e) {
                log.warn("[deployment] Runtime live-binding resync skipped: {}", e.getMessage());
            }

            return record;
        } catch (Exception e) {
            // The transaction already rolled back every relational write for this attempt —
            // restoring LsCommissioning to what it was before this attempt is the only state left
            // to reconcile (LC-ARCH-002 §7 "Failed activation automatically returns to a known-good
            // version when safe").
            record.setStatus(Deploymentpackagestatus.FAILED);
            record.setFailurereason(e.getMessage());
            record.update();

            commissioning.setState(priorState);
            commissioning.setActivesiteid(priorActiveSiteId);
            commissioning.setActivepackagerecordid(priorActivePackageRecordId);
            commissioning.setUpdatedat(LocalDateTime.now());
            commissioning.update();

            ObjectNode details = json.newObject();
            details.put("error", e.getMessage());
            audit(dsl, record.getSiteid(), record.getId(), "ACTIVATE", false, actor, details);
            return record;
        }
    }

    private static String manifestReleaseNotes(JsonNode manifest) {
        return manifest.hasNonNull("releaseNotes") ? manifest.get("releaseNotes").asString() : null;
    }

    public record RollbackResult(boolean ok, String siteVersionId) {
    }

    /**
     * Roll back a Site's ACTIVE configuration to its previously-released version by re-applying that
     * version's own {@code files} bundle through the identical activation pipeline. History is
     * append-only: this creates a new SiteVersion carrying the old content rather than rewriting or
     * deleting anything.
     */
    public RollbackResult rollbackToPreviousVersion(String siteId, String actor) {
        SiteRecord site = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        if (site == null || site.getActivereleaseversionid() == null) {
            throw ApiException.notFound("Site has no active release to roll back from");
        }
        SiteversionRecord current = dsl.selectFrom(SITEVERSION).where(SITEVERSION.ID.eq(site.getActivereleaseversionid())).fetchOne();
        if (current == null || current.getParentversionid() == null) {
            throw ApiException.conflict("No prior version exists to roll back to");
        }
        SiteversionRecord parent = dsl.selectFrom(SITEVERSION).where(SITEVERSION.ID.eq(current.getParentversionid())).fetchOne();
        if (parent == null) throw ApiException.conflict("Prior version has no recoverable payload");
        SiteversionpayloadRecord parentPayloadRow = dsl.selectFrom(SITEVERSIONPAYLOAD).where(SITEVERSIONPAYLOAD.SITEVERSIONID.eq(parent.getId())).fetchOne();
        if (parentPayloadRow == null) throw ApiException.conflict("Prior version has no recoverable payload");
        JsonNode parentPayload = json.toJsonNode(parentPayloadRow.getPayloadjson());

        try {
            LscommissioningRecord commissioning = getCommissioning();
            commissioning.setState(Lscommissionstate.ROLLBACK);
            commissioning.setUpdatedat(LocalDateTime.now());
            commissioning.update();
        } catch (RuntimeException ignored) {
            // matches Node's .catch(() => {}) — rollback must proceed even if this bookkeeping write fails
        }

        try {
            ActivationService.ApplyResult result = dsl.transactionResult(cfg -> {
                DSLContext ctx = org.jooq.impl.DSL.using(cfg);
                return activationService.applyPackageFiles(ctx, siteId, Diff.toBundle(parentPayload), "Rollback to v" + parent.getVersionnumber());
            });

            LscommissioningRecord commissioning = getCommissioning();
            commissioning.setState(Lscommissionstate.ACTIVE);
            commissioning.setActivesiteid(siteId);
            commissioning.setUpdatedat(LocalDateTime.now());
            commissioning.update();

            ObjectNode details = json.newObject();
            details.put("restoredFromVersionNumber", parent.getVersionnumber());
            details.put("newSiteVersionId", result.siteVersionId());
            audit(dsl, siteId, null, "ROLLBACK", true, actor, details);

            try {
                runtimeService.resyncLiveSimBindings();
            } catch (Exception e) {
                log.warn("[deployment] Runtime live-binding resync skipped: {}", e.getMessage());
            }

            return new RollbackResult(true, result.siteVersionId());
        } catch (Exception e) {
            try {
                LscommissioningRecord commissioning = getCommissioning();
                commissioning.setState(Lscommissionstate.FAILED);
                commissioning.setUpdatedat(LocalDateTime.now());
                commissioning.update();
            } catch (RuntimeException ignored) {
                // matches Node's .catch(() => {})
            }
            ObjectNode details = json.newObject();
            details.put("error", e.getMessage());
            audit(dsl, siteId, null, "ROLLBACK", false, actor, details);
            throw e instanceof RuntimeException re ? re : new RuntimeException(e);
        }
    }

    public record DownloadableBackup(byte[] buffer, String fileName) {
    }

    /** Rebuilds a downloadable `.lspkg`-shaped archive from a stored backup snapshot. */
    public DownloadableBackup downloadBackup(String backupId) {
        DeploymentbackuprecordRecord backup = dsl.selectFrom(DEPLOYMENTBACKUPRECORD).where(DEPLOYMENTBACKUPRECORD.ID.eq(backupId)).fetchOne();
        if (backup == null) throw ApiException.notFound("Backup not found");
        JsonNode snapshot = json.toJsonNode(backup.getSnapshotjson());
        JsonNode filesNode = snapshot != null ? snapshot.get("files") : null;
        if (filesNode == null || !filesNode.isObject()) {
            throw ApiException.conflict("This backup predates any activation and has nothing to export");
        }
        Map<String, JsonNode> files = Diff.toBundle(filesNode);

        String siteName = "Unknown Site";
        JsonNode siteJson = files.get("site.json");
        if (siteJson != null && siteJson.path("site").hasNonNull("name")) {
            siteName = siteJson.path("site").get("name").asString();
        }

        ObjectNode manifest = json.newObject();
        manifest.put("packageSchemaVersion", Manifest.PACKAGE_SCHEMA_VERSION);
        manifest.put("packageId", "backup-" + backup.getId());
        manifest.put("siteId", backup.getSiteid());
        manifest.put("siteName", siteName);
        String createdAtIso = backup.getCreatedat().atZone(java.time.ZoneOffset.UTC).toInstant().toString();
        manifest.put("projectVersion", "backup-" + createdAtIso);
        manifest.put("createdAt", createdAtIso);
        manifest.putNull("author");
        manifest.put("toolVersion", "4.0.0");
        manifest.put("minLs100Version", "1.0.0");
        manifest.put("simulationPackage", false);
        manifest.put("deploymentScope", "full-site");
        manifest.put("releaseNotes", "Pre-deployment backup captured " + createdAtIso);
        List<String> sortedNames = files.keySet().stream().sorted().toList();
        ArrayNode filesArray = json.newArray();
        sortedNames.forEach(filesArray::add);
        manifest.set("files", filesArray);
        ObjectNode checksumsNode = json.newObject();
        for (String name : sortedNames) checksumsNode.put(name, Checksum.sha256Hex(Checksum.canonicalStringify(files.get(name))));
        manifest.set("checksums", checksumsNode);
        ObjectNode signatureNode = json.newObject();
        signatureNode.put("signed", false);
        signatureNode.put("algorithm", "none");
        signatureNode.putNull("signature");
        signatureNode.put("reason", "Backup export is an unsigned development artifact.");
        manifest.set("signature", signatureNode);

        List<Zip.Entry> entries = new java.util.ArrayList<>();
        entries.add(new Zip.Entry("manifest.json", Checksum.canonicalStringify(manifest).getBytes(StandardCharsets.UTF_8)));
        for (String name : sortedNames) {
            entries.add(new Zip.Entry(name, Checksum.canonicalStringify(files.get(name)).getBytes(StandardCharsets.UTF_8)));
        }
        byte[] buffer = Zip.buildZip(entries);
        String safeSiteName = siteName.replaceAll("[^a-zA-Z0-9_-]+", "_");
        return new DownloadableBackup(buffer, safeSiteName + "_backup_" + backup.getId() + ".lspkg");
    }

    public LscommissioningRecord recommission(String actor, String reason) {
        LscommissioningRecord commissioning = getCommissioning();
        if (commissioning.getActivesiteid() == null) {
            throw ApiException.conflict("LS-100 has no active Site to recommission away from");
        }
        String siteId = commissioning.getActivesiteid();
        dsl.update(SITE).set(SITE.STATUS, com.legioncontrols.server.jooq.generated.enums.Entitystatus.ARCHIVED).where(SITE.ID.eq(siteId)).execute();
        commissioning.setState(Lscommissionstate.UNCOMMISSIONED);
        commissioning.setActivesiteid(null);
        commissioning.setActivepackagerecordid(null);
        commissioning.setUpdatedat(LocalDateTime.now());
        commissioning.update();

        ObjectNode details = json.newObject();
        if (reason != null) details.put("reason", reason); else details.putNull("reason");
        audit(dsl, siteId, null, "RECOMMISSION", true, actor, details);
        return commissioning;
    }

    public record StatusResult(LscommissioningRecord commissioning, DeploymentpackagerecordRecord activePackage) {
    }

    public StatusResult getStatus() {
        LscommissioningRecord commissioning = getCommissioning();
        DeploymentpackagerecordRecord activePackage = commissioning.getActivepackagerecordid() != null
            ? dsl.selectFrom(DEPLOYMENTPACKAGERECORD).where(DEPLOYMENTPACKAGERECORD.ID.eq(commissioning.getActivepackagerecordid())).fetchOne()
            : null;
        return new StatusResult(commissioning, activePackage);
    }

    public record HistoryResult(List<DeploymentpackagerecordRecord> packages, List<DeploymentauditentryRecord> auditEntries) {
    }

    public HistoryResult listHistory(String siteId) {
        var packagesQuery = dsl.selectFrom(DEPLOYMENTPACKAGERECORD);
        List<DeploymentpackagerecordRecord> packages = (siteId != null
            ? packagesQuery.where(DEPLOYMENTPACKAGERECORD.SITEID.eq(siteId))
            : packagesQuery)
            .orderBy(DEPLOYMENTPACKAGERECORD.RECEIVEDAT.desc())
            .fetch();
        var auditQuery = dsl.selectFrom(DEPLOYMENTAUDITENTRY);
        List<DeploymentauditentryRecord> auditEntries = (siteId != null
            ? auditQuery.where(DEPLOYMENTAUDITENTRY.SITEID.eq(siteId))
            : auditQuery)
            .orderBy(DEPLOYMENTAUDITENTRY.CREATEDAT.desc())
            .limit(200)
            .fetch();
        return new HistoryResult(packages, auditEntries);
    }

    public DeploymentpackagerecordRecord getPackageRecord(String packageRecordId) {
        DeploymentpackagerecordRecord record = dsl.selectFrom(DEPLOYMENTPACKAGERECORD).where(DEPLOYMENTPACKAGERECORD.ID.eq(packageRecordId)).fetchOne();
        if (record == null) throw ApiException.notFound("Package record not found");
        return record;
    }

    public DeploymentpackagerecordRecord discardPackage(String packageRecordId, String actor) {
        DeploymentpackagerecordRecord record = dsl.selectFrom(DEPLOYMENTPACKAGERECORD).where(DEPLOYMENTPACKAGERECORD.ID.eq(packageRecordId)).fetchOne();
        if (record == null) throw ApiException.notFound("Package record not found");
        if (record.getStatus() == Deploymentpackagestatus.ACTIVE) {
            throw ApiException.conflict("Cannot discard the currently active package — recommission or roll back instead");
        }
        storage.deleteStagedPackage(record.getFilepath());
        record.setStatus(Deploymentpackagestatus.DISCARDED);
        record.update();
        audit(dsl, record.getSiteid(), record.getId(), "DISCARD", true, actor, null);
        return record;
    }
}
