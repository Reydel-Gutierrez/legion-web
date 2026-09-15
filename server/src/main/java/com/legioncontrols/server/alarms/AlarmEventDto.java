package com.legioncontrols.server.alarms;

import com.legioncontrols.server.jooq.generated.tables.records.AlarmeventRecord;
import java.time.LocalDateTime;

public record AlarmEventDto(
    String id, String alarmDefinitionId, String siteId, String equipmentId, String pointId,
    String state, boolean ack, LocalDateTime occurredAt, LocalDateTime clearedAt,
    LocalDateTime lastEvaluatedAt, String activeValue, String clearValue, String message,
    Integer durationSeconds, LocalDateTime createdAt, LocalDateTime updatedAt,
    DefinitionRefDto definition
) {
    public record DefinitionRefDto(String id, String name, String pointKey, AlarmDefinitionDto.PointRefDto point, EquipmentRefDto equipment) {
    }

    public record EquipmentRefDto(String id, String name, String equipmentType) {
    }

    public static AlarmEventDto from(AlarmeventRecord r, DefinitionRefDto definition) {
        return new AlarmEventDto(
            r.getId(), r.getAlarmdefinitionid(), r.getSiteid(), r.getEquipmentid(), r.getPointid(),
            r.getState() != null ? r.getState().getLiteral() : null, Boolean.TRUE.equals(r.getAck()),
            r.getOccurredat(), r.getClearedat(), r.getLastevaluatedat(), r.getActivevalue(), r.getClearvalue(),
            r.getMessage(), r.getDurationseconds(), r.getCreatedat(), r.getUpdatedat(), definition
        );
    }
}
