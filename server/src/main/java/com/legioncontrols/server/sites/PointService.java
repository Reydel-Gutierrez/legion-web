package com.legioncontrols.server.sites;

import com.legioncontrols.server.alarms.AlarmEvaluationService;
import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.historian.HistorianService;
import com.legioncontrols.server.jooq.generated.enums.Entitystatus;
import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;

/**
 * Java equivalent of backend/src/modules/points/point.service.js. The Node version's
 * zero-points self-heal (lazily calling syncSimCatalogBindingsForEquipmentId) is a SIM-catalog/
 * BACnet-adjacent dev convenience intentionally NOT ported here — same category of deferred
 * convenience as the release-deploy SIM catalog resync (see ReleaseService); Express remains the
 * source of truth for that specific self-heal path until BACnet/SIM commissioning migrates.
 */
@Service
public class PointService {

    private static final Logger log = LoggerFactory.getLogger(PointService.class);

    private final DSLContext dsl;
    private final HistorianService historianService;
    private final AlarmEvaluationService alarmEvaluationService;

    public PointService(DSLContext dsl, HistorianService historianService, AlarmEvaluationService alarmEvaluationService) {
        this.dsl = dsl;
        this.historianService = historianService;
        this.alarmEvaluationService = alarmEvaluationService;
    }

    private EquipmentRecord getEquipmentContext(String equipmentId) {
        EquipmentRecord equipment = dsl.selectFrom(EQUIPMENT).where(EQUIPMENT.ID.eq(equipmentId)).fetchOne();
        if (equipment == null) {
            throw ApiException.notFound("Equipment not found");
        }
        return equipment;
    }

    public List<PointDto> listPointsByEquipment(String equipmentId) {
        getEquipmentContext(equipmentId);
        return dsl.selectFrom(POINT).where(POINT.EQUIPMENTID.eq(equipmentId)).orderBy(POINT.POINTNAME.asc())
            .fetch().stream().map(PointDto::from).toList();
    }

    public record CreatePointRequest(String pointName, String pointCode, String pointType, String unit,
                                      Boolean writable, String presentValue, String status) {
    }

    public PointRecord createPoint(String equipmentId, CreatePointRequest req) {
        EquipmentRecord equipment = getEquipmentContext(equipmentId);
        if (isBlank(req.pointName()) || isBlank(req.pointCode()) || isBlank(req.pointType())) {
            throw ApiException.badRequest("pointName, pointCode, and pointType are required");
        }

        PointRecord record = dsl.newRecord(POINT);
        record.setId(UUID.randomUUID().toString());
        record.setEquipmentid(equipmentId);
        record.setSiteid(equipment.getSiteid());
        record.setBuildingid(equipment.getBuildingid());
        record.setFloorid(equipment.getFloorid());
        record.setPointname(req.pointName().trim());
        record.setPointcode(req.pointCode().trim());
        record.setPointtype(req.pointType().trim());
        record.setUnit(req.unit() != null ? req.unit().trim() : null);
        record.setWritable(Boolean.TRUE.equals(req.writable()));
        record.setPresentvalue(req.presentValue());
        if (req.status() != null) record.setStatus(Entitystatus.valueOf(req.status().toUpperCase()));
        record.setCreatedat(LocalDateTime.now());
        record.setUpdatedat(LocalDateTime.now());
        record.insert();
        record.refresh();

        try {
            alarmEvaluationService.syncAlarmDefinitionsAfterPointWrite(record);
            alarmEvaluationService.evaluateForPointIds(List.of(record.getId()));
        } catch (Exception e) {
            log.warn("alarm sync after point create failed: {}", e.getMessage());
        }

        return record;
    }

    public PointRecord getPointRecordById(String id) {
        PointRecord point = dsl.selectFrom(POINT).where(POINT.ID.eq(id)).fetchOne();
        if (point == null) {
            throw ApiException.notFound("Point not found");
        }
        return point;
    }

    /**
     * Takes the raw request body as a JsonNode so PATCH semantics — "field omitted" vs. "field
     * explicitly null" — can be distinguished via {@code JsonNode.has(field)}, matching the Node
     * controller's {@code data[key] !== undefined} checks exactly (see AlarmDefinitionService's
     * updateDefinition for the same pattern and rationale).
     */
    public PointRecord updatePoint(String id, tools.jackson.databind.JsonNode body) {
        PointRecord existing = getPointRecordById(id);
        boolean changed = false;
        boolean pointCodeChanged = false;
        boolean presentValueSet = false;
        if (body.has("pointName")) { existing.setPointname(body.get("pointName").asText().trim()); changed = true; }
        if (body.has("pointCode")) { existing.setPointcode(body.get("pointCode").asText().trim()); changed = true; pointCodeChanged = true; }
        if (body.has("pointType")) { existing.setPointtype(body.get("pointType").asText().trim()); changed = true; }
        if (body.has("unit")) { existing.setUnit(body.get("unit").isNull() ? null : body.get("unit").asText()); changed = true; }
        if (body.has("writable")) { existing.setWritable(body.get("writable").asBoolean()); changed = true; }
        if (body.has("presentValue")) {
            existing.setPresentvalue(body.get("presentValue").isNull() ? null : body.get("presentValue").asText());
            changed = true;
            presentValueSet = true;
        }
        if (body.has("status")) { existing.setStatus(Entitystatus.valueOf(body.get("status").asText().toUpperCase())); changed = true; }
        LocalDateTime lastSeenAt = null;
        boolean lastSeenAtSet = body.has("lastSeenAt");
        if (lastSeenAtSet) {
            var node = body.get("lastSeenAt");
            lastSeenAt = (node == null || node.isNull() || node.asText("").isBlank())
                ? null
                : java.time.OffsetDateTime.parse(node.asText()).toLocalDateTime();
            existing.setLastseenat(lastSeenAt);
            changed = true;
        }
        if (body.has("commState")) {
            var node = body.get("commState");
            existing.setCommstate(node.isNull() || node.asText("").isBlank() ? null : node.asText().trim());
            changed = true;
        }
        if (!changed) {
            throw ApiException.badRequest("No fields to update");
        }
        existing.setUpdatedat(LocalDateTime.now());
        existing.update();

        // A manual/engineering point update is a real communication event for this point, so it
        // earns a historian sample the same as the SIM poll loop does — through the same
        // per-point sample-interval throttle, so a manual update in the same window as a SIM write
        // can never create a near-duplicate row.
        if (presentValueSet) {
            LocalDateTime sampleAt = lastSeenAtSet && lastSeenAt != null ? lastSeenAt : LocalDateTime.now();
            long sampleAtMs = sampleAt.toInstant(java.time.ZoneOffset.UTC).toEpochMilli();
            if (historianService.shouldRecordSample(id, sampleAtMs)) {
                try {
                    String quality = HistorianService.normalizeQuality(existing.getCommstate());
                    historianService.recordSample(new HistorianService.SampleEntry(id, existing.getPresentvalue(), quality, sampleAt));
                } catch (Exception e) {
                    log.warn("historian sample after point update failed: {}", e.getMessage());
                }
            }
        }

        try {
            if (pointCodeChanged) {
                alarmEvaluationService.syncAlarmDefinitionsAfterPointWrite(existing);
            }
            if (presentValueSet || pointCodeChanged) {
                alarmEvaluationService.evaluateForPointIds(List.of(id));
            }
        } catch (Exception e) {
            log.warn("alarm sync/evaluate after point update failed: {}", e.getMessage());
        }

        return existing;
    }

    public record HistoryResult(String range, java.util.Map<String, List<HistorianService.HistorySamplePoint>> samples) {
    }

    public HistoryResult getHistoryForPointIds(List<String> pointIds, String range) {
        String effectiveRange = range != null && !range.isBlank() ? range.trim() : "1h";
        return new HistoryResult(effectiveRange, historianService.getHistoryForPointIds(pointIds, effectiveRange));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
