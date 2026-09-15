package com.legioncontrols.server.alarms;

import com.legioncontrols.server.jooq.generated.tables.records.AlarmdefinitionRecord;
import java.time.LocalDateTime;
import tools.jackson.databind.JsonNode;

public record AlarmDefinitionDto(
    String id, String siteId, String buildingId, String floorId, String equipmentId,
    String pointKey, String pointId, String name, boolean enabled, String severity,
    String category, String operator, Double targetValue, String targetPointId, String targetPointKey,
    Double deadband, Integer delaySeconds, String messageTemplate, boolean autoAcknowledge,
    JsonNode conditionTree, LocalDateTime createdAt, LocalDateTime updatedAt,
    PointRefDto point, PointRefDto targetPoint, String sourceBinding
) {
    public record PointRefDto(String id, String pointName, String pointCode, String presentValue) {
    }

    public static AlarmDefinitionDto from(AlarmdefinitionRecord r, JsonNode conditionTree, PointRefDto point, PointRefDto targetPoint) {
        return new AlarmDefinitionDto(
            r.getId(), r.getSiteid(), r.getBuildingid(), r.getFloorid(), r.getEquipmentid(),
            r.getPointkey(), r.getPointid(), r.getName(), Boolean.TRUE.equals(r.getEnabled()),
            r.getSeverity() != null ? r.getSeverity().getLiteral() : null,
            r.getCategory() != null ? r.getCategory().getLiteral() : null,
            r.getOperator() != null ? r.getOperator().getLiteral() : null,
            r.getTargetvalue(), r.getTargetpointid(), r.getTargetpointkey(),
            r.getDeadband(), r.getDelayseconds(), r.getMessagetemplate(), Boolean.TRUE.equals(r.getAutoacknowledge()),
            conditionTree, r.getCreatedat(), r.getUpdatedat(),
            point, targetPoint,
            r.getPointid() != null ? "READY" : "PENDING_BINDING"
        );
    }
}
