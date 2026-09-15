package com.legioncontrols.server.lspkg;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.AlarmdefinitionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.BuildingRecord;
import com.legioncontrols.server.jooq.generated.tables.records.ControllersmappedRecord;
import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.FloorRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointsmappedRecord;
import com.legioncontrols.server.jooq.generated.tables.records.ScheduleassignmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.ScheduledefinitionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteversionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteversionpayloadRecord;
import com.legioncontrols.server.jooq.generated.tables.records.TrendassignmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.TrenddefinitionRecord;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Result;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import static com.legioncontrols.server.jooq.generated.tables.Alarmdefinition.ALARMDEFINITION;
import static com.legioncontrols.server.jooq.generated.tables.Building.BUILDING;
import static com.legioncontrols.server.jooq.generated.tables.Controllersmapped.CONTROLLERSMAPPED;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Floor.FLOOR;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;
import static com.legioncontrols.server.jooq.generated.tables.Pointsmapped.POINTSMAPPED;
import static com.legioncontrols.server.jooq.generated.tables.Scheduleassignment.SCHEDULEASSIGNMENT;
import static com.legioncontrols.server.jooq.generated.tables.Scheduledefinition.SCHEDULEDEFINITION;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static com.legioncontrols.server.jooq.generated.tables.Siteversion.SITEVERSION;
import static com.legioncontrols.server.jooq.generated.tables.Siteversionpayload.SITEVERSIONPAYLOAD;
import static com.legioncontrols.server.jooq.generated.tables.Trendassignment.TRENDASSIGNMENT;
import static com.legioncontrols.server.jooq.generated.tables.Trenddefinition.TRENDDEFINITION;

/**
 * Java port of backend/src/lib/lspkg/builder.js — the deterministic Legion Site Package (.lspkg)
 * builder (LC-ARCH-002 §3, §6 "Build Site Package"). Pulls the full deployable configuration for a
 * site directly from relational tables with an explicit safe-field allow-list per model (never a
 * whole-row select) — see the class-level comment in the Node original for the exact exclusions this
 * must preserve: no PointHistorySample/AlarmEvent, no Point.presentValue/commState/lastSeenAt, no
 * ControllersMapped.status/lastSeenAt/metadataJson, no SIM-protocol controller/point/mapping rows
 * unless {@code simulationPackage=true}, and never any User/UserSiteAccess/credential data.
 */
@Service
public class PackageBuilder {

    private static final String LS100_MIN_VERSION = "1.0.0";

    private final DSLContext dsl;
    private final JsonUtil json;

    public PackageBuilder(DSLContext dsl, JsonUtil json) {
        this.dsl = dsl;
        this.json = json;
    }

    public record SiteContent(ObjectNode site, ArrayNode buildings, ArrayNode floors, ArrayNode equipment,
                               ArrayNode points, ArrayNode controllers, ArrayNode pointMappings,
                               ArrayNode alarmDefinitions, ArrayNode trendDefinitions, ArrayNode scheduleDefinitions,
                               ArrayNode controllerApplications) {
    }

    private ObjectNode safePoint(PointRecord p) {
        ObjectNode node = json.newObject();
        node.put("id", p.getId());
        node.put("equipmentId", p.getEquipmentid());
        node.put("pointCode", p.getPointcode());
        node.put("pointName", p.getPointname());
        node.put("pointType", p.getPointtype());
        putNullable(node, "unit", p.getUnit());
        node.put("writable", Boolean.TRUE.equals(p.getWritable()));
        node.put("status", p.getStatus().getLiteral());
        return node;
    }

    private ObjectNode safeController(ControllersmappedRecord c) {
        ObjectNode node = json.newObject();
        node.put("id", c.getId());
        node.put("equipmentId", c.getEquipmentid());
        node.put("controllerCode", c.getControllercode());
        putNullable(node, "displayName", c.getDisplayname());
        node.put("protocol", c.getProtocol());
        putNullable(node, "deviceInstance", c.getDeviceinstance());
        putNullable(node, "ipAddress", c.getIpaddress());
        putNullable(node, "networkAddress", c.getNetworkaddress());
        if (c.getPollratems() != null) node.put("pollRateMs", c.getPollratems()); else node.putNull("pollRateMs");
        node.put("isSimulated", Boolean.TRUE.equals(c.getIssimulated()));
        node.put("isEnabled", Boolean.TRUE.equals(c.getIsenabled()));
        return node;
    }

    private ObjectNode safePointMapping(PointsmappedRecord m) {
        ObjectNode node = json.newObject();
        node.put("id", m.getId());
        node.put("equipmentControllerId", m.getEquipmentcontrollerid());
        node.put("equipmentId", m.getEquipmentid());
        node.put("pointId", m.getPointid());
        putNullable(node, "legionPointCode", m.getLegionpointcode());
        node.put("fieldPointKey", m.getFieldpointkey());
        putNullable(node, "fieldPointName", m.getFieldpointname());
        putNullable(node, "fieldObjectType", m.getFieldobjecttype());
        putNullable(node, "fieldObjectInstance", m.getFieldobjectinstance());
        putNullable(node, "fieldDataType", m.getFielddatatype());
        node.put("readEnabled", Boolean.TRUE.equals(m.getReadenabled()));
        node.put("writeEnabled", Boolean.TRUE.equals(m.getWriteenabled()));
        node.put("isBound", Boolean.TRUE.equals(m.getIsbound()));
        return node;
    }

    private ObjectNode safeAlarmDefinition(AlarmdefinitionRecord a) {
        ObjectNode node = json.newObject();
        node.put("id", a.getId());
        node.put("equipmentId", a.getEquipmentid());
        putNullable(node, "buildingId", a.getBuildingid());
        putNullable(node, "floorId", a.getFloorid());
        node.put("pointKey", a.getPointkey());
        putNullable(node, "pointId", a.getPointid());
        node.put("name", a.getName());
        node.put("enabled", Boolean.TRUE.equals(a.getEnabled()));
        node.put("severity", a.getSeverity().getLiteral());
        node.put("category", a.getCategory().getLiteral());
        node.put("operator", a.getOperator().getLiteral());
        if (a.getTargetvalue() != null) node.put("targetValue", a.getTargetvalue()); else node.putNull("targetValue");
        putNullable(node, "targetPointId", a.getTargetpointid());
        putNullable(node, "targetPointKey", a.getTargetpointkey());
        if (a.getDeadband() != null) node.put("deadband", a.getDeadband()); else node.putNull("deadband");
        if (a.getDelayseconds() != null) node.put("delaySeconds", a.getDelayseconds()); else node.putNull("delaySeconds");
        putNullable(node, "messageTemplate", a.getMessagetemplate());
        node.put("autoAcknowledge", Boolean.TRUE.equals(a.getAutoacknowledge()));
        JsonNode conditionTree = a.getConditiontree() != null ? json.toJsonNode(a.getConditiontree()) : null;
        if (conditionTree != null) node.set("conditionTree", conditionTree); else node.putNull("conditionTree");
        return node;
    }

    private ObjectNode safeTrendDefinition(TrenddefinitionRecord t, List<TrendassignmentRecord> assignments) {
        ObjectNode node = json.newObject();
        node.put("id", t.getId());
        node.put("name", t.getName());
        node.put("enabled", Boolean.TRUE.equals(t.getEnabled()));
        node.put("isTemplate", Boolean.TRUE.equals(t.getIstemplate()));
        putNullable(node, "equipmentType", t.getEquipmenttype());
        if (t.getSampleinterval() != null) node.put("sampleInterval", t.getSampleinterval()); else node.putNull("sampleInterval");
        if (t.getRetentiondays() != null) node.put("retentionDays", t.getRetentiondays()); else node.putNull("retentionDays");
        JsonNode pointRequirements = t.getPointrequirements() != null ? json.toJsonNode(t.getPointrequirements()) : json.newArray();
        node.set("pointRequirements", pointRequirements);
        node.put("version", t.getVersion() != null ? t.getVersion() : 1);
        ArrayNode assignmentsOut = json.newArray();
        for (TrendassignmentRecord a : assignments) {
            ObjectNode an = json.newObject();
            an.put("id", a.getId());
            an.put("equipmentId", a.getEquipmentid());
            an.put("enabled", Boolean.TRUE.equals(a.getEnabled()));
            JsonNode resolvedMappings = a.getResolvedmappings() != null ? json.toJsonNode(a.getResolvedmappings()) : json.newObject();
            an.set("resolvedMappings", resolvedMappings);
            assignmentsOut.add(an);
        }
        node.set("assignments", assignmentsOut);
        return node;
    }

    private ObjectNode safeScheduleDefinition(ScheduledefinitionRecord s, List<ScheduleassignmentRecord> assignments) {
        ObjectNode node = json.newObject();
        node.put("id", s.getId());
        node.put("name", s.getName());
        node.put("enabled", Boolean.TRUE.equals(s.getEnabled()));
        node.put("isTemplate", Boolean.TRUE.equals(s.getIstemplate()));
        JsonNode weeklyWindows = s.getWeeklywindows() != null ? json.toJsonNode(s.getWeeklywindows()) : json.newArray();
        node.set("weeklyWindows", weeklyWindows);
        node.put("version", s.getVersion() != null ? s.getVersion() : 1);
        ArrayNode assignmentsOut = json.newArray();
        for (ScheduleassignmentRecord a : assignments) {
            ObjectNode an = json.newObject();
            an.put("id", a.getId());
            an.put("equipmentId", a.getEquipmentid());
            an.put("enabled", Boolean.TRUE.equals(a.getEnabled()));
            assignmentsOut.add(an);
        }
        node.set("assignments", assignmentsOut);
        return node;
    }

    private static void putNullable(ObjectNode node, String field, String value) {
        if (value != null) node.put(field, value); else node.putNull(field);
    }

    public SiteContent collectSiteContent(String siteId, boolean simulationPackage) {
        SiteRecord site = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        if (site == null) throw ApiException.notFound("Site not found");

        Result<BuildingRecord> buildings = dsl.selectFrom(BUILDING).where(BUILDING.SITEID.eq(siteId))
            .orderBy(BUILDING.SORTORDER.asc(), BUILDING.NAME.asc()).fetch();
        List<String> buildingIds = buildings.map(BuildingRecord::getId);

        Result<FloorRecord> floors = buildingIds.isEmpty()
            ? dsl.selectFrom(FLOOR).where(FLOOR.BUILDINGID.in(List.of())).fetch()
            : dsl.selectFrom(FLOOR).where(FLOOR.BUILDINGID.in(buildingIds)).orderBy(FLOOR.SORTORDER.asc(), FLOOR.NAME.asc()).fetch();

        Result<org.jooq.Record> equipmentRows = dsl.select(EQUIPMENT.fields())
            .select(CONTROLLERSMAPPED.fields())
            .from(EQUIPMENT)
            .leftJoin(CONTROLLERSMAPPED).on(CONTROLLERSMAPPED.EQUIPMENTID.eq(EQUIPMENT.ID))
            .where(EQUIPMENT.SITEID.eq(siteId))
            .orderBy(EQUIPMENT.NAME.asc())
            .fetch();

        ArrayNode equipmentOut = json.newArray();
        List<String> equipmentIds = new java.util.ArrayList<>();
        ArrayNode controllersOut = json.newArray();
        List<String> controllerIds = new java.util.ArrayList<>();

        for (org.jooq.Record row : equipmentRows) {
            EquipmentRecord eq = row.into(EQUIPMENT);
            equipmentIds.add(eq.getId());

            ObjectNode eqNode = json.newObject();
            eqNode.put("id", eq.getId());
            eqNode.put("siteId", eq.getSiteid());
            eqNode.put("buildingId", eq.getBuildingid());
            eqNode.put("floorId", eq.getFloorid());
            eqNode.put("name", eq.getName());
            eqNode.put("code", eq.getCode());
            eqNode.put("equipmentType", eq.getEquipmenttype());
            putNullable(eqNode, "templateName", eq.getTemplatename());
            putNullable(eqNode, "address", eq.getAddress());
            putNullable(eqNode, "instanceNumber", eq.getInstancenumber());
            eqNode.put("status", eq.getStatus().getLiteral());
            equipmentOut.add(eqNode);

            String controllerId = row.get(CONTROLLERSMAPPED.ID);
            if (controllerId != null) {
                ControllersmappedRecord c = row.into(CONTROLLERSMAPPED);
                if (simulationPackage || !"SIM".equals(c.getProtocol())) {
                    controllersOut.add(safeController(c));
                    controllerIds.add(controllerId);
                }
            }
        }

        ArrayNode pointsOut = json.newArray();
        if (!equipmentIds.isEmpty()) {
            for (PointRecord p : dsl.selectFrom(POINT).where(POINT.EQUIPMENTID.in(equipmentIds)).orderBy(POINT.POINTCODE.asc()).fetch()) {
                pointsOut.add(safePoint(p));
            }
        }

        ArrayNode pointMappingsOut = json.newArray();
        if (!controllerIds.isEmpty()) {
            for (PointsmappedRecord m : dsl.selectFrom(POINTSMAPPED).where(POINTSMAPPED.EQUIPMENTCONTROLLERID.in(controllerIds)).fetch()) {
                pointMappingsOut.add(safePointMapping(m));
            }
        }

        ArrayNode alarmDefinitionsOut = json.newArray();
        if (!equipmentIds.isEmpty()) {
            for (AlarmdefinitionRecord a : dsl.selectFrom(ALARMDEFINITION)
                .where(ALARMDEFINITION.SITEID.eq(siteId), ALARMDEFINITION.EQUIPMENTID.in(equipmentIds)).fetch()) {
                alarmDefinitionsOut.add(safeAlarmDefinition(a));
            }
        }

        java.util.Set<String> equipmentIdSet = new java.util.HashSet<>(equipmentIds);

        ArrayNode trendDefinitionsOut = json.newArray();
        for (TrenddefinitionRecord t : dsl.selectFrom(TRENDDEFINITION).where(TRENDDEFINITION.SITEID.eq(siteId)).fetch()) {
            List<TrendassignmentRecord> assignments = dsl.selectFrom(TRENDASSIGNMENT)
                .where(TRENDASSIGNMENT.DEFINITIONID.eq(t.getId()))
                .fetch().stream().filter(a -> equipmentIdSet.contains(a.getEquipmentid())).toList();
            trendDefinitionsOut.add(safeTrendDefinition(t, assignments));
        }

        ArrayNode scheduleDefinitionsOut = json.newArray();
        for (ScheduledefinitionRecord s : dsl.selectFrom(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.SITEID.eq(siteId)).fetch()) {
            List<ScheduleassignmentRecord> assignments = dsl.selectFrom(SCHEDULEASSIGNMENT)
                .where(SCHEDULEASSIGNMENT.DEFINITIONID.eq(s.getId()))
                .fetch().stream().filter(a -> equipmentIdSet.contains(a.getEquipmentid())).toList();
            scheduleDefinitionsOut.add(safeScheduleDefinition(s, assignments));
        }

        // No LCPE integration exists in this repo, so every controller-application reference is
        // honestly NOT_APPLICABLE — never a claim of a downloaded program (LC-ARCH-002 §9).
        ArrayNode controllerApplicationsOut = json.newArray();
        for (JsonNode c : controllersOut) {
            ObjectNode ca = json.newObject();
            ca.put("controllerCode", c.get("controllerCode").asString());
            ca.put("equipmentId", c.get("equipmentId").asString());
            ca.putNull("applicationRef");
            ca.putNull("applicationVersion");
            ca.put("status", "NOT_APPLICABLE");
            controllerApplicationsOut.add(ca);
        }

        ArrayNode buildingsOut = json.newArray();
        for (BuildingRecord b : buildings) {
            ObjectNode bn = json.newObject();
            bn.put("id", b.getId());
            bn.put("siteId", b.getSiteid());
            bn.put("name", b.getName());
            bn.put("addressLine1", b.getAddressline1());
            putNullable(bn, "addressLine2", b.getAddressline2());
            bn.put("city", b.getCity());
            bn.put("state", b.getState());
            bn.put("postalCode", b.getPostalcode());
            bn.put("country", b.getCountry());
            if (b.getLatitude() != null) bn.put("latitude", b.getLatitude()); else bn.putNull("latitude");
            if (b.getLongitude() != null) bn.put("longitude", b.getLongitude()); else bn.putNull("longitude");
            bn.put("status", b.getStatus().getLiteral());
            putNullable(bn, "buildingType", b.getBuildingtype());
            putNullable(bn, "buildingCode", b.getBuildingcode());
            putNullable(bn, "description", b.getDescription());
            bn.put("sortOrder", b.getSortorder() != null ? b.getSortorder() : 0);
            buildingsOut.add(bn);
        }

        ArrayNode floorsOut = json.newArray();
        for (FloorRecord f : floors) {
            ObjectNode fn = json.newObject();
            fn.put("id", f.getId());
            fn.put("buildingId", f.getBuildingid());
            fn.put("name", f.getName());
            fn.put("status", f.getStatus().getLiteral());
            putNullable(fn, "displayLabel", f.getDisplaylabel());
            putNullable(fn, "floorType", f.getFloortype());
            putNullable(fn, "occupancyType", f.getOccupancytype());
            fn.put("sortOrder", f.getSortorder() != null ? f.getSortorder() : 0);
            floorsOut.add(fn);
        }

        ObjectNode siteNode = json.newObject();
        siteNode.put("id", site.getId());
        siteNode.put("name", site.getName());
        siteNode.put("status", site.getStatus().getLiteral());
        putNullable(siteNode, "timezone", site.getTimezone());
        putNullable(siteNode, "siteType", site.getSitetype());
        putNullable(siteNode, "description", site.getDescription());
        putNullable(siteNode, "displayLabel", site.getDisplaylabel());
        putNullable(siteNode, "engineeringNotes", site.getEngineeringnotes());
        putNullable(siteNode, "icon", site.getIcon());

        return new SiteContent(siteNode, buildingsOut, floorsOut, equipmentOut, pointsOut, controllersOut,
            pointMappingsOut, alarmDefinitionsOut, trendDefinitionsOut, scheduleDefinitionsOut, controllerApplicationsOut);
    }

    public record BuildOptions(String author, String releaseNotes, String deploymentScope, boolean simulationPackage,
                                String minLs100Version, String projectVersion, JsonNode engineeringPayload,
                                String packageId) {
        public static BuildOptions defaults() {
            return new BuildOptions(null, null, null, false, null, null, null, null);
        }
    }

    public record BuiltPackage(byte[] buffer, ObjectNode manifest, Map<String, JsonNode> files, String fileName,
                                JsonNode changePreview) {
    }

    public BuiltPackage buildSitePackage(String siteId, BuildOptions options) {
        SiteContent content = collectSiteContent(siteId, options.simulationPackage());

        JsonNode engineering = options.engineeringPayload() != null ? options.engineeringPayload() : json.newObject();

        Map<String, JsonNode> files = new LinkedHashMap<>();
        ObjectNode siteJson = json.newObject();
        siteJson.set("site", content.site());
        siteJson.set("buildings", content.buildings());
        siteJson.set("floors", content.floors());
        files.put("site.json", siteJson);

        ObjectNode equipmentJson = json.newObject();
        equipmentJson.set("equipment", content.equipment());
        equipmentJson.set("points", content.points());
        files.put("equipment.json", equipmentJson);

        ObjectNode mappingsJson = json.newObject();
        mappingsJson.set("controllers", content.controllers());
        mappingsJson.set("pointMappings", content.pointMappings());
        mappingsJson.set("designed", objectField(engineering, "mappings"));
        files.put("mappings.json", mappingsJson);

        ObjectNode graphicsJson = json.newObject();
        graphicsJson.set("graphics", objectField(engineering, "graphics"));
        graphicsJson.set("siteLayoutGraphics", objectField(engineering, "siteLayoutGraphics"));
        files.put("graphics.json", graphicsJson);

        JsonNode templates = engineering.get("templates");
        if (templates != null && templates.isObject()) {
            files.put("templates.json", templates);
        } else {
            ObjectNode defaultTemplates = json.newObject();
            defaultTemplates.set("equipmentTemplates", json.newArray());
            defaultTemplates.set("graphicTemplates", json.newArray());
            files.put("templates.json", defaultTemplates);
        }

        ObjectNode alarmsJson = json.newObject();
        alarmsJson.set("alarmDefinitions", content.alarmDefinitions());
        files.put("alarms.json", alarmsJson);

        ObjectNode trendsJson = json.newObject();
        trendsJson.set("trendDefinitions", content.trendDefinitions());
        files.put("trends.json", trendsJson);

        ObjectNode schedulesJson = json.newObject();
        schedulesJson.set("scheduleDefinitions", content.scheduleDefinitions());
        files.put("schedules.json", schedulesJson);

        JsonNode networkConfig = engineering.get("networkConfig");
        files.put("network.json", networkConfig != null && networkConfig.isObject() ? networkConfig : json.newObject());

        ObjectNode controllerApplicationsJson = json.newObject();
        controllerApplicationsJson.set("controllerApplications", content.controllerApplications());
        files.put("controllerApplications.json", controllerApplicationsJson);

        Manifest.assertNoForbiddenKeys(files);

        Map<String, String> checksums = new LinkedHashMap<>();
        for (var entry : files.entrySet()) {
            checksums.put(entry.getKey(), Checksum.sha256Hex(Checksum.canonicalStringify(entry.getValue())));
        }

        String packageId = options.packageId() != null ? options.packageId() : UUID.randomUUID().toString();

        String releaseNotes = options.releaseNotes();
        JsonNode changePreview = null;
        try {
            SiteRecord siteRow = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
            if (siteRow != null && siteRow.getActivereleaseversionid() != null) {
                SiteversionpayloadRecord payloadRow = dsl.selectFrom(SITEVERSIONPAYLOAD)
                    .where(SITEVERSIONPAYLOAD.SITEVERSIONID.eq(siteRow.getActivereleaseversionid())).fetchOne();
                JsonNode previousPayload = payloadRow != null ? json.toJsonNode(payloadRow.getPayloadjson()) : null;
                if (previousPayload != null) {
                    changePreview = Diff.computeChangePreview(Diff.toBundle(previousPayload), files);
                    if (releaseNotes == null || releaseNotes.isBlank()) releaseNotes = summarizeChangePreview(changePreview);
                } else if (releaseNotes == null || releaseNotes.isBlank()) {
                    releaseNotes = "Initial package build: no previously deployed version to diff against.";
                }
            } else if (releaseNotes == null || releaseNotes.isBlank()) {
                releaseNotes = "Initial package build: no previously deployed version to diff against.";
            }
        } catch (RuntimeException e) {
            // Release-notes generation is best-effort; a diff failure must never block a package build.
            if (releaseNotes == null || releaseNotes.isBlank()) {
                releaseNotes = "Release summary unavailable (diff failed): " + e.getMessage();
            }
        }

        List<String> sortedFileNames = files.keySet().stream().sorted().toList();

        ObjectNode manifestCore = json.newObject();
        manifestCore.put("packageSchemaVersion", Manifest.PACKAGE_SCHEMA_VERSION);
        manifestCore.put("packageId", packageId);
        manifestCore.put("siteId", siteId);
        manifestCore.put("siteName", content.site().get("name").asString());
        manifestCore.put("projectVersion", options.projectVersion() != null ? options.projectVersion() : "v" + Instant.now().toEpochMilli());
        manifestCore.put("createdAt", Instant.now().toString());
        putNullable(manifestCore, "author", options.author());
        manifestCore.put("toolVersion", "4.0.0");
        manifestCore.put("minLs100Version", options.minLs100Version() != null ? options.minLs100Version() : LS100_MIN_VERSION);
        manifestCore.put("simulationPackage", options.simulationPackage());
        manifestCore.put("deploymentScope", options.deploymentScope() != null ? options.deploymentScope() : "full-site");
        manifestCore.put("releaseNotes", releaseNotes);
        ArrayNode filesArray = json.newArray();
        sortedFileNames.forEach(filesArray::add);
        manifestCore.set("files", filesArray);
        ObjectNode checksumsNode = json.newObject();
        checksums.forEach(checksumsNode::put);
        manifestCore.set("checksums", checksumsNode);

        Signing.SignatureResult signResult = Signing.sign();
        ObjectNode signatureNode = json.newObject();
        signatureNode.put("signed", signResult.signed());
        signatureNode.put("algorithm", signResult.algorithm());
        signatureNode.putNull("signature");
        signatureNode.put("reason", signResult.reason());

        ObjectNode manifest = manifestCore.deepCopy();
        manifest.set("signature", signatureNode);

        Manifest.assertNoForbiddenKeys(manifest);

        List<Zip.Entry> entries = new java.util.ArrayList<>();
        entries.add(new Zip.Entry("manifest.json", Checksum.canonicalStringify(manifest).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        for (String name : sortedFileNames) {
            entries.add(new Zip.Entry(name, Checksum.canonicalStringify(files.get(name)).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        }
        byte[] buffer = Zip.buildZip(entries);

        String safeSiteName = content.site().get("name").asString("Site").replaceAll("[^a-zA-Z0-9_-]+", "_");
        String fileName = safeSiteName + "_" + manifestCore.get("projectVersion").asString() + ".lspkg";

        return new BuiltPackage(buffer, manifest, files, fileName, changePreview);
    }

    private ObjectNode objectField(JsonNode parent, String field) {
        JsonNode value = parent != null ? parent.get(field) : null;
        return value != null && value.isObject() ? (ObjectNode) json.clone(value) : json.newObject();
    }

    private String summarizeChangePreview(JsonNode preview) {
        List<String> parts = new java.util.ArrayList<>();
        JsonNode collections = preview.get("collections");
        if (collections != null && collections.isObject()) {
            for (String collection : collections.propertyNames()) {
                JsonNode result = collections.get(collection);
                int added = result.get("added").size();
                int changed = result.get("changed").size();
                int removed = result.get("removed").size();
                if (added > 0 || changed > 0 || removed > 0) {
                    parts.add(collection + ": +" + added + "/~" + changed + "/-" + removed);
                }
            }
        }
        return parts.isEmpty()
            ? "No configuration changes since the previously deployed version."
            : "Changes vs. previously deployed version — " + String.join(", ", parts);
    }
}
