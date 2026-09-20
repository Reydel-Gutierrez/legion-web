package com.legioncontrols.server.sites;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.jooq.generated.enums.Entitystatus;
import com.legioncontrols.server.jooq.generated.tables.records.BuildingRecord;
import com.legioncontrols.server.jooq.generated.tables.records.FloorRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record2;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Building.BUILDING;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Floor.FLOOR;
import static org.jooq.impl.DSL.count;

/** Java equivalent of backend/src/modules/floors/floor.service.js. */
@Service
public class FloorService {

    private final DSLContext dsl;

    public FloorService(DSLContext dsl) {
        this.dsl = dsl;
    }

    private BuildingRecord assertBuildingExists(String buildingId) {
        BuildingRecord building = dsl.selectFrom(BUILDING).where(BUILDING.ID.eq(buildingId)).fetchOne();
        if (building == null) {
            throw ApiException.notFound("Building not found");
        }
        return building;
    }

    public List<FloorDto> listFloorsByBuilding(String buildingId) {
        assertBuildingExists(buildingId);
        List<Record2<FloorRecord, Integer>> rows = dsl
            .select(FLOOR, count(EQUIPMENT.ID))
            .from(FLOOR)
            .leftJoin(EQUIPMENT).on(EQUIPMENT.FLOORID.eq(FLOOR.ID))
            .where(FLOOR.BUILDINGID.eq(buildingId))
            .groupBy(FLOOR.fields())
            .orderBy(FLOOR.SORTORDER.asc(), FLOOR.NAME.asc())
            .fetch();
        return rows.stream().map(r -> FloorDto.from(r.value1(), r.value2().longValue())).toList();
    }

    /** Returns the floor together with its parent building's siteId (needed by callers to resync). */
    public record FloorWithSite(FloorRecord floor, String siteId) {
    }

    private FloorWithSite fetchFloorWithSite(String floorId) {
        FloorRecord floor = dsl.selectFrom(FLOOR).where(FLOOR.ID.eq(floorId)).fetchOne();
        if (floor == null) {
            throw ApiException.notFound("Floor not found");
        }
        String siteId = dsl.select(BUILDING.SITEID).from(BUILDING).where(BUILDING.ID.eq(floor.getBuildingid())).fetchOne(BUILDING.SITEID);
        return new FloorWithSite(floor, siteId);
    }

    public record CreateFloorRequest(String name, String status, String floorType, String occupancyType,
                                      String displayLabel, Integer sortOrder) {
    }

    public FloorWithSite createFloor(String buildingId, CreateFloorRequest req) {
        BuildingRecord building = assertBuildingExists(buildingId);
        if (req.name() == null || req.name().isBlank()) {
            throw ApiException.badRequest("name is required");
        }
        FloorRecord record = dsl.newRecord(FLOOR);
        record.setId(UUID.randomUUID().toString());
        record.setBuildingid(buildingId);
        record.setName(req.name().trim());
        if (req.status() != null) record.setStatus(Entitystatus.valueOf(req.status().toUpperCase()));
        record.setFloortype(blankToNull(req.floorType()));
        record.setOccupancytype(blankToNull(req.occupancyType()));
        record.setDisplaylabel(blankToNull(req.displayLabel()));
        record.setSortorder(req.sortOrder() != null ? req.sortOrder() : 0);
        record.setCreatedat(LocalDateTime.now());
        record.setUpdatedat(LocalDateTime.now());
        record.insert();
        record.refresh();
        return new FloorWithSite(record, building.getSiteid());
    }

    public record UpdateFloorRequest(String name, String status, String floorType, String occupancyType,
                                      String displayLabel, Integer sortOrder) {
    }

    public FloorWithSite updateFloor(String id, UpdateFloorRequest req) {
        FloorWithSite existing = fetchFloorWithSite(id);
        FloorRecord record = existing.floor();
        boolean changed = false;
        if (req.name() != null) { record.setName(req.name().trim()); changed = true; }
        if (req.status() != null) { record.setStatus(Entitystatus.valueOf(req.status().toUpperCase())); changed = true; }
        if (req.floorType() != null) { record.setFloortype(blankToNull(req.floorType())); changed = true; }
        if (req.occupancyType() != null) { record.setOccupancytype(blankToNull(req.occupancyType())); changed = true; }
        if (req.displayLabel() != null) { record.setDisplaylabel(blankToNull(req.displayLabel())); changed = true; }
        if (req.sortOrder() != null) { record.setSortorder(req.sortOrder()); changed = true; }
        if (!changed) {
            throw ApiException.badRequest("No fields to update");
        }
        record.setUpdatedat(LocalDateTime.now());
        record.update();
        return existing;
    }

    public FloorWithSite deleteFloor(String id) {
        FloorWithSite existing = fetchFloorWithSite(id);
        dsl.deleteFrom(FLOOR).where(FLOOR.ID.eq(id)).execute();
        return existing;
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
