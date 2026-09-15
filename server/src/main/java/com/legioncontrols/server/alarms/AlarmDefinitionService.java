package com.legioncontrols.server.alarms;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.enums.Alarmoperator;
import com.legioncontrols.server.jooq.generated.enums.Alarmrulecategory;
import com.legioncontrols.server.jooq.generated.enums.Alarmseverity;
import com.legioncontrols.server.jooq.generated.tables.records.AlarmdefinitionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import static com.legioncontrols.server.jooq.generated.tables.Alarmdefinition.ALARMDEFINITION;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static org.jooq.impl.DSL.trueCondition;

/** Java equivalent of the definition-CRUD half of backend/src/modules/alarms/alarm.service.js. */
@Service
public class AlarmDefinitionService {

    private final DSLContext dsl;
    private final JsonUtil json;
    private final AlarmEvaluationService evaluationService;

    public AlarmDefinitionService(DSLContext dsl, JsonUtil json, AlarmEvaluationService evaluationService) {
        this.dsl = dsl;
        this.json = json;
        this.evaluationService = evaluationService;
    }

    private void assertSite(String siteId) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)));
        if (!exists) throw ApiException.notFound("Site not found");
    }

    private AlarmDefinitionDto toDto(AlarmdefinitionRecord r) {
        JsonNode tree = r.getConditiontree() != null ? json.toJsonNode(r.getConditiontree()) : null;
        AlarmDefinitionDto.PointRefDto point = fetchPointRef(r.getPointid());
        AlarmDefinitionDto.PointRefDto targetPoint = fetchPointRef(r.getTargetpointid());
        return AlarmDefinitionDto.from(r, tree, point, targetPoint);
    }

    private AlarmDefinitionDto.PointRefDto fetchPointRef(String pointId) {
        if (pointId == null) return null;
        PointRecord p = dsl.selectFrom(POINT).where(POINT.ID.eq(pointId)).fetchOne();
        return p != null ? new AlarmDefinitionDto.PointRefDto(p.getId(), p.getPointname(), p.getPointcode(), p.getPresentvalue()) : null;
    }

    public record ListQuery(String equipmentId, String pointId, String pointKey) {
    }

    public List<AlarmDefinitionDto> listDefinitions(String siteId, ListQuery query) {
        assertSite(siteId);
        Condition condition = ALARMDEFINITION.SITEID.eq(siteId);
        if (query.equipmentId() != null) condition = condition.and(ALARMDEFINITION.EQUIPMENTID.eq(query.equipmentId()));
        if (query.pointId() != null) condition = condition.and(ALARMDEFINITION.POINTID.eq(query.pointId()));
        if (query.pointKey() != null) condition = condition.and(ALARMDEFINITION.POINTKEY.eq(query.pointKey()));
        return dsl.selectFrom(ALARMDEFINITION).where(condition).orderBy(ALARMDEFINITION.UPDATEDAT.desc())
            .fetch().stream().map(this::toDto).toList();
    }

    private static Alarmseverity severityOrDefault(String value) {
        return value != null ? Alarmseverity.valueOf(value.toUpperCase()) : Alarmseverity.WARNING;
    }

    public record CreateDefinitionRequest(String equipmentId, String pointKey, String pointId, String name,
                                           Boolean enabled, String severity, String category, String operator,
                                           Double targetValue, String targetPointId, String targetPointKey,
                                           Double deadband, Integer delaySeconds, String messageTemplate,
                                           Boolean autoAcknowledge, JsonNode conditionTree, String buildingId, String floorId) {
    }

    public AlarmDefinitionDto createDefinition(String siteId, CreateDefinitionRequest req) {
        assertSite(siteId);
        if (isBlank(req.equipmentId()) || isBlank(req.name()) || isBlank(req.category()) || isBlank(req.operator())) {
            throw ApiException.badRequest("equipmentId, name, category, and operator are required");
        }
        String pk = req.pointKey() != null ? req.pointKey().trim() : "";
        if (pk.isEmpty()) {
            throw ApiException.badRequest("pointKey is required (template / logical point identifier)");
        }

        EquipmentRecord equipment = dsl.selectFrom(EQUIPMENT)
            .where(EQUIPMENT.ID.eq(req.equipmentId()), EQUIPMENT.SITEID.eq(siteId)).fetchOne();
        if (equipment == null) throw ApiException.notFound("Equipment not found for this site");

        Alarmrulecategory category = Alarmrulecategory.valueOf(req.category().toUpperCase());
        if (req.conditionTree() == null && (category == Alarmrulecategory.DEVIATION || category == Alarmrulecategory.COMPARISON)) {
            boolean hasTarget = (req.targetPointId() != null && !req.targetPointId().isBlank())
                || (req.targetPointKey() != null && !req.targetPointKey().isBlank());
            if (!hasTarget) throw ApiException.badRequest("targetPointId or targetPointKey is required for this rule type");
            if (req.targetPointKey() != null && req.targetPointKey().trim().equals(pk)) {
                throw ApiException.badRequest("targetPointKey must differ from pointKey");
            }
        }

        PointRecord resolvedSource = req.pointId() != null
            ? requireOne(dsl.selectFrom(POINT).where(POINT.ID.eq(req.pointId()), POINT.SITEID.eq(siteId), POINT.EQUIPMENTID.eq(req.equipmentId())).fetchOne(), "pointId not found for this equipment/site")
            : dsl.selectFrom(POINT).where(POINT.SITEID.eq(siteId), POINT.EQUIPMENTID.eq(req.equipmentId()), POINT.POINTCODE.eq(pk)).fetchOne();

        if (req.targetPointId() != null) {
            PointRecord tp = dsl.selectFrom(POINT).where(POINT.ID.eq(req.targetPointId()), POINT.SITEID.eq(siteId), POINT.EQUIPMENTID.eq(req.equipmentId())).fetchOne();
            if (tp == null) throw ApiException.notFound("targetPoint not found on this equipment");
        }

        String tpk = req.targetPointId() == null && req.targetPointKey() != null && !req.targetPointKey().isBlank()
            ? req.targetPointKey().trim() : null;

        AlarmdefinitionRecord record = dsl.newRecord(ALARMDEFINITION);
        record.setId(UUID.randomUUID().toString());
        record.setSiteid(siteId);
        record.setBuildingid(req.buildingId() != null ? req.buildingId() : equipment.getBuildingid());
        record.setFloorid(req.floorId() != null ? req.floorId() : equipment.getFloorid());
        record.setEquipmentid(req.equipmentId());
        record.setPointkey(pk);
        record.setPointid(resolvedSource != null ? resolvedSource.getId() : null);
        record.setName(req.name().trim());
        record.setEnabled(req.enabled() == null || req.enabled());
        record.setSeverity(severityOrDefault(req.severity()));
        record.setCategory(category);
        record.setOperator(Alarmoperator.valueOf(req.operator().toUpperCase()));
        record.setTargetvalue(req.targetValue());
        record.setTargetpointid(req.targetPointId());
        record.setTargetpointkey(tpk);
        record.setDeadband(req.deadband());
        record.setDelayseconds(req.delaySeconds());
        record.setMessagetemplate(req.messageTemplate());
        record.setAutoacknowledge(Boolean.TRUE.equals(req.autoAcknowledge()));
        if (req.conditionTree() != null && req.conditionTree().isObject()) {
            record.setConditiontree(json.toJsonb(req.conditionTree()));
        }
        record.setCreatedat(LocalDateTime.now());
        record.setUpdatedat(LocalDateTime.now());
        record.insert();
        record.refresh();

        evaluationService.evaluateDefinitionById(record.getId());
        AlarmdefinitionRecord fresh = dsl.selectFrom(ALARMDEFINITION).where(ALARMDEFINITION.ID.eq(record.getId())).fetchOne();
        return toDto(fresh);
    }

    /**
     * Takes the raw request body as a JsonNode (rather than a typed record) so PATCH semantics —
     * "field omitted" vs. "field explicitly null" — can be distinguished via
     * {@code JsonNode.has(field)}, exactly matching the Node controller's
     * {@code body.field !== undefined} checks. A typed record loses that distinction once Jackson
     * has deserialized it.
     */
    public AlarmDefinitionDto updateDefinition(String siteId, String definitionId, JsonNode body) {
        AlarmdefinitionRecord existing = dsl.selectFrom(ALARMDEFINITION)
            .where(ALARMDEFINITION.ID.eq(definitionId), ALARMDEFINITION.SITEID.eq(siteId)).fetchOne();
        if (existing == null) throw ApiException.notFound("Alarm definition not found");

        boolean changed = false;
        if (body.has("name")) { existing.setName(body.get("name").asText().trim()); changed = true; }
        if (body.has("enabled")) { existing.setEnabled(body.get("enabled").asBoolean()); changed = true; }
        if (body.has("severity")) { existing.setSeverity(Alarmseverity.valueOf(body.get("severity").asText().toUpperCase())); changed = true; }
        if (body.has("category")) { existing.setCategory(Alarmrulecategory.valueOf(body.get("category").asText().toUpperCase())); changed = true; }
        if (body.has("operator")) { existing.setOperator(Alarmoperator.valueOf(body.get("operator").asText().toUpperCase())); changed = true; }
        if (body.has("targetValue")) {
            existing.setTargetvalue(body.get("targetValue").isNull() ? null : body.get("targetValue").asDouble());
            changed = true;
        }
        if (body.has("pointKey")) {
            String pk = body.get("pointKey").asText("").trim();
            if (pk.isEmpty()) throw ApiException.badRequest("pointKey cannot be empty");
            existing.setPointkey(pk);
            changed = true;
        }
        if (body.has("pointId")) {
            String pointId = body.get("pointId").isNull() ? null : body.get("pointId").asText();
            if (pointId != null) {
                PointRecord p = dsl.selectFrom(POINT).where(POINT.ID.eq(pointId), POINT.SITEID.eq(siteId), POINT.EQUIPMENTID.eq(existing.getEquipmentid())).fetchOne();
                if (p == null) throw ApiException.notFound("pointId not found on this equipment");
            }
            existing.setPointid(pointId);
            changed = true;
        }
        if (body.has("targetPointId")) {
            String targetPointId = body.get("targetPointId").isNull() ? null : body.get("targetPointId").asText();
            if (targetPointId != null) {
                PointRecord tp = dsl.selectFrom(POINT).where(POINT.ID.eq(targetPointId), POINT.SITEID.eq(siteId), POINT.EQUIPMENTID.eq(existing.getEquipmentid())).fetchOne();
                if (tp == null) throw ApiException.notFound("targetPoint not found on this equipment");
            }
            existing.setTargetpointid(targetPointId);
            changed = true;
        }
        if (body.has("targetPointKey")) {
            String tpk = body.get("targetPointKey").isNull() ? null : body.get("targetPointKey").asText().trim();
            existing.setTargetpointkey(tpk != null && !tpk.isBlank() ? tpk : null);
            changed = true;
        }
        if (body.has("deadband")) {
            existing.setDeadband(body.get("deadband").isNull() ? null : body.get("deadband").asDouble());
            changed = true;
        }
        if (body.has("delaySeconds")) {
            existing.setDelayseconds(body.get("delaySeconds").isNull() ? null : body.get("delaySeconds").asInt());
            changed = true;
        }
        if (body.has("messageTemplate")) {
            existing.setMessagetemplate(body.get("messageTemplate").isNull() ? null : body.get("messageTemplate").asText());
            changed = true;
        }
        if (body.has("autoAcknowledge")) { existing.setAutoacknowledge(body.get("autoAcknowledge").asBoolean()); changed = true; }
        if (body.has("conditionTree")) {
            JsonNode tree = body.get("conditionTree");
            if (tree != null && !tree.isNull() && !tree.isObject()) throw ApiException.badRequest("conditionTree must be an object");
            existing.setConditiontree(tree != null && !tree.isNull() ? json.toJsonb(tree) : null);
            changed = true;
        }
        if (!changed) throw ApiException.badRequest("No fields to update");

        existing.setUpdatedat(LocalDateTime.now());
        existing.update();

        evaluationService.clearDelayState(definitionId);
        evaluationService.evaluateDefinitionById(definitionId);
        AlarmdefinitionRecord fresh = dsl.selectFrom(ALARMDEFINITION).where(ALARMDEFINITION.ID.eq(definitionId)).fetchOne();
        return toDto(fresh);
    }

    public void deleteDefinition(String siteId, String definitionId) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(ALARMDEFINITION)
            .where(ALARMDEFINITION.ID.eq(definitionId), ALARMDEFINITION.SITEID.eq(siteId)));
        if (!exists) throw ApiException.notFound("Alarm definition not found");
        dsl.deleteFrom(ALARMDEFINITION).where(ALARMDEFINITION.ID.eq(definitionId)).execute();
        evaluationService.clearDelayState(definitionId);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static <T> T requireOne(T value, String message) {
        if (value == null) throw ApiException.notFound(message);
        return value;
    }
}
