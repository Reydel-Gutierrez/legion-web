package com.legioncontrols.server.operator;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.historian.HistorianService;
import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.ScheduleassignmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.ScheduledefinitionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.TrendassignmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.TrenddefinitionRecord;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.jooq.DSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Scheduleassignment.SCHEDULEASSIGNMENT;
import static com.legioncontrols.server.jooq.generated.tables.Scheduledefinition.SCHEDULEDEFINITION;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static com.legioncontrols.server.jooq.generated.tables.Trendassignment.TRENDASSIGNMENT;
import static com.legioncontrols.server.jooq.generated.tables.Trenddefinition.TRENDDEFINITION;

/**
 * Java equivalent of backend/src/modules/operatorDefinitions/operatorDefinitions.service.js — a
 * generic definition/assignment CRUD shared by trend and schedule "kinds". Trend definitions are
 * the sole source of HistorianService's effective config (coverage + sampleInterval +
 * retentionDays), so every trend mutation here synchronously refreshes that cache before
 * returning — the same invariant as the Node version.
 */
@Service
public class OperatorDefinitionsService {

    private static final Logger log = LoggerFactory.getLogger(OperatorDefinitionsService.class);
    private static final int MIN_SAMPLE_INTERVAL_SECONDS = 10;
    private static final Set<String> WEEKDAYS = Set.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
    private static final Pattern TIME_PATTERN = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    public enum Kind { TREND, SCHEDULE }

    public static Kind parseKind(String kind) {
        if ("trend".equals(kind)) return Kind.TREND;
        if ("schedule".equals(kind)) return Kind.SCHEDULE;
        throw ApiException.badRequest("Unknown definition kind");
    }

    private final DSLContext dsl;
    private final JsonUtil json;
    private final HistorianService historianService;

    public OperatorDefinitionsService(DSLContext dsl, JsonUtil json, HistorianService historianService) {
        this.dsl = dsl;
        this.json = json;
        this.historianService = historianService;
    }

    private void assertSite(String siteId) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)));
        if (!exists) throw ApiException.notFound("Site not found");
    }

    private void refreshHistorianCacheIfTrend(Kind kind) {
        if (kind != Kind.TREND) return;
        try {
            historianService.refreshHistorianConfig();
        } catch (Exception e) {
            log.warn("[operatorDefinitions] historian cache refresh failed: {}", e.getMessage());
        }
    }

    // ---- validation --------------------------------------------------------------------------

    private void validate(Kind kind, JsonNode body, boolean partial) {
        if (body == null || !body.isObject()) throw ApiException.badRequest("Definition must be an object");
        boolean nameRequired = !partial || body.has("name");
        if (nameRequired && (!body.has("name") || !body.get("name").isTextual() || body.get("name").asText().isBlank())) {
            throw ApiException.badRequest("name is required");
        }
        for (String key : new String[]{"enabled", "isTemplate"}) {
            if (body.has(key) && !body.get(key).isBoolean()) {
                throw ApiException.badRequest(key + " must be a boolean");
            }
        }
        if (kind == Kind.TREND) {
            if (body.has("sampleInterval") && !body.get("sampleInterval").isNull()) {
                JsonNode si = body.get("sampleInterval");
                if (!si.isIntegralNumber() || si.asInt() < MIN_SAMPLE_INTERVAL_SECONDS) {
                    throw ApiException.badRequest("sampleInterval must be an integer of at least " + MIN_SAMPLE_INTERVAL_SECONDS + " seconds");
                }
            }
            if (body.has("pointRequirements")) {
                JsonNode pr = body.get("pointRequirements");
                boolean valid = pr.isArray();
                if (valid) {
                    for (JsonNode point : pr) {
                        if (point == null || !point.isObject() || !point.hasNonNull("pointKey") || point.get("pointKey").asText().isBlank()) {
                            valid = false;
                            break;
                        }
                    }
                }
                if (!valid) throw ApiException.badRequest("pointRequirements must contain logical point keys");
            }
        } else if (body.has("weeklyWindows")) {
            JsonNode windows = body.get("weeklyWindows");
            boolean valid = windows.isArray();
            if (valid) {
                for (JsonNode window : windows) {
                    valid = window != null && window.isObject()
                        && window.get("days") != null && window.get("days").isArray() && !window.get("days").isEmpty()
                        && allDaysValid(window.get("days"))
                        && window.hasNonNull("startTime") && TIME_PATTERN.matcher(window.get("startTime").asText()).matches()
                        && window.hasNonNull("endTime") && TIME_PATTERN.matcher(window.get("endTime").asText()).matches()
                        && window.hasNonNull("action") && ("Occupied".equals(window.get("action").asText()) || "Unoccupied".equals(window.get("action").asText()));
                    if (!valid) break;
                }
            }
            if (!valid) throw ApiException.badRequest("weeklyWindows must contain valid days, times and occupancy actions");
        }
    }

    private static boolean allDaysValid(JsonNode days) {
        for (JsonNode day : days) {
            if (!WEEKDAYS.contains(day.asText())) return false;
        }
        return true;
    }

    // ---- list ----------------------------------------------------------------------------------

    public Object list(String siteId, Kind kind, String templatesFilter) {
        assertSite(siteId);
        if (kind == Kind.TREND) {
            var condition = TRENDDEFINITION.SITEID.eq(siteId);
            var step = dsl.selectFrom(TRENDDEFINITION).where(condition);
            List<TrenddefinitionRecord> defs = "true".equals(templatesFilter)
                ? dsl.selectFrom(TRENDDEFINITION).where(condition, TRENDDEFINITION.ISTEMPLATE.isTrue()).orderBy(TRENDDEFINITION.UPDATEDAT.desc()).fetch()
                : "false".equals(templatesFilter)
                    ? dsl.selectFrom(TRENDDEFINITION).where(condition, TRENDDEFINITION.ISTEMPLATE.isFalse()).orderBy(TRENDDEFINITION.UPDATEDAT.desc()).fetch()
                    : step.orderBy(TRENDDEFINITION.UPDATEDAT.desc()).fetch();
            return defs.stream().map(d -> TrendDefinitionDto.from(d, fetchTrendAssignments(d.getId()), json)).toList();
        } else {
            var condition = SCHEDULEDEFINITION.SITEID.eq(siteId);
            List<ScheduledefinitionRecord> defs = "true".equals(templatesFilter)
                ? dsl.selectFrom(SCHEDULEDEFINITION).where(condition, SCHEDULEDEFINITION.ISTEMPLATE.isTrue()).orderBy(SCHEDULEDEFINITION.UPDATEDAT.desc()).fetch()
                : "false".equals(templatesFilter)
                    ? dsl.selectFrom(SCHEDULEDEFINITION).where(condition, SCHEDULEDEFINITION.ISTEMPLATE.isFalse()).orderBy(SCHEDULEDEFINITION.UPDATEDAT.desc()).fetch()
                    : dsl.selectFrom(SCHEDULEDEFINITION).where(condition).orderBy(SCHEDULEDEFINITION.UPDATEDAT.desc()).fetch();
            return defs.stream().map(d -> ScheduleDefinitionDto.from(d, fetchScheduleAssignments(d.getId()), json)).toList();
        }
    }

    private List<TrendassignmentRecord> fetchTrendAssignments(String definitionId) {
        return dsl.selectFrom(TRENDASSIGNMENT).where(TRENDASSIGNMENT.DEFINITIONID.eq(definitionId)).fetch();
    }

    private List<ScheduleassignmentRecord> fetchScheduleAssignments(String definitionId) {
        return dsl.selectFrom(SCHEDULEASSIGNMENT).where(SCHEDULEASSIGNMENT.DEFINITIONID.eq(definitionId)).fetch();
    }

    // ---- create ----------------------------------------------------------------------------------

    public Object create(String siteId, Kind kind, JsonNode body) {
        validate(kind, body, false);
        assertSite(siteId);
        String name = body.get("name").asText().trim();
        boolean enabled = !body.has("enabled") || body.get("enabled").asBoolean();
        boolean isTemplate = body.has("isTemplate") && body.get("isTemplate").asBoolean();

        if (isTemplate) {
            boolean dup = kind == Kind.TREND
                ? dsl.fetchExists(dsl.selectFrom(TRENDDEFINITION).where(TRENDDEFINITION.SITEID.eq(siteId), TRENDDEFINITION.ISTEMPLATE.isTrue(), TRENDDEFINITION.NAME.equalIgnoreCase(name)))
                : dsl.fetchExists(dsl.selectFrom(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.SITEID.eq(siteId), SCHEDULEDEFINITION.ISTEMPLATE.isTrue(), SCHEDULEDEFINITION.NAME.equalIgnoreCase(name)));
            if (dup) throw ApiException.conflict("A template named \"" + name + "\" already exists");
        }

        List<String> equipmentIds = null;
        if (body.has("equipmentIds")) {
            JsonNode idsNode = body.get("equipmentIds");
            if (!idsNode.isArray() || idsNode.isEmpty()) throw ApiException.badRequest("equipmentIds must be a nonempty array");
            Set<String> ids = new LinkedHashSet<>();
            for (JsonNode id : idsNode) ids.add(id.asText());
            equipmentIds = List.copyOf(ids);
            long matchCount = dsl.selectCount().from(EQUIPMENT).where(EQUIPMENT.SITEID.eq(siteId), EQUIPMENT.ID.in(equipmentIds)).fetchOne(0, Long.class);
            if (matchCount != equipmentIds.size()) throw ApiException.badRequest("Every assignment must reference equipment in this site");
        }

        LocalDateTime now = LocalDateTime.now();
        Object result;
        if (kind == Kind.TREND) {
            TrenddefinitionRecord record = dsl.newRecord(TRENDDEFINITION);
            record.setId(UUID.randomUUID().toString());
            record.setSiteid(siteId);
            record.setName(name);
            record.setEnabled(enabled);
            record.setIstemplate(isTemplate);
            record.setEquipmenttype(body.has("equipmentType") && !body.get("equipmentType").isNull() ? body.get("equipmentType").asText() : null);
            record.setSampleinterval(body.has("sampleInterval") && !body.get("sampleInterval").isNull() ? body.get("sampleInterval").asInt() : null);
            record.setPointrequirements(json.toJsonb(body.has("pointRequirements") ? body.get("pointRequirements") : json.newArray()));
            if (body.has("retentionDays") && !body.get("retentionDays").isNull()) record.setRetentiondays(body.get("retentionDays").asInt());
            record.setCreatedat(now);
            record.setUpdatedat(now);
            record.insert();

            if (equipmentIds != null) {
                JsonNode resolvedMappings = body.get("resolvedMappings");
                for (String equipmentId : equipmentIds) {
                    TrendassignmentRecord assignment = dsl.newRecord(TRENDASSIGNMENT);
                    assignment.setId(UUID.randomUUID().toString());
                    assignment.setDefinitionid(record.getId());
                    assignment.setSiteid(siteId);
                    assignment.setEquipmentid(equipmentId);
                    assignment.setEnabled(true);
                    JsonNode mapping = resolvedMappings != null ? resolvedMappings.get(equipmentId) : null;
                    assignment.setResolvedmappings(json.toJsonb(mapping != null ? mapping : json.newObject()));
                    assignment.setCreatedat(now);
                    assignment.setUpdatedat(now);
                    assignment.insert();
                }
            }
            record.refresh();
            result = TrendDefinitionDto.from(record, fetchTrendAssignments(record.getId()), json);
        } else {
            ScheduledefinitionRecord record = dsl.newRecord(SCHEDULEDEFINITION);
            record.setId(UUID.randomUUID().toString());
            record.setSiteid(siteId);
            record.setName(name);
            record.setEnabled(enabled);
            record.setIstemplate(isTemplate);
            record.setWeeklywindows(json.toJsonb(body.has("weeklyWindows") ? body.get("weeklyWindows") : json.newArray()));
            record.setCreatedat(now);
            record.setUpdatedat(now);
            record.insert();

            if (equipmentIds != null) {
                for (String equipmentId : equipmentIds) {
                    ScheduleassignmentRecord assignment = dsl.newRecord(SCHEDULEASSIGNMENT);
                    assignment.setId(UUID.randomUUID().toString());
                    assignment.setDefinitionid(record.getId());
                    assignment.setSiteid(siteId);
                    assignment.setEquipmentid(equipmentId);
                    assignment.setEnabled(true);
                    assignment.setCreatedat(now);
                    assignment.setUpdatedat(now);
                    assignment.insert();
                }
            }
            record.refresh();
            result = ScheduleDefinitionDto.from(record, fetchScheduleAssignments(record.getId()), json);
        }

        refreshHistorianCacheIfTrend(kind);
        return result;
    }

    // ---- update ----------------------------------------------------------------------------------

    public Object update(String siteId, Kind kind, String id, JsonNode body) {
        validate(kind, body, true);
        Object result;
        if (kind == Kind.TREND) {
            TrenddefinitionRecord existing = dsl.selectFrom(TRENDDEFINITION).where(TRENDDEFINITION.ID.eq(id), TRENDDEFINITION.SITEID.eq(siteId)).fetchOne();
            if (existing == null) throw ApiException.notFound("Definition not found");
            String newName = body.has("name") ? body.get("name").asText().trim() : existing.getName();
            boolean willBeTemplate = body.has("isTemplate") ? body.get("isTemplate").asBoolean() : Boolean.TRUE.equals(existing.getIstemplate());
            if (willBeTemplate && body.has("name") && !newName.equalsIgnoreCase(existing.getName())) {
                boolean dup = dsl.fetchExists(dsl.selectFrom(TRENDDEFINITION)
                    .where(TRENDDEFINITION.SITEID.eq(siteId), TRENDDEFINITION.ISTEMPLATE.isTrue(), TRENDDEFINITION.NAME.equalIgnoreCase(newName), TRENDDEFINITION.ID.ne(id)));
                if (dup) throw ApiException.conflict("A template named \"" + newName + "\" already exists");
            }
            if (body.has("name")) existing.setName(newName);
            if (body.has("enabled")) existing.setEnabled(body.get("enabled").asBoolean());
            if (body.has("isTemplate")) existing.setIstemplate(body.get("isTemplate").asBoolean());
            if (body.has("pointRequirements")) existing.setPointrequirements(json.toJsonb(body.get("pointRequirements")));
            if (body.has("sampleInterval")) existing.setSampleinterval(body.get("sampleInterval").isNull() ? null : body.get("sampleInterval").asInt());
            if (body.has("equipmentType")) existing.setEquipmenttype(body.get("equipmentType").isNull() || body.get("equipmentType").asText().isBlank() ? null : body.get("equipmentType").asText());
            if (body.has("retentionDays")) existing.setRetentiondays(body.get("retentionDays").isNull() ? null : body.get("retentionDays").asInt());
            existing.setVersion(existing.getVersion() + 1);
            existing.setUpdatedat(LocalDateTime.now());
            existing.update();
            result = TrendDefinitionDto.from(existing, fetchTrendAssignments(id), json);
        } else {
            ScheduledefinitionRecord existing = dsl.selectFrom(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.ID.eq(id), SCHEDULEDEFINITION.SITEID.eq(siteId)).fetchOne();
            if (existing == null) throw ApiException.notFound("Definition not found");
            String newName = body.has("name") ? body.get("name").asText().trim() : existing.getName();
            boolean willBeTemplate = body.has("isTemplate") ? body.get("isTemplate").asBoolean() : Boolean.TRUE.equals(existing.getIstemplate());
            if (willBeTemplate && body.has("name") && !newName.equalsIgnoreCase(existing.getName())) {
                boolean dup = dsl.fetchExists(dsl.selectFrom(SCHEDULEDEFINITION)
                    .where(SCHEDULEDEFINITION.SITEID.eq(siteId), SCHEDULEDEFINITION.ISTEMPLATE.isTrue(), SCHEDULEDEFINITION.NAME.equalIgnoreCase(newName), SCHEDULEDEFINITION.ID.ne(id)));
                if (dup) throw ApiException.conflict("A template named \"" + newName + "\" already exists");
            }
            if (body.has("name")) existing.setName(newName);
            if (body.has("enabled")) existing.setEnabled(body.get("enabled").asBoolean());
            if (body.has("isTemplate")) existing.setIstemplate(body.get("isTemplate").asBoolean());
            if (body.has("weeklyWindows")) existing.setWeeklywindows(json.toJsonb(body.get("weeklyWindows")));
            existing.setVersion(existing.getVersion() + 1);
            existing.setUpdatedat(LocalDateTime.now());
            existing.update();
            result = ScheduleDefinitionDto.from(existing, fetchScheduleAssignments(id), json);
        }
        refreshHistorianCacheIfTrend(kind);
        return result;
    }

    // ---- remove ----------------------------------------------------------------------------------

    public void remove(String siteId, Kind kind, String id) {
        if (kind == Kind.TREND) {
            boolean exists = dsl.fetchExists(dsl.selectFrom(TRENDDEFINITION).where(TRENDDEFINITION.ID.eq(id), TRENDDEFINITION.SITEID.eq(siteId)));
            if (!exists) throw ApiException.notFound("Definition not found");
            dsl.deleteFrom(TRENDDEFINITION).where(TRENDDEFINITION.ID.eq(id)).execute();
        } else {
            boolean exists = dsl.fetchExists(dsl.selectFrom(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.ID.eq(id), SCHEDULEDEFINITION.SITEID.eq(siteId)));
            if (!exists) throw ApiException.notFound("Definition not found");
            dsl.deleteFrom(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.ID.eq(id)).execute();
        }
        refreshHistorianCacheIfTrend(kind);
    }

    // ---- assign / unassign -----------------------------------------------------------------------

    public Object assign(String siteId, Kind kind, String id, JsonNode body) {
        if (body != null && body.has("equipmentIds") && !body.get("equipmentIds").isArray()) {
            throw ApiException.badRequest("equipmentIds must be an array");
        }
        Set<String> equipmentIds = new LinkedHashSet<>();
        if (body != null && body.has("equipmentIds")) {
            for (JsonNode id2 : body.get("equipmentIds")) equipmentIds.add(id2.asText());
        } else if (body != null && body.has("equipmentId")) {
            equipmentIds.add(body.get("equipmentId").asText());
        }
        if (equipmentIds.isEmpty()) throw ApiException.badRequest("equipmentIds are required");

        long matchCount = dsl.selectCount().from(EQUIPMENT).where(EQUIPMENT.ID.in(equipmentIds), EQUIPMENT.SITEID.eq(siteId)).fetchOne(0, Long.class);
        if (matchCount != equipmentIds.size()) throw ApiException.badRequest("Every assignment must reference equipment in this site");

        boolean enabled = body == null || !body.has("enabled") || body.get("enabled").asBoolean();
        LocalDateTime now = LocalDateTime.now();
        Object result;

        if (kind == Kind.TREND) {
            boolean defExists = dsl.fetchExists(dsl.selectFrom(TRENDDEFINITION).where(TRENDDEFINITION.ID.eq(id), TRENDDEFINITION.SITEID.eq(siteId)));
            if (!defExists) throw ApiException.notFound("Definition not found");
            JsonNode resolvedMappings = body != null ? body.get("resolvedMappings") : null;
            List<TrendassignmentRecord> saved = dsl.transactionResult(cfg -> {
                var tx = org.jooq.impl.DSL.using(cfg);
                List<TrendassignmentRecord> out = new java.util.ArrayList<>();
                for (String equipmentId : equipmentIds) {
                    JsonNode mapping = resolvedMappings != null ? resolvedMappings.get(equipmentId) : null;
                    TrendassignmentRecord existing = tx.selectFrom(TRENDASSIGNMENT)
                        .where(TRENDASSIGNMENT.DEFINITIONID.eq(id), TRENDASSIGNMENT.EQUIPMENTID.eq(equipmentId)).fetchOne();
                    if (existing != null) {
                        existing.setEnabled(enabled);
                        existing.setResolvedmappings(json.toJsonb(mapping != null ? mapping : json.newObject()));
                        existing.setUpdatedat(now);
                        existing.update();
                        out.add(existing);
                    } else {
                        TrendassignmentRecord created = tx.newRecord(TRENDASSIGNMENT);
                        created.setId(UUID.randomUUID().toString());
                        created.setDefinitionid(id);
                        created.setSiteid(siteId);
                        created.setEquipmentid(equipmentId);
                        created.setEnabled(enabled);
                        created.setResolvedmappings(json.toJsonb(mapping != null ? mapping : json.newObject()));
                        created.setCreatedat(now);
                        created.setUpdatedat(now);
                        created.insert();
                        out.add(created);
                    }
                }
                return out;
            });
            result = saved.stream().map(a -> TrendDefinitionDto.TrendAssignmentDto.from(a, json)).toList();
        } else {
            boolean defExists = dsl.fetchExists(dsl.selectFrom(SCHEDULEDEFINITION).where(SCHEDULEDEFINITION.ID.eq(id), SCHEDULEDEFINITION.SITEID.eq(siteId)));
            if (!defExists) throw ApiException.notFound("Definition not found");
            List<ScheduleassignmentRecord> saved = dsl.transactionResult(cfg -> {
                var tx = org.jooq.impl.DSL.using(cfg);
                List<ScheduleassignmentRecord> out = new java.util.ArrayList<>();
                for (String equipmentId : equipmentIds) {
                    ScheduleassignmentRecord existing = tx.selectFrom(SCHEDULEASSIGNMENT)
                        .where(SCHEDULEASSIGNMENT.DEFINITIONID.eq(id), SCHEDULEASSIGNMENT.EQUIPMENTID.eq(equipmentId)).fetchOne();
                    if (existing != null) {
                        existing.setEnabled(enabled);
                        existing.setUpdatedat(now);
                        existing.update();
                        out.add(existing);
                    } else {
                        ScheduleassignmentRecord created = tx.newRecord(SCHEDULEASSIGNMENT);
                        created.setId(UUID.randomUUID().toString());
                        created.setDefinitionid(id);
                        created.setSiteid(siteId);
                        created.setEquipmentid(equipmentId);
                        created.setEnabled(enabled);
                        created.setCreatedat(now);
                        created.setUpdatedat(now);
                        created.insert();
                        out.add(created);
                    }
                }
                return out;
            });
            result = saved.stream().map(ScheduleDefinitionDto.ScheduleAssignmentDto::from).toList();
        }

        refreshHistorianCacheIfTrend(kind);
        return result;
    }

    public void unassign(String siteId, Kind kind, String id, String equipmentId) {
        if (kind == Kind.TREND) {
            dsl.deleteFrom(TRENDASSIGNMENT)
                .where(TRENDASSIGNMENT.DEFINITIONID.eq(id), TRENDASSIGNMENT.SITEID.eq(siteId), TRENDASSIGNMENT.EQUIPMENTID.eq(equipmentId))
                .execute();
        } else {
            dsl.deleteFrom(SCHEDULEASSIGNMENT)
                .where(SCHEDULEASSIGNMENT.DEFINITIONID.eq(id), SCHEDULEASSIGNMENT.SITEID.eq(siteId), SCHEDULEASSIGNMENT.EQUIPMENTID.eq(equipmentId))
                .execute();
        }
        refreshHistorianCacheIfTrend(kind);
    }
}
