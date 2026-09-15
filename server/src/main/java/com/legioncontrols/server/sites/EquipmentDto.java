package com.legioncontrols.server.sites;

import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import java.time.LocalDateTime;

public record EquipmentDto(
    String id,
    String siteId,
    String buildingId,
    String floorId,
    String name,
    String code,
    String equipmentType,
    String status,
    String templateName,
    String address,
    String instanceNumber,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    RefDto building,
    RefDto floor,
    CountDto _count
) {
    public record RefDto(String id, String name) {
    }

    public record CountDto(long points) {
    }

    public static EquipmentDto from(EquipmentRecord r) {
        return from(r, null, null, null);
    }

    public static EquipmentDto from(EquipmentRecord r, RefDto building, RefDto floor, Long pointCount) {
        return new EquipmentDto(
            r.getId(), r.getSiteid(), r.getBuildingid(), r.getFloorid(), r.getName(), r.getCode(),
            r.getEquipmenttype(),
            r.getStatus() != null ? r.getStatus().getLiteral() : null,
            r.getTemplatename(), r.getAddress(), r.getInstancenumber(),
            r.getCreatedat(), r.getUpdatedat(),
            building, floor,
            pointCount != null ? new CountDto(pointCount) : null
        );
    }
}
