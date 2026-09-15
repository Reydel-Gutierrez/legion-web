package com.legioncontrols.server.sites;

import com.legioncontrols.server.jooq.generated.tables.records.BuildingRecord;
import java.time.LocalDateTime;

public record BuildingDto(
    String id,
    String siteId,
    String name,
    String addressLine1,
    String addressLine2,
    String city,
    String state,
    String postalCode,
    String country,
    Double latitude,
    Double longitude,
    String status,
    String buildingType,
    String buildingCode,
    String description,
    int sortOrder,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    CountDto _count
) {
    public record CountDto(long floors) {
    }

    public static BuildingDto from(BuildingRecord r) {
        return from(r, null);
    }

    public static BuildingDto from(BuildingRecord r, Long floorCount) {
        return new BuildingDto(
            r.getId(), r.getSiteid(), r.getName(), r.getAddressline1(), r.getAddressline2(),
            r.getCity(), r.getState(), r.getPostalcode(), r.getCountry(), r.getLatitude(), r.getLongitude(),
            r.getStatus() != null ? r.getStatus().getLiteral() : null,
            r.getBuildingtype(), r.getBuildingcode(), r.getDescription(),
            r.getSortorder() != null ? r.getSortorder() : 0,
            r.getCreatedat(), r.getUpdatedat(),
            floorCount != null ? new CountDto(floorCount) : null
        );
    }
}
