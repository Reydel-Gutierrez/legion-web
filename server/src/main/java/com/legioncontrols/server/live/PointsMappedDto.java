package com.legioncontrols.server.live;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.PointsmappedRecord;
import java.time.LocalDateTime;
import tools.jackson.databind.JsonNode;

public record PointsMappedDto(
    String id, String equipmentControllerId, String equipmentId, String pointId, String legionPointCode,
    String fieldPointKey, String fieldPointName, String fieldObjectType, String fieldObjectInstance,
    String fieldDataType, boolean readEnabled, boolean writeEnabled, boolean isBound, JsonNode metadata,
    LocalDateTime createdAt, LocalDateTime updatedAt
) {
    public static PointsMappedDto from(PointsmappedRecord r, JsonUtil json) {
        return new PointsMappedDto(
            r.getId(), r.getEquipmentcontrollerid(), r.getEquipmentid(), r.getPointid(), r.getLegionpointcode(),
            r.getFieldpointkey(), r.getFieldpointname(), r.getFieldobjecttype(), r.getFieldobjectinstance(),
            r.getFielddatatype(), !Boolean.FALSE.equals(r.getReadenabled()), Boolean.TRUE.equals(r.getWriteenabled()),
            !Boolean.FALSE.equals(r.getIsbound()), r.getMetadatajson() != null ? json.toJsonNode(r.getMetadatajson()) : null,
            r.getCreatedat(), r.getUpdatedat()
        );
    }
}
