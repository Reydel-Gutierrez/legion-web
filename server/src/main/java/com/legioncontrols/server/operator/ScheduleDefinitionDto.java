package com.legioncontrols.server.operator;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.ScheduleassignmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.ScheduledefinitionRecord;
import java.time.LocalDateTime;
import java.util.List;
import tools.jackson.databind.JsonNode;

public record ScheduleDefinitionDto(
    String id, String siteId, String name, boolean enabled, boolean isTemplate, JsonNode weeklyWindows,
    int version, LocalDateTime createdAt, LocalDateTime updatedAt, List<ScheduleAssignmentDto> assignments
) {
    public static ScheduleDefinitionDto from(ScheduledefinitionRecord r, List<ScheduleassignmentRecord> assignments, JsonUtil json) {
        return new ScheduleDefinitionDto(
            r.getId(), r.getSiteid(), r.getName(), Boolean.TRUE.equals(r.getEnabled()), Boolean.TRUE.equals(r.getIstemplate()),
            json.toJsonNode(r.getWeeklywindows()), r.getVersion(), r.getCreatedat(), r.getUpdatedat(),
            assignments.stream().map(ScheduleAssignmentDto::from).toList()
        );
    }

    public record ScheduleAssignmentDto(String id, String definitionId, String siteId, String equipmentId,
                                         boolean enabled, LocalDateTime createdAt, LocalDateTime updatedAt) {
        public static ScheduleAssignmentDto from(ScheduleassignmentRecord r) {
            return new ScheduleAssignmentDto(
                r.getId(), r.getDefinitionid(), r.getSiteid(), r.getEquipmentid(), Boolean.TRUE.equals(r.getEnabled()),
                r.getCreatedat(), r.getUpdatedat()
            );
        }
    }
}
