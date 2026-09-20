package com.legioncontrols.server.operator;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.TrenddefinitionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.TrendassignmentRecord;
import java.time.LocalDateTime;
import java.util.List;
import tools.jackson.databind.JsonNode;

public record TrendDefinitionDto(
    String id, String siteId, String name, boolean enabled, boolean isTemplate, String equipmentType,
    Integer sampleInterval, JsonNode pointRequirements, int version, Integer retentionDays,
    LocalDateTime createdAt, LocalDateTime updatedAt, List<TrendAssignmentDto> assignments
) {
    public static TrendDefinitionDto from(TrenddefinitionRecord r, List<TrendassignmentRecord> assignments, JsonUtil json) {
        return new TrendDefinitionDto(
            r.getId(), r.getSiteid(), r.getName(), Boolean.TRUE.equals(r.getEnabled()), Boolean.TRUE.equals(r.getIstemplate()),
            r.getEquipmenttype(), r.getSampleinterval(), json.toJsonNode(r.getPointrequirements()), r.getVersion(),
            r.getRetentiondays(), r.getCreatedat(), r.getUpdatedat(),
            assignments.stream().map(a -> TrendAssignmentDto.from(a, json)).toList()
        );
    }

    public record TrendAssignmentDto(String id, String definitionId, String siteId, String equipmentId,
                                      boolean enabled, JsonNode resolvedMappings, LocalDateTime createdAt, LocalDateTime updatedAt) {
        public static TrendAssignmentDto from(TrendassignmentRecord r, JsonUtil json) {
            return new TrendAssignmentDto(
                r.getId(), r.getDefinitionid(), r.getSiteid(), r.getEquipmentid(), Boolean.TRUE.equals(r.getEnabled()),
                json.toJsonNode(r.getResolvedmappings()), r.getCreatedat(), r.getUpdatedat()
            );
        }
    }
}
