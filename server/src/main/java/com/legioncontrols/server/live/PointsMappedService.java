package com.legioncontrols.server.live;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.ControllersmappedRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointsmappedRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import static com.legioncontrols.server.jooq.generated.tables.Controllersmapped.CONTROLLERSMAPPED;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;
import static com.legioncontrols.server.jooq.generated.tables.Pointsmapped.POINTSMAPPED;

/**
 * Java equivalent of the CORE CRUD in backend/src/modules/pointMappings/pointMappings.service.js.
 * NOT ported: the Node version's zero-rows self-heal (syncSimCatalogBindingsForEquipmentId) — see
 * ControllersMappedService's class comment for the same deferral rationale.
 */
@Service
public class PointsMappedService {

    private final DSLContext dsl;
    private final JsonUtil json;

    public PointsMappedService(DSLContext dsl, JsonUtil json) {
        this.dsl = dsl;
        this.json = json;
    }

    public record BindRequest(String equipmentControllerId, String equipmentId, String pointId, String fieldPointKey,
                               String fieldPointName, String fieldObjectType, String fieldObjectInstance,
                               String fieldDataType, Boolean readEnabled, Boolean writeEnabled, JsonNode metadata) {
    }

    public PointsmappedRecord bind(BindRequest req) {
        if (isBlank(req.equipmentControllerId()) || isBlank(req.equipmentId()) || isBlank(req.pointId()) || isBlank(req.fieldPointKey())) {
            throw ApiException.badRequest("equipmentControllerId, equipmentId, pointId, and fieldPointKey are required");
        }
        String ecId = req.equipmentControllerId().trim();
        String eqId = req.equipmentId().trim();
        String ptId = req.pointId().trim();
        String fKey = req.fieldPointKey().trim();

        ControllersmappedRecord ctrl = dsl.selectFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.ID.eq(ecId)).fetchOne();
        if (ctrl == null) throw ApiException.notFound("ControllersMapped row not found");
        if (!ctrl.getEquipmentid().equals(eqId)) throw ApiException.badRequest("equipmentId does not match this controller assignment");

        PointRecord point = dsl.selectFrom(POINT).where(POINT.ID.eq(ptId)).fetchOne();
        if (point == null) throw ApiException.notFound("Point not found");
        if (!point.getEquipmentid().equals(eqId)) throw ApiException.badRequest("Point does not belong to the specified equipment");

        String legionCode = point.getPointcode();

        return dsl.transactionResult(cfg -> {
            var tx = org.jooq.impl.DSL.using(cfg);
            tx.deleteFrom(POINTSMAPPED)
                .where(POINTSMAPPED.EQUIPMENTCONTROLLERID.eq(ecId))
                .and(POINTSMAPPED.FIELDPOINTKEY.eq(fKey).or(POINTSMAPPED.POINTID.eq(ptId)))
                .execute();

            PointsmappedRecord record = tx.newRecord(POINTSMAPPED);
            record.setId(UUID.randomUUID().toString());
            record.setEquipmentcontrollerid(ecId);
            record.setEquipmentid(eqId);
            record.setPointid(ptId);
            record.setLegionpointcode(legionCode);
            record.setFieldpointkey(fKey);
            record.setFieldpointname(blankToNull(req.fieldPointName()));
            record.setFieldobjecttype(blankToNull(req.fieldObjectType()));
            record.setFieldobjectinstance(blankToNull(req.fieldObjectInstance()));
            record.setFielddatatype(blankToNull(req.fieldDataType()));
            record.setReadenabled(req.readEnabled() == null || req.readEnabled());
            record.setWriteenabled(Boolean.TRUE.equals(req.writeEnabled()));
            record.setIsbound(true);
            if (req.metadata() != null) record.setMetadatajson(json.toJsonb(req.metadata()));
            LocalDateTime now = LocalDateTime.now();
            record.setCreatedat(now);
            record.setUpdatedat(now);
            record.insert();
            return record;
        });
    }

    public List<PointsmappedRecord> listByController(String equipmentControllerId) {
        return dsl.selectFrom(POINTSMAPPED).where(POINTSMAPPED.EQUIPMENTCONTROLLERID.eq(equipmentControllerId.trim()))
            .orderBy(POINTSMAPPED.FIELDPOINTKEY.asc()).fetch();
    }

    public List<PointsmappedRecord> listByEquipment(String equipmentId) {
        return dsl.selectFrom(POINTSMAPPED).where(POINTSMAPPED.EQUIPMENTID.eq(equipmentId.trim()))
            .orderBy(POINTSMAPPED.FIELDPOINTKEY.asc()).fetch();
    }

    public PointsmappedRecord update(String id, JsonNode body) {
        PointsmappedRecord existing = dsl.selectFrom(POINTSMAPPED).where(POINTSMAPPED.ID.eq(id.trim())).fetchOne();
        if (existing == null) throw ApiException.notFound("PointsMapped row not found");

        boolean changed = false;
        if (body.has("fieldPointName")) { existing.setFieldpointname(nullableTrim(body.get("fieldPointName"))); changed = true; }
        if (body.has("fieldObjectType")) { existing.setFieldobjecttype(nullableTrim(body.get("fieldObjectType"))); changed = true; }
        if (body.has("fieldObjectInstance")) { existing.setFieldobjectinstance(nullableTrim(body.get("fieldObjectInstance"))); changed = true; }
        if (body.has("fieldDataType")) { existing.setFielddatatype(nullableTrim(body.get("fieldDataType"))); changed = true; }
        if (body.has("readEnabled")) { existing.setReadenabled(body.get("readEnabled").asBoolean()); changed = true; }
        if (body.has("writeEnabled")) { existing.setWriteenabled(body.get("writeEnabled").asBoolean()); changed = true; }
        if (body.has("isBound")) { existing.setIsbound(body.get("isBound").asBoolean()); changed = true; }
        if (body.has("metadata")) { existing.setMetadatajson(body.get("metadata").isNull() ? null : json.toJsonb(body.get("metadata"))); changed = true; }
        if (!changed) throw ApiException.badRequest("No fields to update");

        existing.setUpdatedat(LocalDateTime.now());
        existing.update();
        return existing;
    }

    public void remove(String id) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(POINTSMAPPED).where(POINTSMAPPED.ID.eq(id.trim())));
        if (!exists) throw ApiException.notFound("PointsMapped row not found");
        dsl.deleteFrom(POINTSMAPPED).where(POINTSMAPPED.ID.eq(id.trim())).execute();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String nullableTrim(JsonNode node) {
        if (node == null || node.isNull()) return null;
        String trimmed = node.asText().trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
