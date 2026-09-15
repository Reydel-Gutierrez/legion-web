package com.legioncontrols.server.live;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.ControllersmappedRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointsmappedRecord;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Result;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import static com.legioncontrols.server.jooq.generated.tables.Controllersmapped.CONTROLLERSMAPPED;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Livecontrollerbinding.LIVECONTROLLERBINDING;
import static com.legioncontrols.server.jooq.generated.tables.Livepointbinding.LIVEPOINTBINDING;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;
import static com.legioncontrols.server.jooq.generated.tables.Pointsmapped.POINTSMAPPED;

/**
 * Java equivalent of backend/src/modules/runtime/liveConfig.service.js — the release-backed
 * boundary between Engineering-authored controller/point assignments (ControllersMapped/
 * PointsMapped — mutable, edited directly by Site Builder / Point Mapping) and what Runtime is
 * actually allowed to consume (LiveControllerBinding/LivePointBinding — read-only from Runtime's
 * perspective, written only here).
 *
 * {@link #captureLiveConfigForSite} runs at BUILD time: freezes current ControllersMapped/
 * PointsMapped rows into JSON, embedded in the immutable release payload.
 * {@link #materializeLiveConfigForSite} runs at DEPLOY/ROLLBACK time: replaces the site's Live
 * binding rows with exactly what the *activated release* captured — never with whatever
 * ControllersMapped/PointsMapped say at the moment of deploy. MUST run inside the same transaction
 * as flipping activeReleaseVersionId (see releases.ReleaseService#deployRelease).
 */
@Service
public class LiveConfigService {

    private final JsonUtil json;

    public LiveConfigService(JsonUtil json) {
        this.json = json;
    }

    public record CapturedLiveConfig(ArrayNode controllerBindings, ArrayNode pointBindings) {
    }

    public CapturedLiveConfig captureLiveConfigForSite(DSLContext dsl, String siteId) {
        Result<ControllersmappedRecord> controllers = dsl.selectFrom(CONTROLLERSMAPPED)
            .where(CONTROLLERSMAPPED.SITEID.eq(siteId))
            .fetch();

        List<String> controllerIds = controllers.map(ControllersmappedRecord::getId);

        Result<PointsmappedRecord> pointMappings = controllerIds.isEmpty()
            ? dsl.selectFrom(POINTSMAPPED).where(POINTSMAPPED.EQUIPMENTCONTROLLERID.in(List.of())).fetch()
            : dsl.selectFrom(POINTSMAPPED).where(POINTSMAPPED.EQUIPMENTCONTROLLERID.in(controllerIds)).fetch();

        ArrayNode controllerBindings = json.newArray();
        for (ControllersmappedRecord c : controllers) {
            ObjectNode node = json.newObject();
            node.put("equipmentId", c.getEquipmentid());
            node.put("controllerCode", c.getControllercode());
            putNullable(node, "displayName", c.getDisplayname());
            node.put("protocol", c.getProtocol());
            putNullable(node, "deviceInstance", c.getDeviceinstance());
            putNullable(node, "ipAddress", c.getIpaddress());
            putNullable(node, "networkAddress", c.getNetworkaddress());
            putNullable(node, "buildingId", c.getBuildingid());
            putNullable(node, "floorId", c.getFloorid());
            node.put("pollRateMs", c.getPollratems() != null ? c.getPollratems() : 5000);
            node.put("isSimulated", Boolean.TRUE.equals(c.getIssimulated()));
            node.put("isEnabled", !Boolean.FALSE.equals(c.getIsenabled()));
            controllerBindings.add(node);
        }

        ArrayNode pointBindings = json.newArray();
        for (PointsmappedRecord m : pointMappings) {
            ObjectNode node = json.newObject();
            node.put("equipmentId", m.getEquipmentid());
            node.put("pointId", m.getPointid());
            putNullable(node, "legionPointCode", m.getLegionpointcode());
            node.put("fieldPointKey", m.getFieldpointkey());
            putNullable(node, "fieldPointName", m.getFieldpointname());
            putNullable(node, "fieldObjectType", m.getFieldobjecttype());
            putNullable(node, "fieldObjectInstance", m.getFieldobjectinstance());
            putNullable(node, "fieldDataType", m.getFielddatatype());
            node.put("readEnabled", !Boolean.FALSE.equals(m.getReadenabled()));
            node.put("writeEnabled", Boolean.TRUE.equals(m.getWriteenabled()));
            node.put("isBound", !Boolean.FALSE.equals(m.getIsbound()));
            pointBindings.add(node);
        }

        return new CapturedLiveConfig(controllerBindings, pointBindings);
    }

    private static void putNullable(ObjectNode node, String field, String value) {
        if (value != null) node.put(field, value); else node.putNull(field);
    }

    /**
     * Replace a site's LiveControllerBinding/LivePointBinding rows with exactly what an activated
     * release captured. Caller MUST run this inside the same transaction as the
     * activeReleaseVersionId flip.
     */
    public void materializeLiveConfigForSite(DSLContext tx, String siteId, String releaseVersionId,
                                              JsonNode controllerBindings, JsonNode pointBindings) {
        ArrayNode bindings = controllerBindings instanceof ArrayNode a ? a : json.newArray();
        ArrayNode mappings = pointBindings instanceof ArrayNode a ? a : json.newArray();

        Set<String> equipmentIds = new HashSet<>();
        for (JsonNode b : bindings) {
            String equipmentId = textOrNull(b, "equipmentId");
            if (equipmentId != null) equipmentIds.add(equipmentId);
        }
        Set<String> existingEquipmentIds = equipmentIds.isEmpty()
            ? Set.of()
            : new HashSet<>(tx.select(EQUIPMENT.ID).from(EQUIPMENT).where(EQUIPMENT.ID.in(equipmentIds)).fetch(EQUIPMENT.ID));

        Set<String> pointIds = new HashSet<>();
        for (JsonNode m : mappings) {
            String pointId = textOrNull(m, "pointId");
            if (pointId != null) pointIds.add(pointId);
        }
        Set<String> existingPointIds = pointIds.isEmpty()
            ? Set.of()
            : new HashSet<>(tx.select(POINT.ID).from(POINT).where(POINT.ID.in(pointIds)).fetch(POINT.ID));

        // Wipe this site's current Live projection (cascades LivePointBinding via FK ON DELETE
        // CASCADE), then rebuild it whole — simpler and safer than diffing since this runs at most
        // once per deploy/rollback, not per poll.
        tx.deleteFrom(LIVECONTROLLERBINDING).where(LIVECONTROLLERBINDING.SITEID.eq(siteId)).execute();

        for (JsonNode b : bindings) {
            String equipmentId = textOrNull(b, "equipmentId");
            if (equipmentId == null || !existingEquipmentIds.contains(equipmentId)) continue;

            String bindingId = UUID.randomUUID().toString();
            LocalDateTime now = LocalDateTime.now();
            tx.insertInto(LIVECONTROLLERBINDING)
                .set(LIVECONTROLLERBINDING.ID, bindingId)
                .set(LIVECONTROLLERBINDING.SITEID, siteId)
                .set(LIVECONTROLLERBINDING.EQUIPMENTID, equipmentId)
                .set(LIVECONTROLLERBINDING.CONTROLLERCODE, textOrNull(b, "controllerCode"))
                .set(LIVECONTROLLERBINDING.DISPLAYNAME, textOrNull(b, "displayName"))
                .set(LIVECONTROLLERBINDING.PROTOCOL, textOrNull(b, "protocol"))
                .set(LIVECONTROLLERBINDING.DEVICEINSTANCE, textOrNull(b, "deviceInstance"))
                .set(LIVECONTROLLERBINDING.IPADDRESS, textOrNull(b, "ipAddress"))
                .set(LIVECONTROLLERBINDING.NETWORKADDRESS, textOrNull(b, "networkAddress"))
                .set(LIVECONTROLLERBINDING.BUILDINGID, textOrNull(b, "buildingId"))
                .set(LIVECONTROLLERBINDING.FLOORID, textOrNull(b, "floorId"))
                .set(LIVECONTROLLERBINDING.POLLRATEMS, b.hasNonNull("pollRateMs") ? b.get("pollRateMs").asInt() : 5000)
                .set(LIVECONTROLLERBINDING.ISSIMULATED, b.hasNonNull("isSimulated") && b.get("isSimulated").asBoolean())
                .set(LIVECONTROLLERBINDING.ISENABLED, !b.hasNonNull("isEnabled") || b.get("isEnabled").asBoolean())
                .set(LIVECONTROLLERBINDING.RELEASEVERSIONID, releaseVersionId)
                .set(LIVECONTROLLERBINDING.CREATEDAT, now)
                .set(LIVECONTROLLERBINDING.UPDATEDAT, now)
                .execute();

            for (JsonNode m : mappings) {
                if (!equipmentId.equals(textOrNull(m, "equipmentId"))) continue;
                String pointId = textOrNull(m, "pointId");
                if (pointId == null || !existingPointIds.contains(pointId)) continue;

                tx.insertInto(LIVEPOINTBINDING)
                    .set(LIVEPOINTBINDING.ID, UUID.randomUUID().toString())
                    .set(LIVEPOINTBINDING.LIVECONTROLLERBINDINGID, bindingId)
                    .set(LIVEPOINTBINDING.EQUIPMENTID, equipmentId)
                    .set(LIVEPOINTBINDING.POINTID, pointId)
                    .set(LIVEPOINTBINDING.LEGIONPOINTCODE, textOrNull(m, "legionPointCode"))
                    .set(LIVEPOINTBINDING.FIELDPOINTKEY, textOrNull(m, "fieldPointKey"))
                    .set(LIVEPOINTBINDING.FIELDPOINTNAME, textOrNull(m, "fieldPointName"))
                    .set(LIVEPOINTBINDING.FIELDOBJECTTYPE, textOrNull(m, "fieldObjectType"))
                    .set(LIVEPOINTBINDING.FIELDOBJECTINSTANCE, textOrNull(m, "fieldObjectInstance"))
                    .set(LIVEPOINTBINDING.FIELDDATATYPE, textOrNull(m, "fieldDataType"))
                    .set(LIVEPOINTBINDING.READENABLED, !m.hasNonNull("readEnabled") || m.get("readEnabled").asBoolean())
                    .set(LIVEPOINTBINDING.WRITEENABLED, m.hasNonNull("writeEnabled") && m.get("writeEnabled").asBoolean())
                    .set(LIVEPOINTBINDING.ISBOUND, !m.hasNonNull("isBound") || m.get("isBound").asBoolean())
                    .set(LIVEPOINTBINDING.CREATEDAT, now)
                    .set(LIVEPOINTBINDING.UPDATEDAT, now)
                    .execute();
            }
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && !value.isNull() ? value.asText() : null;
    }
}
