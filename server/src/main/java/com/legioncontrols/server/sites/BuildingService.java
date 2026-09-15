package com.legioncontrols.server.sites;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.jooq.generated.enums.Entitystatus;
import com.legioncontrols.server.jooq.generated.tables.records.BuildingRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record2;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Building.BUILDING;
import static com.legioncontrols.server.jooq.generated.tables.Floor.FLOOR;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static org.jooq.impl.DSL.count;

/** Java equivalent of backend/src/modules/buildings/building.service.js. */
@Service
public class BuildingService {

    private final DSLContext dsl;

    public BuildingService(DSLContext dsl) {
        this.dsl = dsl;
    }

    private void assertSiteExists(String siteId) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)));
        if (!exists) {
            throw ApiException.notFound("Site not found");
        }
    }

    public List<BuildingDto> listBuildingsBySite(String siteId) {
        assertSiteExists(siteId);
        List<Record2<BuildingRecord, Integer>> rows = dsl
            .select(BUILDING, count(FLOOR.ID))
            .from(BUILDING)
            .leftJoin(FLOOR).on(FLOOR.BUILDINGID.eq(BUILDING.ID))
            .where(BUILDING.SITEID.eq(siteId))
            .groupBy(BUILDING.fields())
            .orderBy(BUILDING.SORTORDER.asc(), BUILDING.NAME.asc())
            .fetch();
        return rows.stream()
            .map(r -> BuildingDto.from(r.value1(), r.value2().longValue()))
            .toList();
    }

    public BuildingRecord getBuildingRecordById(String id) {
        BuildingRecord building = dsl.selectFrom(BUILDING).where(BUILDING.ID.eq(id)).fetchOne();
        if (building == null) {
            throw ApiException.notFound("Building not found");
        }
        return building;
    }

    public record CreateBuildingRequest(String name, String addressLine1, String addressLine2, String city,
                                         String state, String postalCode, String country, Double latitude,
                                         Double longitude, String status, String buildingType, String buildingCode,
                                         String description, Integer sortOrder) {
    }

    public BuildingRecord createBuilding(String siteId, CreateBuildingRequest req) {
        assertSiteExists(siteId);
        if (isBlank(req.name()) || isBlank(req.addressLine1()) || isBlank(req.city())
            || isBlank(req.state()) || isBlank(req.postalCode()) || isBlank(req.country())) {
            throw ApiException.badRequest("name, addressLine1, city, state, postalCode, and country are required");
        }
        BuildingRecord record = dsl.newRecord(BUILDING);
        record.setId(UUID.randomUUID().toString());
        record.setSiteid(siteId);
        record.setName(req.name().trim());
        record.setAddressline1(req.addressLine1().trim());
        record.setAddressline2(nullableTrim(req.addressLine2()));
        record.setCity(req.city().trim());
        record.setState(req.state().trim());
        record.setPostalcode(req.postalCode().trim());
        record.setCountry(req.country().trim());
        record.setLatitude(req.latitude());
        record.setLongitude(req.longitude());
        if (req.status() != null) record.setStatus(Entitystatus.valueOf(req.status().toUpperCase()));
        record.setBuildingtype(blankToNull(req.buildingType()));
        record.setBuildingcode(blankToNull(req.buildingCode()));
        record.setDescription(blankToNull(req.description()));
        record.setSortorder(req.sortOrder() != null ? req.sortOrder() : 0);
        record.setCreatedat(LocalDateTime.now());
        record.setUpdatedat(LocalDateTime.now());
        record.insert();
        record.refresh(); // pick up DB-side defaults (e.g. status) jOOQ doesn't return-and-populate automatically
        return record;
    }

    public record UpdateBuildingRequest(String name, String addressLine1, String addressLine2, String city,
                                         String state, String postalCode, String country, Double latitude,
                                         Double longitude, String status, String buildingType, String buildingCode,
                                         String description, Integer sortOrder) {
    }

    public BuildingRecord updateBuilding(String id, UpdateBuildingRequest req) {
        BuildingRecord record = getBuildingRecordById(id);
        boolean changed = false;
        if (req.name() != null) { record.setName(req.name().trim()); changed = true; }
        if (req.addressLine1() != null) { record.setAddressline1(req.addressLine1().trim()); changed = true; }
        if (req.addressLine2() != null) { record.setAddressline2(nullableTrim(req.addressLine2())); changed = true; }
        if (req.city() != null) { record.setCity(req.city().trim()); changed = true; }
        if (req.state() != null) { record.setState(req.state().trim()); changed = true; }
        if (req.postalCode() != null) { record.setPostalcode(req.postalCode().trim()); changed = true; }
        if (req.country() != null) { record.setCountry(req.country().trim()); changed = true; }
        if (req.latitude() != null) { record.setLatitude(req.latitude()); changed = true; }
        if (req.longitude() != null) { record.setLongitude(req.longitude()); changed = true; }
        if (req.buildingType() != null) { record.setBuildingtype(blankToNull(req.buildingType())); changed = true; }
        if (req.buildingCode() != null) { record.setBuildingcode(blankToNull(req.buildingCode())); changed = true; }
        if (req.description() != null) { record.setDescription(blankToNull(req.description())); changed = true; }
        if (req.sortOrder() != null) { record.setSortorder(req.sortOrder()); changed = true; }
        if (req.status() != null) { record.setStatus(Entitystatus.valueOf(req.status().toUpperCase())); changed = true; }
        if (!changed) {
            throw ApiException.badRequest("No fields to update");
        }
        record.setUpdatedat(LocalDateTime.now());
        record.update();
        return record;
    }

    public BuildingRecord deleteBuilding(String id) {
        BuildingRecord record = getBuildingRecordById(id);
        dsl.deleteFrom(BUILDING).where(BUILDING.ID.eq(id)).execute();
        return record;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String nullableTrim(String s) {
        return s != null ? s.trim() : null;
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
