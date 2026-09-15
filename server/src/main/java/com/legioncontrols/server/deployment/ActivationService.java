package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.enums.Alarmoperator;
import com.legioncontrols.server.jooq.generated.enums.Alarmrulecategory;
import com.legioncontrols.server.jooq.generated.enums.Alarmseverity;
import com.legioncontrols.server.jooq.generated.enums.Entitystatus;
import com.legioncontrols.server.jooq.generated.enums.Siteversionstatus;
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
import com.legioncontrols.server.jooq.generated.tables.records.TrendassignmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.TrenddefinitionRecord;
import com.legioncontrols.server.live.LiveConfigService;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

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
 * Java port of backend/src/modules/deployment/activation.service.js — applies a parsed package's
 * {@code files} bundle to the relational database inside one transaction (LC-ARCH-002 §7
 * "Activation requirements": transactional, active-version pointer changes only after success, no
 * partially-created hierarchy). Used by BOTH a fresh activation and a rollback (rollback re-applies
 * the pre-deployment backup's own {@code files} bundle through this exact method — there is no
 * separate "undo" code path to keep in sync).
 *
 * Every object in {@code files} carries the stable UUID it was built with (see
 * {@code PackageBuilder}) — this upserts by that id rather than deleting/recreating the hierarchy,
 * and explicitly deletes whatever existed for the site but is absent from the new package.
 */
@Service
public class ActivationService {

    private final JsonUtil json;
    private final LiveConfigService liveConfigService;

    public ActivationService(JsonUtil json, LiveConfigService liveConfigService) {
        this.json = json;
        this.liveConfigService = liveConfigService;
    }

    public record ApplyResult(String siteVersionId, int versionNumber) {
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asString() : null;
    }

    private static Boolean bool(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asBoolean() : null;
    }

    private static Integer intOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asInt() : null;
    }

    private static Double doubleOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asDouble() : null;
    }

    private static Map<String, JsonNode> byId(JsonNode array) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        if (array != null && array.isArray()) {
            for (JsonNode item : array) {
                if (item != null && item.hasNonNull("id")) map.put(item.get("id").asString(), item);
            }
        }
        return map;
    }

    private int nextVersionNumber(DSLContext ctx, String siteId) {
        Integer max = ctx.select(org.jooq.impl.DSL.max(SITEVERSION.VERSIONNUMBER))
            .from(SITEVERSION).where(SITEVERSION.SITEID.eq(siteId)).fetchOne(0, Integer.class);
        return (max != null ? max : 0) + 1;
    }

    /**
     * @param tx an active transaction-scoped DSLContext
     * @param files a package's parsed {@code files} map ({@code "site.json"}, {@code "equipment.json"}, ...)
     * @param notes release notes to attach to the created SiteVersion
     */
    public ApplyResult applyPackageFiles(DSLContext tx, String siteId, Map<String, JsonNode> files, String notes) {
        JsonNode siteFile = files.getOrDefault("site.json", json.newObject());
        JsonNode equipmentFile = files.getOrDefault("equipment.json", json.newObject());
        JsonNode mappingsFile = files.getOrDefault("mappings.json", json.newObject());
        JsonNode alarmsFile = files.getOrDefault("alarms.json", json.newObject());
        JsonNode trendsFile = files.getOrDefault("trends.json", json.newObject());
        JsonNode schedulesFile = files.getOrDefault("schedules.json", json.newObject());

        JsonNode pkgSite = siteFile.get("site") != null ? siteFile.get("site") : json.newObject();
        Map<String, JsonNode> pkgBuildings = byId(siteFile.get("buildings"));
        Map<String, JsonNode> pkgFloors = byId(siteFile.get("floors"));
        Map<String, JsonNode> pkgEquipment = byId(equipmentFile.get("equipment"));
        Map<String, JsonNode> pkgPoints = byId(equipmentFile.get("points"));
        Map<String, JsonNode> pkgControllers = byId(mappingsFile.get("controllers"));
        Map<String, JsonNode> pkgPointMappings = byId(mappingsFile.get("pointMappings"));
        Map<String, JsonNode> pkgAlarms = byId(alarmsFile.get("alarmDefinitions"));
        Map<String, JsonNode> pkgTrends = byId(trendsFile.get("trendDefinitions"));
        Map<String, JsonNode> pkgSchedules = byId(schedulesFile.get("scheduleDefinitions"));

        LocalDateTime now = LocalDateTime.now();

        // ---- Site (upsert by the package's stable siteId; create on first-ever activation) ----
        SiteRecord existingSite = tx.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        String siteName = text(pkgSite, "name") != null ? text(pkgSite, "name") : "Unnamed Site";
        Entitystatus siteStatus = text(pkgSite, "status") != null ? Entitystatus.valueOf(text(pkgSite, "status")) : Entitystatus.ACTIVE;
        if (existingSite == null) {
            SiteRecord created = tx.newRecord(SITE);
            created.setId(siteId);
            created.setName(siteName);
            created.setStatus(siteStatus);
            created.setTimezone(text(pkgSite, "timezone"));
            created.setSitetype(text(pkgSite, "siteType"));
            created.setDescription(text(pkgSite, "description"));
            created.setDisplaylabel(text(pkgSite, "displayLabel"));
            created.setEngineeringnotes(text(pkgSite, "engineeringNotes"));
            created.setIcon(text(pkgSite, "icon"));
            created.setCreatedat(now);
            created.setUpdatedat(now);
            created.insert();
        } else {
            existingSite.setName(siteName);
            existingSite.setStatus(siteStatus);
            existingSite.setTimezone(text(pkgSite, "timezone"));
            existingSite.setSitetype(text(pkgSite, "siteType"));
            existingSite.setDescription(text(pkgSite, "description"));
            existingSite.setDisplaylabel(text(pkgSite, "displayLabel"));
            existingSite.setEngineeringnotes(text(pkgSite, "engineeringNotes"));
            existingSite.setIcon(text(pkgSite, "icon"));
            existingSite.setUpdatedat(now);
            existingSite.update();
        }

        // ---- Buildings: remove first (cascades floors/equipment/... beneath a removed building) ----
        List<String> existingBuildingIds = tx.select(BUILDING.ID).from(BUILDING).where(BUILDING.SITEID.eq(siteId)).fetch(BUILDING.ID);
        List<String> removedBuildingIds = existingBuildingIds.stream().filter(id -> !pkgBuildings.containsKey(id)).toList();
        if (!removedBuildingIds.isEmpty()) tx.deleteFrom(BUILDING).where(BUILDING.ID.in(removedBuildingIds)).execute();

        for (JsonNode b : pkgBuildings.values()) {
            upsertBuilding(tx, b, siteId, now);
        }

        // ---- Floors: same remove-then-upsert pattern, scoped by this site's building ids ----
        List<String> existingFloorIds = existingBuildingIds.isEmpty()
            ? List.of()
            : tx.select(FLOOR.ID).from(FLOOR).where(FLOOR.BUILDINGID.in(existingBuildingIds)).fetch(FLOOR.ID);
        List<String> removedFloorIds = existingFloorIds.stream().filter(id -> !pkgFloors.containsKey(id)).toList();
        if (!removedFloorIds.isEmpty()) tx.deleteFrom(FLOOR).where(FLOOR.ID.in(removedFloorIds)).execute();

        for (JsonNode f : pkgFloors.values()) {
            upsertFloor(tx, f, now);
        }

        // ---- Equipment ----
        List<String> existingEquipmentIds = tx.select(EQUIPMENT.ID).from(EQUIPMENT).where(EQUIPMENT.SITEID.eq(siteId)).fetch(EQUIPMENT.ID);
        List<String> removedEquipmentIds = existingEquipmentIds.stream().filter(id -> !pkgEquipment.containsKey(id)).toList();
        if (!removedEquipmentIds.isEmpty()) tx.deleteFrom(EQUIPMENT).where(EQUIPMENT.ID.in(removedEquipmentIds)).execute();

        for (JsonNode e : pkgEquipment.values()) {
            upsertEquipment(tx, e, siteId, now);
        }

        // ---- Points (per equipment) ----
        Set<String> survivingEquipmentIds = new LinkedHashSet<>(pkgEquipment.keySet());
        List<String> existingPointIds = survivingEquipmentIds.isEmpty()
            ? List.of()
            : tx.select(POINT.ID).from(POINT).where(POINT.EQUIPMENTID.in(survivingEquipmentIds)).fetch(POINT.ID);
        List<String> removedPointIds = existingPointIds.stream().filter(id -> !pkgPoints.containsKey(id)).toList();
        if (!removedPointIds.isEmpty()) tx.deleteFrom(POINT).where(POINT.ID.in(removedPointIds)).execute();

        for (JsonNode p : pkgPoints.values()) {
            JsonNode eq = pkgEquipment.get(text(p, "equipmentId"));
            if (eq == null) continue; // unresolved reference — already reported by the change preview, never applied
            upsertPoint(tx, p, siteId, eq, now);
        }

        // ---- Controllers (one per equipment) ----
        List<String> existingControllerIds = survivingEquipmentIds.isEmpty()
            ? List.of()
            : tx.select(CONTROLLERSMAPPED.ID).from(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.EQUIPMENTID.in(survivingEquipmentIds)).fetch(CONTROLLERSMAPPED.ID);
        List<String> removedControllerIds = existingControllerIds.stream().filter(id -> !pkgControllers.containsKey(id)).toList();
        if (!removedControllerIds.isEmpty()) tx.deleteFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.ID.in(removedControllerIds)).execute();

        for (JsonNode c : pkgControllers.values()) {
            JsonNode eq = pkgEquipment.get(text(c, "equipmentId"));
            if (eq == null) continue;
            upsertController(tx, c, siteId, eq, now);
        }

        // ---- Point mappings (per controller) ----
        Set<String> survivingControllerIds = new LinkedHashSet<>(pkgControllers.keySet());
        List<String> existingMappingIds = survivingControllerIds.isEmpty()
            ? List.of()
            : tx.select(POINTSMAPPED.ID).from(POINTSMAPPED).where(POINTSMAPPED.EQUIPMENTCONTROLLERID.in(survivingControllerIds)).fetch(POINTSMAPPED.ID);
        List<String> removedMappingIds = existingMappingIds.stream().filter(id -> !pkgPointMappings.containsKey(id)).toList();
        if (!removedMappingIds.isEmpty()) tx.deleteFrom(POINTSMAPPED).where(POINTSMAPPED.ID.in(removedMappingIds)).execute();

        for (JsonNode m : pkgPointMappings.values()) {
            if (!pkgControllers.containsKey(text(m, "equipmentControllerId")) || !pkgPoints.containsKey(text(m, "pointId"))) continue;
            upsertPointMapping(tx, m, now);
        }

        // ---- Alarm definitions (site-wide) ----
        List<String> existingAlarmIds = tx.select(ALARMDEFINITION.ID).from(ALARMDEFINITION).where(ALARMDEFINITION.SITEID.eq(siteId)).fetch(ALARMDEFINITION.ID);
        List<String> removedAlarmIds = existingAlarmIds.stream().filter(id -> !pkgAlarms.containsKey(id)).toList();
        if (!removedAlarmIds.isEmpty()) tx.deleteFrom(ALARMDEFINITION).where(ALARMDEFINITION.ID.in(removedAlarmIds)).execute();

        for (JsonNode a : pkgAlarms.values()) {
            if (!pkgEquipment.containsKey(text(a, "equipmentId"))) continue;
            upsertAlarm(tx, a, siteId, now);
        }

        // ---- Trend definitions + assignments ----
        List<String> existingTrendIds = tx.select(TRENDDEFINITION.ID).from(TRENDDEFINITION).where(TRENDDEFINITION.SITEID.eq(siteId)).fetch(TRENDDEFINITION.ID);
        List<String> removedTrendIds = existingTrendIds.stream().filter(id -> !pkgTrends.containsKey(id)).toList();
        if (!removedTrendIds.isEmpty()) tx.deleteFrom(TRENDDEFINITION).where(TRENDDEFINITION.ID.in(removedTrendIds)).execute();

        for (JsonNode t : pkgTrends.values()) {
            upsertTrendDefinition(tx, t, siteId, now);
            Map<String, JsonNode> pkgAssignments = byId(t.get("assignments"));
            List<String> existingAssignmentIds = tx.select(TRENDASSIGNMENT.ID).from(TRENDASSIGNMENT)
                .where(TRENDASSIGNMENT.DEFINITIONID.eq(text(t, "id"))).fetch(TRENDASSIGNMENT.ID);
            List<String> removedAssignmentIds = existingAssignmentIds.stream().filter(id -> !pkgAssignments.containsKey(id)).toList();
            if (!removedAssignmentIds.isEmpty()) tx.deleteFrom(TRENDASSIGNMENT).where(TRENDASSIGNMENT.ID.in(removedAssignmentIds)).execute();
            for (JsonNode a : pkgAssignments.values()) {
                if (!pkgEquipment.containsKey(text(a, "equipmentId"))) continue;
                upsertTrendAssignment(tx, a, text(t, "id"), siteId, now);
            }
        }

        // ---- Schedule definitions + assignments ----
        List<String> existingScheduleIds = tx.select(SCHEDULEDEFINITION.ID).from(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.SITEID.eq(siteId)).fetch(SCHEDULEDEFINITION.ID);
        List<String> removedScheduleIds = existingScheduleIds.stream().filter(id -> !pkgSchedules.containsKey(id)).toList();
        if (!removedScheduleIds.isEmpty()) tx.deleteFrom(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.ID.in(removedScheduleIds)).execute();

        for (JsonNode s : pkgSchedules.values()) {
            upsertScheduleDefinition(tx, s, siteId, now);
            Map<String, JsonNode> pkgAssignments = byId(s.get("assignments"));
            List<String> existingAssignmentIds = tx.select(SCHEDULEASSIGNMENT.ID).from(SCHEDULEASSIGNMENT)
                .where(SCHEDULEASSIGNMENT.DEFINITIONID.eq(text(s, "id"))).fetch(SCHEDULEASSIGNMENT.ID);
            List<String> removedAssignmentIds = existingAssignmentIds.stream().filter(id -> !pkgAssignments.containsKey(id)).toList();
            if (!removedAssignmentIds.isEmpty()) tx.deleteFrom(SCHEDULEASSIGNMENT).where(SCHEDULEASSIGNMENT.ID.in(removedAssignmentIds)).execute();
            for (JsonNode a : pkgAssignments.values()) {
                if (!pkgEquipment.containsKey(text(a, "equipmentId"))) continue;
                upsertScheduleAssignment(tx, a, text(s, "id"), siteId, now);
            }
        }

        // ---- New RELEASED SiteVersion carrying this exact `files` bundle, then flip the pointer ----
        SiteRecord siteRow = tx.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        int versionNumber = nextVersionNumber(tx, siteId);
        SiteversionRecord siteVersion = tx.newRecord(SITEVERSION);
        siteVersion.setId(UUID.randomUUID().toString());
        siteVersion.setSiteid(siteId);
        siteVersion.setVersionnumber(versionNumber);
        siteVersion.setStatus(Siteversionstatus.RELEASED);
        siteVersion.setDeployedat(now);
        siteVersion.setParentversionid(siteRow.getActivereleaseversionid());
        siteVersion.setNotes(notes);
        siteVersion.setCreatedat(now);
        siteVersion.setUpdatedat(now);
        siteVersion.insert();

        var payloadNode = json.newObject();
        for (var entry : files.entrySet()) payloadNode.set(entry.getKey(), entry.getValue());
        var payloadRecord = tx.newRecord(SITEVERSIONPAYLOAD);
        payloadRecord.setId(UUID.randomUUID().toString());
        payloadRecord.setSiteversionid(siteVersion.getId());
        payloadRecord.setPayloadjson(json.toJsonb(payloadNode));
        payloadRecord.insert();

        tx.update(SITE).set(SITE.ACTIVERELEASEVERSIONID, siteVersion.getId()).where(SITE.ID.eq(siteId)).execute();

        // This IS the activation event for an LS-100 (there is no separate "deploy the working
        // state" step here — applying a package already means "make this Live"), so immediately
        // capture the ControllersMapped/PointsMapped rows just upserted above and materialize them
        // into the same LiveControllerBinding/LivePointBinding projection the same-database deploy
        // path uses — Runtime must resolve identically regardless of which pipeline activated it.
        LiveConfigService.CapturedLiveConfig captured = liveConfigService.captureLiveConfigForSite(tx, siteId);
        liveConfigService.materializeLiveConfigForSite(tx, siteId, siteVersion.getId(), captured.controllerBindings(), captured.pointBindings());

        return new ApplyResult(siteVersion.getId(), versionNumber);
    }

    private void upsertBuilding(DSLContext tx, JsonNode b, String siteId, LocalDateTime now) {
        String id = text(b, "id");
        BuildingRecord existing = tx.selectFrom(BUILDING).where(BUILDING.ID.eq(id)).fetchOne();
        BuildingRecord r = existing != null ? existing : tx.newRecord(BUILDING);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setSiteid(siteId);
        r.setName(text(b, "name"));
        r.setAddressline1(text(b, "addressLine1") != null ? text(b, "addressLine1") : "");
        r.setAddressline2(text(b, "addressLine2"));
        r.setCity(text(b, "city") != null ? text(b, "city") : "");
        r.setState(text(b, "state") != null ? text(b, "state") : "");
        r.setPostalcode(text(b, "postalCode") != null ? text(b, "postalCode") : "");
        r.setCountry(text(b, "country") != null ? text(b, "country") : "");
        r.setLatitude(doubleOrNull(b, "latitude"));
        r.setLongitude(doubleOrNull(b, "longitude"));
        r.setStatus(text(b, "status") != null ? Entitystatus.valueOf(text(b, "status")) : Entitystatus.ACTIVE);
        r.setBuildingtype(text(b, "buildingType"));
        r.setBuildingcode(text(b, "buildingCode"));
        r.setDescription(text(b, "description"));
        r.setSortorder(intOrNull(b, "sortOrder") != null ? intOrNull(b, "sortOrder") : 0);
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertFloor(DSLContext tx, JsonNode f, LocalDateTime now) {
        String id = text(f, "id");
        FloorRecord existing = tx.selectFrom(FLOOR).where(FLOOR.ID.eq(id)).fetchOne();
        FloorRecord r = existing != null ? existing : tx.newRecord(FLOOR);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setBuildingid(text(f, "buildingId"));
        r.setName(text(f, "name"));
        r.setStatus(text(f, "status") != null ? Entitystatus.valueOf(text(f, "status")) : Entitystatus.ACTIVE);
        r.setDisplaylabel(text(f, "displayLabel"));
        r.setFloortype(text(f, "floorType"));
        r.setOccupancytype(text(f, "occupancyType"));
        r.setSortorder(intOrNull(f, "sortOrder") != null ? intOrNull(f, "sortOrder") : 0);
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertEquipment(DSLContext tx, JsonNode e, String siteId, LocalDateTime now) {
        String id = text(e, "id");
        EquipmentRecord existing = tx.selectFrom(EQUIPMENT).where(EQUIPMENT.ID.eq(id)).fetchOne();
        EquipmentRecord r = existing != null ? existing : tx.newRecord(EQUIPMENT);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setSiteid(siteId);
        r.setBuildingid(text(e, "buildingId"));
        r.setFloorid(text(e, "floorId"));
        r.setName(text(e, "name"));
        r.setCode(text(e, "code"));
        r.setEquipmenttype(text(e, "equipmentType"));
        r.setTemplatename(text(e, "templateName"));
        r.setAddress(text(e, "address"));
        r.setInstancenumber(text(e, "instanceNumber"));
        r.setStatus(text(e, "status") != null ? Entitystatus.valueOf(text(e, "status")) : Entitystatus.ACTIVE);
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertPoint(DSLContext tx, JsonNode p, String siteId, JsonNode eq, LocalDateTime now) {
        String id = text(p, "id");
        PointRecord existing = tx.selectFrom(POINT).where(POINT.ID.eq(id)).fetchOne();
        PointRecord r = existing != null ? existing : tx.newRecord(POINT);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setEquipmentid(text(p, "equipmentId"));
        r.setSiteid(siteId);
        r.setBuildingid(text(eq, "buildingId"));
        r.setFloorid(text(eq, "floorId"));
        r.setPointname(text(p, "pointName"));
        r.setPointcode(text(p, "pointCode"));
        r.setPointtype(text(p, "pointType"));
        r.setUnit(text(p, "unit"));
        r.setWritable(Boolean.TRUE.equals(bool(p, "writable")));
        r.setStatus(text(p, "status") != null ? Entitystatus.valueOf(text(p, "status")) : Entitystatus.ACTIVE);
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertController(DSLContext tx, JsonNode c, String siteId, JsonNode eq, LocalDateTime now) {
        String id = text(c, "id");
        ControllersmappedRecord existing = tx.selectFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.ID.eq(id)).fetchOne();
        ControllersmappedRecord r = existing != null ? existing : tx.newRecord(CONTROLLERSMAPPED);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setEquipmentid(text(c, "equipmentId"));
        r.setControllercode(text(c, "controllerCode"));
        r.setDisplayname(text(c, "displayName"));
        r.setProtocol(text(c, "protocol"));
        r.setDeviceinstance(text(c, "deviceInstance"));
        r.setIpaddress(text(c, "ipAddress"));
        r.setNetworkaddress(text(c, "networkAddress"));
        r.setSiteid(siteId);
        r.setBuildingid(text(eq, "buildingId"));
        r.setFloorid(text(eq, "floorId"));
        Integer pollRateMs = intOrNull(c, "pollRateMs");
        r.setPollratems(pollRateMs != null ? pollRateMs : 5000);
        r.setIssimulated(Boolean.TRUE.equals(bool(c, "isSimulated")));
        r.setIsenabled(!Boolean.FALSE.equals(bool(c, "isEnabled")));
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertPointMapping(DSLContext tx, JsonNode m, LocalDateTime now) {
        String id = text(m, "id");
        PointsmappedRecord existing = tx.selectFrom(POINTSMAPPED).where(POINTSMAPPED.ID.eq(id)).fetchOne();
        PointsmappedRecord r = existing != null ? existing : tx.newRecord(POINTSMAPPED);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setEquipmentcontrollerid(text(m, "equipmentControllerId"));
        r.setEquipmentid(text(m, "equipmentId"));
        r.setPointid(text(m, "pointId"));
        r.setLegionpointcode(text(m, "legionPointCode"));
        r.setFieldpointkey(text(m, "fieldPointKey"));
        r.setFieldpointname(text(m, "fieldPointName"));
        r.setFieldobjecttype(text(m, "fieldObjectType"));
        r.setFieldobjectinstance(text(m, "fieldObjectInstance"));
        r.setFielddatatype(text(m, "fieldDataType"));
        r.setReadenabled(!Boolean.FALSE.equals(bool(m, "readEnabled")));
        r.setWriteenabled(Boolean.TRUE.equals(bool(m, "writeEnabled")));
        r.setIsbound(!Boolean.FALSE.equals(bool(m, "isBound")));
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertAlarm(DSLContext tx, JsonNode a, String siteId, LocalDateTime now) {
        String id = text(a, "id");
        AlarmdefinitionRecord existing = tx.selectFrom(ALARMDEFINITION).where(ALARMDEFINITION.ID.eq(id)).fetchOne();
        AlarmdefinitionRecord r = existing != null ? existing : tx.newRecord(ALARMDEFINITION);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setSiteid(siteId);
        r.setEquipmentid(text(a, "equipmentId"));
        r.setBuildingid(text(a, "buildingId"));
        r.setFloorid(text(a, "floorId"));
        r.setPointkey(text(a, "pointKey"));
        r.setPointid(text(a, "pointId"));
        r.setName(text(a, "name"));
        r.setEnabled(!Boolean.FALSE.equals(bool(a, "enabled")));
        r.setSeverity(Alarmseverity.valueOf(text(a, "severity")));
        r.setCategory(Alarmrulecategory.valueOf(text(a, "category")));
        r.setOperator(Alarmoperator.valueOf(text(a, "operator")));
        r.setTargetvalue(doubleOrNull(a, "targetValue"));
        r.setTargetpointid(text(a, "targetPointId"));
        r.setTargetpointkey(text(a, "targetPointKey"));
        r.setDeadband(doubleOrNull(a, "deadband"));
        r.setDelayseconds(intOrNull(a, "delaySeconds"));
        r.setMessagetemplate(text(a, "messageTemplate"));
        r.setAutoacknowledge(Boolean.TRUE.equals(bool(a, "autoAcknowledge")));
        JsonNode conditionTree = a.get("conditionTree");
        r.setConditiontree(conditionTree != null && !conditionTree.isNull() ? json.toJsonb(conditionTree) : null);
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertTrendDefinition(DSLContext tx, JsonNode t, String siteId, LocalDateTime now) {
        String id = text(t, "id");
        TrenddefinitionRecord existing = tx.selectFrom(TRENDDEFINITION).where(TRENDDEFINITION.ID.eq(id)).fetchOne();
        TrenddefinitionRecord r = existing != null ? existing : tx.newRecord(TRENDDEFINITION);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setSiteid(siteId);
        r.setName(text(t, "name"));
        r.setEnabled(!Boolean.FALSE.equals(bool(t, "enabled")));
        r.setIstemplate(Boolean.TRUE.equals(bool(t, "isTemplate")));
        r.setEquipmenttype(text(t, "equipmentType"));
        r.setSampleinterval(intOrNull(t, "sampleInterval"));
        Integer retentionDays = intOrNull(t, "retentionDays");
        r.setRetentiondays(retentionDays != null ? retentionDays : 30);
        JsonNode pointRequirements = t.get("pointRequirements");
        r.setPointrequirements(json.toJsonb(pointRequirements != null ? pointRequirements : json.newArray()));
        Integer version = intOrNull(t, "version");
        r.setVersion(version != null ? version : 1);
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertTrendAssignment(DSLContext tx, JsonNode a, String definitionId, String siteId, LocalDateTime now) {
        String id = text(a, "id");
        TrendassignmentRecord existing = tx.selectFrom(TRENDASSIGNMENT).where(TRENDASSIGNMENT.ID.eq(id)).fetchOne();
        TrendassignmentRecord r = existing != null ? existing : tx.newRecord(TRENDASSIGNMENT);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setDefinitionid(definitionId);
        r.setSiteid(siteId);
        r.setEquipmentid(text(a, "equipmentId"));
        r.setEnabled(!Boolean.FALSE.equals(bool(a, "enabled")));
        JsonNode resolvedMappings = a.get("resolvedMappings");
        r.setResolvedmappings(json.toJsonb(resolvedMappings != null ? resolvedMappings : json.newObject()));
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertScheduleDefinition(DSLContext tx, JsonNode s, String siteId, LocalDateTime now) {
        String id = text(s, "id");
        ScheduledefinitionRecord existing = tx.selectFrom(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.ID.eq(id)).fetchOne();
        ScheduledefinitionRecord r = existing != null ? existing : tx.newRecord(SCHEDULEDEFINITION);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setSiteid(siteId);
        r.setName(text(s, "name"));
        r.setEnabled(!Boolean.FALSE.equals(bool(s, "enabled")));
        r.setIstemplate(Boolean.TRUE.equals(bool(s, "isTemplate")));
        JsonNode weeklyWindows = s.get("weeklyWindows");
        r.setWeeklywindows(json.toJsonb(weeklyWindows != null ? weeklyWindows : json.newArray()));
        Integer version = intOrNull(s, "version");
        r.setVersion(version != null ? version : 1);
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }

    private void upsertScheduleAssignment(DSLContext tx, JsonNode a, String definitionId, String siteId, LocalDateTime now) {
        String id = text(a, "id");
        ScheduleassignmentRecord existing = tx.selectFrom(SCHEDULEASSIGNMENT).where(SCHEDULEASSIGNMENT.ID.eq(id)).fetchOne();
        ScheduleassignmentRecord r = existing != null ? existing : tx.newRecord(SCHEDULEASSIGNMENT);
        if (existing == null) { r.setId(id); r.setCreatedat(now); }
        r.setDefinitionid(definitionId);
        r.setSiteid(siteId);
        r.setEquipmentid(text(a, "equipmentId"));
        r.setEnabled(!Boolean.FALSE.equals(bool(a, "enabled")));
        r.setUpdatedat(now);
        if (existing == null) r.insert(); else r.update();
    }
}
