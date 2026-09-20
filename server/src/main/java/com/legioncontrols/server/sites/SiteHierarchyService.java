package com.legioncontrols.server.sites;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.BuildingRecord;
import com.legioncontrols.server.jooq.generated.tables.records.FloorRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import java.util.Objects;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Result;
import org.springframework.stereotype.Service;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import static com.legioncontrols.server.jooq.generated.tables.Building.BUILDING;
import static com.legioncontrols.server.jooq.generated.tables.Controllersmapped.CONTROLLERSMAPPED;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Floor.FLOOR;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;

/**
 * Java equivalent of backend/src/modules/siteHierarchy/siteHierarchy.service.js's
 * buildWorkingSiteEquipmentFromDb — the canonical Site/Building/Floor/Equipment/Point hierarchy
 * read from Postgres, used to sync the Engineering working-version payload with relational truth
 * and to populate a release's operator-facing site/equipment snapshot at build time.
 */
@Service
public class SiteHierarchyService {

    private final DSLContext dsl;
    private final JsonUtil json;

    public SiteHierarchyService(DSLContext dsl, JsonUtil json) {
        this.dsl = dsl;
        this.json = json;
    }

    private static String formLabelFromEntityStatus(String status) {
        if ("INACTIVE".equals(status)) return "Draft";
        if ("ARCHIVED".equals(status)) return "Archived";
        return "Active";
    }

    public record HierarchyResult(ObjectNode site, ArrayNode equipment) {
    }

    public HierarchyResult buildWorkingSiteEquipmentFromDb(String siteId) {
        SiteRecord siteRow = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        ArrayNode equipmentOut = json.newArray();
        if (siteRow == null) {
            return new HierarchyResult(null, equipmentOut);
        }

        ArrayNode buildingsOut = json.newArray();

        Result<BuildingRecord> buildings = dsl.selectFrom(BUILDING)
            .where(BUILDING.SITEID.eq(siteId))
            .orderBy(BUILDING.SORTORDER.asc(), BUILDING.NAME.asc())
            .fetch();

        for (BuildingRecord b : buildings) {
            String buildingId = b.get(BUILDING.ID);
            String buildingStatus = b.get(BUILDING.STATUS).getLiteral();
            String layoutStatus = "ACTIVE".equals(buildingStatus) ? "normal" : "warning";

            Result<FloorRecord> floors = dsl.selectFrom(FLOOR)
                .where(FLOOR.BUILDINGID.eq(buildingId))
                .orderBy(FLOOR.SORTORDER.asc(), FLOOR.NAME.asc())
                .fetch();

            ArrayNode floorsOut = json.newArray();
            for (FloorRecord f : floors) {
                ObjectNode floorNode = json.newObject();
                floorNode.put("id", f.get(FLOOR.ID));
                floorNode.put("name", f.get(FLOOR.NAME));
                String displayLabel = f.get(FLOOR.DISPLAYLABEL);
                floorNode.put("displayLabel", displayLabel != null && !displayLabel.isBlank() ? displayLabel : f.get(FLOOR.NAME));
                floorNode.put("sortOrder", Objects.requireNonNullElse(f.get(FLOOR.SORTORDER), 0));
                String floorType = f.get(FLOOR.FLOORTYPE);
                floorNode.put("floorType", floorType != null && !floorType.isBlank() ? floorType : "Standard Floor");
                String occupancyType = f.get(FLOOR.OCCUPANCYTYPE);
                floorNode.put("occupancyType", occupancyType != null ? occupancyType : "");
                floorsOut.add(floorNode);
            }

            ObjectNode buildingNode = json.newObject();
            buildingNode.put("id", buildingId);
            buildingNode.put("name", b.get(BUILDING.NAME));
            String buildingType = b.get(BUILDING.BUILDINGTYPE);
            buildingNode.put("buildingType", buildingType != null && !buildingType.isBlank() ? buildingType.trim() : "");
            String buildingCode = b.get(BUILDING.BUILDINGCODE);
            buildingNode.put("buildingCode", buildingCode != null ? buildingCode : "");
            String description = b.get(BUILDING.DESCRIPTION);
            buildingNode.put("description", description != null && !description.isBlank() ? description.trim() : "");
            buildingNode.put("address", b.get(BUILDING.ADDRESSLINE1));
            buildingNode.put("city", b.get(BUILDING.CITY));
            buildingNode.put("state", b.get(BUILDING.STATE));
            Double lat = b.get(BUILDING.LATITUDE);
            Double lng = b.get(BUILDING.LONGITUDE);
            if (lat != null) buildingNode.put("lat", lat); else buildingNode.putNull("lat");
            if (lng != null) buildingNode.put("lng", lng); else buildingNode.putNull("lng");
            buildingNode.put("status", formLabelFromEntityStatus(buildingStatus));
            buildingNode.put("layoutStatus", layoutStatus);
            buildingNode.put("sortOrder", Objects.requireNonNullElse(b.get(BUILDING.SORTORDER), 0));
            buildingNode.put("hasFloors", !floorsOut.isEmpty());
            buildingNode.set("floors", floorsOut);
            buildingsOut.add(buildingNode);

            for (FloorRecord f : floors) {
                String floorId = f.get(FLOOR.ID);
                Result<Record> equipmentRows = dsl.select(EQUIPMENT.fields())
                    .select(CONTROLLERSMAPPED.CONTROLLERCODE, CONTROLLERSMAPPED.DEVICEINSTANCE, CONTROLLERSMAPPED.PROTOCOL)
                    .from(EQUIPMENT)
                    .leftJoin(CONTROLLERSMAPPED).on(CONTROLLERSMAPPED.EQUIPMENTID.eq(EQUIPMENT.ID))
                    .where(EQUIPMENT.FLOORID.eq(floorId))
                    .orderBy(EQUIPMENT.NAME.asc())
                    .fetch();

                for (Record eq : equipmentRows) {
                    String equipmentId = eq.get(EQUIPMENT.ID);
                    Result<PointRecord> points = dsl.selectFrom(POINT)
                        .where(POINT.EQUIPMENTID.eq(equipmentId))
                        .orderBy(POINT.POINTCODE.asc())
                        .fetch();

                    ArrayNode livePoints = json.newArray();
                    for (PointRecord p : points) {
                        livePoints.add(pointToWorkspaceRow(equipmentId, eq.get(EQUIPMENT.NAME), p));
                    }

                    String controllerCode = eq.get(CONTROLLERSMAPPED.CONTROLLERCODE);
                    String eqStatus = eq.get(EQUIPMENT.STATUS).getLiteral();
                    String engStatus = controllerCode != null
                        ? "CONTROLLER_ASSIGNED"
                        : "ACTIVE".equals(eqStatus) ? "MISSING_CONTROLLER" : "DRAFT";

                    ObjectNode equipmentNode = json.newObject();
                    equipmentNode.put("id", equipmentId);
                    equipmentNode.put("floorId", eq.get(EQUIPMENT.FLOORID));
                    equipmentNode.put("siteId", eq.get(EQUIPMENT.SITEID));
                    equipmentNode.put("buildingId", eq.get(EQUIPMENT.BUILDINGID));
                    equipmentNode.put("name", eq.get(EQUIPMENT.NAME));
                    equipmentNode.put("displayLabel", eq.get(EQUIPMENT.NAME));
                    equipmentNode.put("type", eq.get(EQUIPMENT.EQUIPMENTTYPE));
                    String instanceNumber = eq.get(EQUIPMENT.INSTANCENUMBER);
                    if (instanceNumber != null) equipmentNode.put("instanceNumber", instanceNumber); else equipmentNode.putNull("instanceNumber");
                    equipmentNode.put("equipmentType", eq.get(EQUIPMENT.EQUIPMENTTYPE));
                    String address = eq.get(EQUIPMENT.ADDRESS);
                    equipmentNode.put("address", address != null ? address : "");
                    equipmentNode.put("locationLabel", "");
                    if (controllerCode != null) equipmentNode.put("controllerRef", controllerCode); else equipmentNode.putNull("controllerRef");
                    String deviceInstance = eq.get(CONTROLLERSMAPPED.DEVICEINSTANCE);
                    if (deviceInstance != null) equipmentNode.put("deviceInstance", deviceInstance); else equipmentNode.putNull("deviceInstance");
                    String protocol = eq.get(CONTROLLERSMAPPED.PROTOCOL);
                    equipmentNode.put("protocol", controllerCode != null ? (protocol != null ? protocol : "BACnet/IP") : "API");
                    String templateName = eq.get(EQUIPMENT.TEMPLATENAME);
                    if (templateName != null) equipmentNode.put("templateName", templateName); else equipmentNode.putNull("templateName");
                    equipmentNode.put("pointsDefined", points.size());
                    equipmentNode.put("status", engStatus);
                    equipmentNode.put("notes", "");
                    equipmentNode.set("livePoints", livePoints);
                    equipmentOut.add(equipmentNode);
                }
            }
        }

        ObjectNode siteNode = json.newObject();
        siteNode.put("id", siteRow.getId());
        siteNode.put("name", siteRow.getName());
        siteNode.put("mode", "api");
        siteNode.put("status", "editing");
        siteNode.put("nodeStatus", formLabelFromEntityStatus(siteRow.getStatus().getLiteral()));
        siteNode.put("siteType", siteRow.getSitetype() != null ? siteRow.getSitetype() : "");
        siteNode.put("timezone", siteRow.getTimezone() != null ? siteRow.getTimezone() : "");
        siteNode.put("displayLabel", siteRow.getDisplaylabel() != null ? siteRow.getDisplaylabel() : siteRow.getName());
        siteNode.put("description", siteRow.getDescription() != null ? siteRow.getDescription() : "");
        siteNode.put("engineeringNotes", siteRow.getEngineeringnotes() != null ? siteRow.getEngineeringnotes() : "");
        siteNode.put("icon", siteRow.getIcon() != null ? siteRow.getIcon() : "");
        siteNode.set("buildings", buildingsOut);

        return new HierarchyResult(siteNode, equipmentOut);
    }

    private ObjectNode pointToWorkspaceRow(String equipmentId, String equipmentName, Record p) {
        String unit = p.get(POINT.UNIT);
        String units = unit != null ? unit : "";
        String presentValue = p.get(POINT.PRESENTVALUE);
        String val = presentValue != null && !presentValue.isEmpty() ? presentValue : "—";
        String valueStr = !units.isEmpty() ? (val + " " + units).trim() : val;
        String pointCode = p.get(POINT.POINTCODE);

        ObjectNode row = json.newObject();
        row.put("id", equipmentId + "-" + (pointCode != null ? pointCode : p.get(POINT.ID)));
        row.put("databasePointId", p.get(POINT.ID));
        row.put("equipmentId", equipmentId);
        row.put("equipmentName", equipmentName);
        row.put("pointId", pointCode);
        row.put("pointKey", pointCode);
        row.put("pointDescription", p.get(POINT.POINTNAME));
        row.put("pointName", p.get(POINT.POINTNAME));
        row.put("pointReferenceId", pointCode);
        row.put("value", valueStr);
        row.put("units", units);
        row.put("status", "ACTIVE".equals(p.get(POINT.STATUS).getLiteral()) ? "OK" : "Warn");
        row.put("writable", Boolean.TRUE.equals(p.get(POINT.WRITABLE)));
        return row;
    }
}
