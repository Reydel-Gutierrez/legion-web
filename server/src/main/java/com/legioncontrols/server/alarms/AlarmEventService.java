package com.legioncontrols.server.alarms;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.jooq.generated.enums.Alarmeventstate;
import com.legioncontrols.server.jooq.generated.tables.records.AlarmdefinitionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.AlarmeventRecord;
import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import java.time.LocalDateTime;
import java.util.List;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Alarmdefinition.ALARMDEFINITION;
import static com.legioncontrols.server.jooq.generated.tables.Alarmevent.ALARMEVENT;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;

/** Java equivalent of the event half of backend/src/modules/alarms/alarm.service.js. */
@Service
public class AlarmEventService {

    private final DSLContext dsl;

    public AlarmEventService(DSLContext dsl) {
        this.dsl = dsl;
    }

    private void assertSite(String siteId) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)));
        if (!exists) throw ApiException.notFound("Site not found");
    }

    private AlarmEventDto toDto(AlarmeventRecord r) {
        AlarmdefinitionRecord def = dsl.selectFrom(ALARMDEFINITION).where(ALARMDEFINITION.ID.eq(r.getAlarmdefinitionid())).fetchOne();
        AlarmEventDto.DefinitionRefDto defDto = null;
        if (def != null) {
            AlarmDefinitionDto.PointRefDto point = def.getPointid() != null ? fetchPointRef(def.getPointid()) : null;
            AlarmEventDto.EquipmentRefDto equipment = fetchEquipmentRef(def.getEquipmentid());
            defDto = new AlarmEventDto.DefinitionRefDto(def.getId(), def.getName(), def.getPointkey(), point, equipment);
        }
        return AlarmEventDto.from(r, defDto);
    }

    private AlarmDefinitionDto.PointRefDto fetchPointRef(String pointId) {
        PointRecord p = dsl.selectFrom(POINT).where(POINT.ID.eq(pointId)).fetchOne();
        return p != null ? new AlarmDefinitionDto.PointRefDto(p.getId(), p.getPointname(), p.getPointcode(), p.getPresentvalue()) : null;
    }

    private AlarmEventDto.EquipmentRefDto fetchEquipmentRef(String equipmentId) {
        EquipmentRecord e = dsl.selectFrom(EQUIPMENT).where(EQUIPMENT.ID.eq(equipmentId)).fetchOne();
        return e != null ? new AlarmEventDto.EquipmentRefDto(e.getId(), e.getName(), e.getEquipmenttype()) : null;
    }

    public record ListEventsQuery(String state, String equipmentId) {
    }

    public List<AlarmEventDto> listEvents(String siteId, ListEventsQuery query) {
        assertSite(siteId);
        Condition condition = ALARMEVENT.SITEID.eq(siteId);
        if (query.equipmentId() != null) condition = condition.and(ALARMEVENT.EQUIPMENTID.eq(query.equipmentId()));
        if ("active".equals(query.state())) condition = condition.and(ALARMEVENT.STATE.eq(Alarmeventstate.ACTIVE));
        else if ("history".equals(query.state()) || "cleared".equals(query.state())) condition = condition.and(ALARMEVENT.STATE.eq(Alarmeventstate.CLEARED));

        return dsl.selectFrom(ALARMEVENT).where(condition).orderBy(ALARMEVENT.OCCURREDAT.desc()).limit(500)
            .fetch().stream().map(this::toDto).toList();
    }

    public AlarmEventDto acknowledgeEvent(String siteId, String eventId) {
        AlarmeventRecord event = dsl.selectFrom(ALARMEVENT).where(ALARMEVENT.ID.eq(eventId), ALARMEVENT.SITEID.eq(siteId)).fetchOne();
        if (event == null) throw ApiException.notFound("Alarm event not found");
        event.setAck(true);
        event.setUpdatedat(LocalDateTime.now());
        event.update();
        return toDto(event);
    }
}
