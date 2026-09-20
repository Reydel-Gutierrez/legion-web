package com.legioncontrols.server.sites;

import com.legioncontrols.server.jooq.generated.tables.records.FloorRecord;
import java.time.LocalDateTime;

public record FloorDto(
    String id,
    String buildingId,
    String name,
    String status,
    String displayLabel,
    String floorType,
    String occupancyType,
    int sortOrder,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    CountDto _count
) {
    public record CountDto(long equipment) {
    }

    public static FloorDto from(FloorRecord r) {
        return from(r, null);
    }

    public static FloorDto from(FloorRecord r, Long equipmentCount) {
        return new FloorDto(
            r.getId(), r.getBuildingid(), r.getName(),
            r.getStatus() != null ? r.getStatus().getLiteral() : null,
            r.getDisplaylabel(), r.getFloortype(), r.getOccupancytype(),
            r.getSortorder() != null ? r.getSortorder() : 0,
            r.getCreatedat(), r.getUpdatedat(),
            equipmentCount != null ? new CountDto(equipmentCount) : null
        );
    }
}
