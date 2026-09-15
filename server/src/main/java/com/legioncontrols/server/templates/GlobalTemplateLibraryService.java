package com.legioncontrols.server.templates;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.enums.Entitystatus;
import com.legioncontrols.server.jooq.generated.tables.records.GlobalequipmenttemplateRecord;
import com.legioncontrols.server.jooq.generated.tables.records.GlobalgraphictemplateRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;

import static com.legioncontrols.server.jooq.generated.tables.Globalequipmenttemplate.GLOBALEQUIPMENTTEMPLATE;
import static com.legioncontrols.server.jooq.generated.tables.Globalgraphictemplate.GLOBALGRAPHICTEMPLATE;

/** Java equivalent of backend/src/modules/globalTemplateLibrary/globalTemplateLibrary.service.js. */
@Service
public class GlobalTemplateLibraryService {

    private final DSLContext dsl;
    private final JsonUtil json;
    private final LegionStarterEquipmentTemplates starterTemplates;
    private final Object seedLock = new Object();

    public GlobalTemplateLibraryService(DSLContext dsl, JsonUtil json, LegionStarterEquipmentTemplates starterTemplates) {
        this.dsl = dsl;
        this.json = json;
        this.starterTemplates = starterTemplates;
    }

    /** One-time style cleanup: legacy rows were named "Legion AHU", etc. */
    private void stripLegacyLegionPrefixFromGlobalEquipmentNames() {
        dsl.execute("UPDATE \"GlobalEquipmentTemplate\" SET name = TRIM(BOTH ' ' FROM REPLACE(name, 'Legion ', '')) WHERE name LIKE 'Legion %'");
    }

    /** If GlobalEquipmentTemplate has no rows, upsert starter templates. Avoids an empty library when the DB seed was never run. */
    private void ensureGlobalEquipmentStartersInDb() {
        synchronized (seedLock) {
            long count = dsl.selectCount().from(GLOBALEQUIPMENTTEMPLATE).fetchOne(0, Long.class);
            if (count > 0) return;
            LocalDateTime now = LocalDateTime.now();
            for (LegionStarterEquipmentTemplates.SeedRow row : starterTemplates.getGlobalStarterTemplateSeedRows()) {
                GlobalequipmenttemplateRecord existing = dsl.selectFrom(GLOBALEQUIPMENTTEMPLATE).where(GLOBALEQUIPMENTTEMPLATE.ID.eq(row.id())).fetchOne();
                GlobalequipmenttemplateRecord record = existing != null ? existing : dsl.newRecord(GLOBALEQUIPMENTTEMPLATE);
                if (existing == null) {
                    record.setId(row.id());
                    record.setCreatedat(now);
                }
                record.setName(row.name());
                record.setEquipmenttype(row.equipmentType());
                record.setDescription(row.description());
                record.setDefaultgraphicname(row.defaultGraphicName());
                record.setPointsjson(json.toJsonb(row.pointsJson()));
                record.setStatus(Entitystatus.ACTIVE);
                record.setUpdatedat(now);
                if (existing == null) record.insert(); else record.update();
            }
        }
    }

    private ArrayNode normalizePointsJson(JsonNode raw) {
        if (raw != null && raw.isArray()) return (ArrayNode) raw;
        return json.newArray();
    }

    public record EquipmentListRow(String id, String name, String equipmentType, int pointCount, String defaultGraphicName) {
    }

    private EquipmentListRow equipmentListRowFromRecord(GlobalequipmenttemplateRecord r) {
        ArrayNode points = normalizePointsJson(json.toJsonNode(r.getPointsjson()));
        return new EquipmentListRow(r.getId(), r.getName(), r.getEquipmenttype(), points.size(), r.getDefaultgraphicname());
    }

    public List<EquipmentListRow> listEquipmentTemplates() {
        stripLegacyLegionPrefixFromGlobalEquipmentNames();
        ensureGlobalEquipmentStartersInDb();
        return dsl.selectFrom(GLOBALEQUIPMENTTEMPLATE).where(GLOBALEQUIPMENTTEMPLATE.STATUS.eq(Entitystatus.ACTIVE))
            .orderBy(GLOBALEQUIPMENTTEMPLATE.NAME.asc()).fetch().stream().map(this::equipmentListRowFromRecord).toList();
    }

    public record EquipmentDetail(String id, String name, String equipmentType, String description,
                                   String defaultGraphicName, int pointCount, JsonNode points) {
    }

    public EquipmentDetail getEquipmentTemplateById(String id) {
        stripLegacyLegionPrefixFromGlobalEquipmentNames();
        ensureGlobalEquipmentStartersInDb();
        GlobalequipmenttemplateRecord r = dsl.selectFrom(GLOBALEQUIPMENTTEMPLATE)
            .where(GLOBALEQUIPMENTTEMPLATE.ID.eq(id), GLOBALEQUIPMENTTEMPLATE.STATUS.eq(Entitystatus.ACTIVE)).fetchOne();
        if (r == null) throw ApiException.notFound("Global equipment template not found");
        ArrayNode points = normalizePointsJson(json.toJsonNode(r.getPointsjson()));
        return new EquipmentDetail(r.getId(), r.getName(), r.getEquipmenttype(), r.getDescription() != null ? r.getDescription() : "",
            r.getDefaultgraphicname(), points.size(), points);
    }

    public EquipmentDetail createEquipmentTemplateFromSitePayload(JsonNode body) {
        if (body == null || !body.isObject()) throw ApiException.badRequest("Invalid body");
        String name = body.hasNonNull("name") ? body.get("name").asText().trim() : "";
        if (name.isEmpty()) throw ApiException.badRequest("name is required");
        String equipmentType = body.hasNonNull("equipmentType") && !body.get("equipmentType").asText().isBlank()
            ? body.get("equipmentType").asText().trim() : "CUSTOM";
        String description = body.hasNonNull("description") ? body.get("description").asText().trim() : "";
        String defaultGraphicName = firstNonBlank(body, "defaultGraphicName", "defaultGraphic");
        ArrayNode points = normalizePointsJson(body.get("points"));

        LocalDateTime now = LocalDateTime.now();
        GlobalequipmenttemplateRecord record = dsl.newRecord(GLOBALEQUIPMENTTEMPLATE);
        record.setId(UUID.randomUUID().toString());
        record.setName(name);
        record.setEquipmenttype(equipmentType);
        record.setDescription(description);
        record.setDefaultgraphicname(defaultGraphicName);
        record.setPointsjson(json.toJsonb(points));
        record.setCreatedat(now);
        record.setUpdatedat(now);
        record.insert();

        return getEquipmentTemplateById(record.getId());
    }

    private static String firstNonBlank(JsonNode body, String... fields) {
        for (String f : fields) {
            if (body.hasNonNull(f) && !body.get(f).asText().isBlank()) return body.get(f).asText().trim();
        }
        return null;
    }

    public EquipmentListRow updateEquipmentTemplateName(String id, JsonNode body) {
        String name = body != null && body.hasNonNull("name") ? body.get("name").asText().trim() : "";
        if (name.isEmpty()) throw ApiException.badRequest("name is required");
        GlobalequipmenttemplateRecord r = dsl.selectFrom(GLOBALEQUIPMENTTEMPLATE).where(GLOBALEQUIPMENTTEMPLATE.ID.eq(id)).fetchOne();
        if (r == null) throw ApiException.notFound("Global equipment template not found");
        r.setName(name);
        r.setUpdatedat(LocalDateTime.now());
        r.update();
        return equipmentListRowFromRecord(r);
    }

    public void deleteEquipmentTemplate(String id) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(GLOBALEQUIPMENTTEMPLATE).where(GLOBALEQUIPMENTTEMPLATE.ID.eq(id)));
        if (!exists) throw ApiException.notFound("Global equipment template not found");
        dsl.deleteFrom(GLOBALEQUIPMENTTEMPLATE).where(GLOBALEQUIPMENTTEMPLATE.ID.eq(id)).execute();
    }

    private static int countBindingsFromGraphicState(JsonNode state) {
        if (state == null || !state.isObject()) return 0;
        JsonNode objects = state.get("objects");
        if (objects == null || !objects.isArray()) return 0;
        int count = 0;
        for (JsonNode o : objects) {
            if (o != null && o.hasNonNull("pointBinding") && !o.get("pointBinding").asText().isBlank()) count++;
        }
        return count;
    }

    public record GraphicListRow(String id, String name, String appliesToEquipmentType, int boundPointCount,
                                  String globalEquipmentTemplateId, String equipmentTemplateName) {
    }

    private GraphicListRow graphicListRowFromRecord(GlobalgraphictemplateRecord r) {
        return new GraphicListRow(r.getId(), r.getName(), r.getAppliestoequipmenttype(),
            r.getBoundpointcount() != null ? r.getBoundpointcount() : 0, r.getGlobalequipmenttemplateid(), r.getEquipmenttemplatename());
    }

    public GraphicListRow updateGraphicTemplateName(String id, JsonNode body) {
        String name = body != null && body.hasNonNull("name") ? body.get("name").asText().trim() : "";
        if (name.isEmpty()) throw ApiException.badRequest("name is required");
        GlobalgraphictemplateRecord r = dsl.selectFrom(GLOBALGRAPHICTEMPLATE).where(GLOBALGRAPHICTEMPLATE.ID.eq(id)).fetchOne();
        if (r == null) throw ApiException.notFound("Global graphic template not found");
        r.setName(name);
        r.setUpdatedat(LocalDateTime.now());
        r.update();
        return graphicListRowFromRecord(r);
    }

    public void deleteGraphicTemplate(String id) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(GLOBALGRAPHICTEMPLATE).where(GLOBALGRAPHICTEMPLATE.ID.eq(id)));
        if (!exists) throw ApiException.notFound("Global graphic template not found");
        dsl.deleteFrom(GLOBALGRAPHICTEMPLATE).where(GLOBALGRAPHICTEMPLATE.ID.eq(id)).execute();
    }

    public List<GraphicListRow> listGraphicTemplates() {
        return dsl.selectFrom(GLOBALGRAPHICTEMPLATE).where(GLOBALGRAPHICTEMPLATE.STATUS.eq(Entitystatus.ACTIVE))
            .orderBy(GLOBALGRAPHICTEMPLATE.NAME.asc()).fetch().stream().map(this::graphicListRowFromRecord).toList();
    }

    public record GraphicDetail(String id, String name, String appliesToEquipmentType, String globalEquipmentTemplateId,
                                 String equipmentTemplateName, int boundPointCount, JsonNode graphicEditorState) {
    }

    public GraphicDetail getGraphicTemplateById(String id) {
        GlobalgraphictemplateRecord r = dsl.selectFrom(GLOBALGRAPHICTEMPLATE)
            .where(GLOBALGRAPHICTEMPLATE.ID.eq(id), GLOBALGRAPHICTEMPLATE.STATUS.eq(Entitystatus.ACTIVE)).fetchOne();
        if (r == null) throw ApiException.notFound("Global graphic template not found");
        JsonNode state = r.getGraphiceditorstatejson() != null ? json.toJsonNode(r.getGraphiceditorstatejson()) : null;
        state = state != null && state.isObject() ? state : null;
        int boundFromState = countBindingsFromGraphicState(state);
        int stored = r.getBoundpointcount() != null ? r.getBoundpointcount() : 0;
        return new GraphicDetail(r.getId(), r.getName(), r.getAppliestoequipmenttype(), r.getGlobalequipmenttemplateid(),
            r.getEquipmenttemplatename(), Math.max(stored, boundFromState), state);
    }

    public GraphicDetail createGraphicTemplateFromSitePayload(JsonNode body, JsonNode equipmentTemplates) {
        if (body == null || !body.isObject()) throw ApiException.badRequest("Invalid body");
        String name = body.hasNonNull("name") ? body.get("name").asText().trim() : "";
        if (name.isEmpty()) throw ApiException.badRequest("name is required");

        String appliesToEquipmentType = body.hasNonNull("appliesToEquipmentType") ? body.get("appliesToEquipmentType").asText().trim() : "";
        String globalEquipmentTemplateId = body.hasNonNull("globalEquipmentTemplateId") ? body.get("globalEquipmentTemplateId").asText() : null;
        String equipmentTemplateName = body.hasNonNull("equipmentTemplateName") ? body.get("equipmentTemplateName").asText() : null;

        JsonNode siteEq = null;
        String siteEqId = body.hasNonNull("equipmentTemplateId") ? body.get("equipmentTemplateId").asText() : null;
        if (equipmentTemplates != null && equipmentTemplates.isArray()) {
            for (JsonNode e : equipmentTemplates) {
                if (siteEqId != null) {
                    if (e.hasNonNull("id") && siteEqId.equals(e.get("id").asText())) { siteEq = e; break; }
                } else {
                    String appliesTo = body.hasNonNull("appliesTo") ? body.get("appliesTo").asText().toLowerCase() : "";
                    if (e.hasNonNull("name") && e.get("name").asText().toLowerCase().equals(appliesTo)) { siteEq = e; break; }
                }
            }
        }

        if (appliesToEquipmentType.isEmpty() && siteEq != null) {
            appliesToEquipmentType = siteEq.hasNonNull("equipmentType") && !siteEq.get("equipmentType").asText().isBlank()
                ? siteEq.get("equipmentType").asText().trim() : "CUSTOM";
        }
        if (appliesToEquipmentType.isEmpty()) appliesToEquipmentType = "CUSTOM";
        if (equipmentTemplateName == null && siteEq != null && siteEq.hasNonNull("name")) {
            equipmentTemplateName = siteEq.get("name").asText();
        }

        JsonNode graphicEditorState = body.get("graphicEditorState");
        graphicEditorState = graphicEditorState != null && graphicEditorState.isObject() ? graphicEditorState : null;
        int boundPointCount = body.has("boundPointCount") && body.get("boundPointCount").isNumber()
            ? body.get("boundPointCount").asInt() : countBindingsFromGraphicState(graphicEditorState);

        LocalDateTime now = LocalDateTime.now();
        GlobalgraphictemplateRecord record = dsl.newRecord(GLOBALGRAPHICTEMPLATE);
        record.setId(UUID.randomUUID().toString());
        record.setName(name);
        record.setAppliestoequipmenttype(appliesToEquipmentType);
        record.setGlobalequipmenttemplateid(globalEquipmentTemplateId);
        record.setEquipmenttemplatename(equipmentTemplateName);
        if (graphicEditorState != null) record.setGraphiceditorstatejson(json.toJsonb(graphicEditorState));
        record.setBoundpointcount(boundPointCount);
        record.setCreatedat(now);
        record.setUpdatedat(now);
        record.insert();

        return getGraphicTemplateById(record.getId());
    }
}
