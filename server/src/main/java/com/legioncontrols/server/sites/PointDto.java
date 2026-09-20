package com.legioncontrols.server.sites;

import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import java.time.LocalDateTime;

public record PointDto(
    String id, String equipmentId, String siteId, String buildingId, String floorId,
    String pointName, String pointCode, String pointType, String unit, boolean writable,
    String presentValue, LocalDateTime lastSeenAt, String commState, String status,
    LocalDateTime createdAt, LocalDateTime updatedAt
) {
    public static PointDto from(PointRecord r) {
        return new PointDto(
            r.getId(), r.getEquipmentid(), r.getSiteid(), r.getBuildingid(), r.getFloorid(),
            r.getPointname(), r.getPointcode(), r.getPointtype(), r.getUnit(), Boolean.TRUE.equals(r.getWritable()),
            r.getPresentvalue(), r.getLastseenat(), r.getCommstate(),
            r.getStatus() != null ? r.getStatus().getLiteral() : null,
            r.getCreatedat(), r.getUpdatedat()
        );
    }
}
