package com.legioncontrols.server.sites;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.FloorRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Building.BUILDING;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Floor.FLOOR;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static org.jooq.impl.DSL.count;

/** Java equivalent of backend/src/modules/equipment/equipment.service.js. */
@Service
public class EquipmentService {

    private final DSLContext dsl;

    public EquipmentService(DSLContext dsl) {
        this.dsl = dsl;
    }

    private FloorRecord assertFloorExists(String floorId) {
        FloorRecord floor = dsl.selectFrom(FLOOR).where(FLOOR.ID.eq(floorId)).fetchOne();
        if (floor == null) {
            throw ApiException.notFound("Floor not found");
        }
        return floor;
    }

    public List<EquipmentDto> listEquipmentByFloor(String floorId) {
        assertFloorExists(floorId);
        return dsl.select(EQUIPMENT, count(POINT.ID))
            .from(EQUIPMENT)
            .leftJoin(POINT).on(POINT.EQUIPMENTID.eq(EQUIPMENT.ID))
            .where(EQUIPMENT.FLOORID.eq(floorId))
            .groupBy(EQUIPMENT.fields())
            .orderBy(EQUIPMENT.NAME.asc())
            .fetch()
            .map(r -> EquipmentDto.from(r.value1(), null, null, r.value2().longValue()));
    }

    public List<EquipmentDto> listEquipmentBySite(String siteId) {
        boolean siteExists = dsl.fetchExists(dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)));
        if (!siteExists) {
            throw ApiException.notFound("Site not found");
        }
        Field<Integer> pointCountField = count(POINT.ID).as("pointCount");
        return dsl.select(EQUIPMENT.fields())
            .select(BUILDING.ID, BUILDING.NAME, FLOOR.ID, FLOOR.NAME, pointCountField)
            .from(EQUIPMENT)
            .leftJoin(BUILDING).on(BUILDING.ID.eq(EQUIPMENT.BUILDINGID))
            .leftJoin(FLOOR).on(FLOOR.ID.eq(EQUIPMENT.FLOORID))
            .leftJoin(POINT).on(POINT.EQUIPMENTID.eq(EQUIPMENT.ID))
            .where(EQUIPMENT.SITEID.eq(siteId))
            .groupBy(groupFields(EQUIPMENT.fields(), BUILDING.ID, BUILDING.NAME, FLOOR.ID, FLOOR.NAME))
            .orderBy(EQUIPMENT.BUILDINGID.asc(), EQUIPMENT.FLOORID.asc(), EQUIPMENT.NAME.asc())
            .fetch()
            .map(r -> {
                EquipmentRecord eq = r.into(EQUIPMENT);
                EquipmentDto.RefDto building = r.get(BUILDING.ID) != null ? new EquipmentDto.RefDto(r.get(BUILDING.ID), r.get(BUILDING.NAME)) : null;
                EquipmentDto.RefDto floor = r.get(FLOOR.ID) != null ? new EquipmentDto.RefDto(r.get(FLOOR.ID), r.get(FLOOR.NAME)) : null;
                Integer pointCount = r.get(pointCountField);
                return EquipmentDto.from(eq, building, floor, pointCount != null ? pointCount.longValue() : 0L);
            });
    }

    public EquipmentRecord getEquipmentRecordById(String id) {
        EquipmentRecord equipment = dsl.selectFrom(EQUIPMENT).where(EQUIPMENT.ID.eq(id)).fetchOne();
        if (equipment == null) {
            throw ApiException.notFound("Equipment not found");
        }
        return equipment;
    }

    public record CreateEquipmentRequest(String name, String code, String equipmentType, String status,
                                          String templateName, String address, String instanceNumber) {
    }

    public EquipmentRecord createEquipment(String floorId, CreateEquipmentRequest req) {
        FloorRecord floor = assertFloorExists(floorId);
        String buildingId = floor.getBuildingid();
        String siteId = dsl.select(BUILDING.SITEID).from(BUILDING).where(BUILDING.ID.eq(buildingId)).fetchOne(BUILDING.SITEID);

        if (isBlank(req.name()) || isBlank(req.code()) || isBlank(req.equipmentType())) {
            throw ApiException.badRequest("name, code, and equipmentType are required");
        }

        EquipmentRecord record = dsl.newRecord(EQUIPMENT);
        record.setId(UUID.randomUUID().toString());
        record.setSiteid(siteId);
        record.setBuildingid(buildingId);
        record.setFloorid(floorId);
        record.setName(req.name().trim());
        record.setCode(req.code().trim());
        record.setEquipmenttype(req.equipmentType().trim());
        record.setTemplatename(blankToNull(req.templateName()));
        if (req.status() != null) {
            record.setStatus(com.legioncontrols.server.jooq.generated.enums.Entitystatus.valueOf(req.status().toUpperCase()));
        }
        record.setAddress(blankToNull(req.address()));
        record.setInstancenumber(blankToNull(req.instanceNumber()));
        record.setCreatedat(LocalDateTime.now());
        record.setUpdatedat(LocalDateTime.now());
        record.insert();
        record.refresh();
        return record;
    }

    public record UpdateEquipmentRequest(String name, String code, String equipmentType, String status,
                                          String templateName, String address, String instanceNumber) {
    }

    public EquipmentRecord updateEquipment(String id, UpdateEquipmentRequest req) {
        EquipmentRecord record = getEquipmentRecordById(id);
        boolean changed = false;
        if (req.name() != null) { record.setName(req.name().trim()); changed = true; }
        if (req.code() != null) { record.setCode(req.code().trim()); changed = true; }
        if (req.equipmentType() != null) { record.setEquipmenttype(req.equipmentType().trim()); changed = true; }
        if (req.status() != null) { record.setStatus(com.legioncontrols.server.jooq.generated.enums.Entitystatus.valueOf(req.status().toUpperCase())); changed = true; }
        if (req.templateName() != null) { record.setTemplatename(blankToNull(req.templateName())); changed = true; }
        if (req.address() != null) { record.setAddress(blankToNull(req.address())); changed = true; }
        if (req.instanceNumber() != null) { record.setInstancenumber(blankToNull(req.instanceNumber())); changed = true; }
        if (!changed) {
            throw ApiException.badRequest("No fields to update");
        }
        record.setUpdatedat(LocalDateTime.now());
        record.update();
        return record;
    }

    public EquipmentRecord deleteEquipment(String id) {
        EquipmentRecord record = getEquipmentRecordById(id);
        dsl.deleteFrom(EQUIPMENT).where(EQUIPMENT.ID.eq(id)).execute();
        return record;
    }

    private static org.jooq.GroupField[] groupFields(org.jooq.Field<?>[] tableFields, org.jooq.GroupField... extra) {
        org.jooq.GroupField[] combined = new org.jooq.GroupField[tableFields.length + extra.length];
        System.arraycopy(tableFields, 0, combined, 0, tableFields.length);
        System.arraycopy(extra, 0, combined, tableFields.length, extra.length);
        return combined;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
