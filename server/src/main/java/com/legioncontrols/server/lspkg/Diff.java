package com.legioncontrols.server.lspkg;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

/**
 * Java port of backend/src/lib/lspkg/diff.js — the shared change-preview engine (LC-ARCH-002 §7
 * "Change Preview, Activation & Rollback"). Operates on two "file bundles" shaped like a package's
 * `files` map ({@code { "equipment.json": {...}, "alarms.json": {...}, ... }}). Comparison is always
 * by the object's stable {@code id} (the Prisma/Postgres UUID carried inside the package), never by
 * array position, so reordering never reads as a change.
 */
public final class Diff {

    private Diff() {
    }

    private record CollectionSpec(String collection, String file, String arrayPath) {
    }

    private static final CollectionSpec[] COLLECTIONS = {
        new CollectionSpec("equipment", "equipment.json", "equipment"),
        new CollectionSpec("points", "equipment.json", "points"),
        new CollectionSpec("controllers", "mappings.json", "controllers"),
        new CollectionSpec("pointMappings", "mappings.json", "pointMappings"),
        new CollectionSpec("alarmDefinitions", "alarms.json", "alarmDefinitions"),
        new CollectionSpec("trendDefinitions", "trends.json", "trendDefinitions"),
        new CollectionSpec("scheduleDefinitions", "schedules.json", "scheduleDefinitions"),
    };

    private static JsonNode arrayFromBundle(Map<String, JsonNode> bundle, String file, String arrayKey) {
        if (bundle == null) return null;
        JsonNode fileNode = bundle.get(file);
        if (fileNode == null || !fileNode.isObject()) return null;
        return fileNode.get(arrayKey);
    }

    private static Map<String, JsonNode> byId(JsonNode arrayOrNull) {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        if (arrayOrNull == null || !arrayOrNull.isArray()) return map;
        for (JsonNode item : arrayOrNull) {
            if (item != null && item.isObject() && item.hasNonNull("id")) {
                map.put(item.get("id").asString(), item);
            }
        }
        return map;
    }

    public static ObjectNode computeChangePreview(Map<String, JsonNode> previousBundle, Map<String, JsonNode> nextBundle) {
        ObjectNode collections = JsonNodeFactory.instance.objectNode();

        for (CollectionSpec spec : COLLECTIONS) {
            Map<String, JsonNode> prevMap = byId(arrayFromBundle(previousBundle, spec.file(), spec.arrayPath()));
            Map<String, JsonNode> nextMap = byId(arrayFromBundle(nextBundle, spec.file(), spec.arrayPath()));

            ArrayNode added = JsonNodeFactory.instance.arrayNode();
            ArrayNode changed = JsonNodeFactory.instance.arrayNode();
            ArrayNode removed = JsonNodeFactory.instance.arrayNode();
            ArrayNode preserved = JsonNodeFactory.instance.arrayNode();

            for (var entry : nextMap.entrySet()) {
                if (!prevMap.containsKey(entry.getKey())) {
                    added.add(entry.getKey());
                } else {
                    JsonNode prevItem = prevMap.get(entry.getKey());
                    if (Checksum.canonicalStringify(prevItem).equals(Checksum.canonicalStringify(entry.getValue()))) {
                        preserved.add(entry.getKey());
                    } else {
                        changed.add(entry.getKey());
                    }
                }
            }
            for (String id : prevMap.keySet()) {
                if (!nextMap.containsKey(id)) removed.add(id);
            }

            ObjectNode result = JsonNodeFactory.instance.objectNode();
            result.set("added", added);
            result.set("changed", changed);
            result.set("removed", removed);
            result.set("preserved", preserved);
            collections.set(spec.collection(), result);
        }

        Set<String> nextEquipmentIds = idSet(arrayFromBundle(nextBundle, "equipment.json", "equipment"));
        Set<String> nextControllerIds = idSet(arrayFromBundle(nextBundle, "mappings.json", "controllers"));
        Set<String> nextPointIds = idSet(arrayFromBundle(nextBundle, "equipment.json", "points"));

        ArrayNode unresolved = JsonNodeFactory.instance.arrayNode();

        JsonNode alarms = arrayFromBundle(nextBundle, "alarms.json", "alarmDefinitions");
        if (alarms != null && alarms.isArray()) {
            for (JsonNode alarm : alarms) {
                String equipmentId = textOrNull(alarm, "equipmentId");
                if (equipmentId == null || !nextEquipmentIds.contains(equipmentId)) {
                    unresolved.add(unresolvedEntry("alarmDefinitions", textOrNull(alarm, "id"),
                        "references missing equipmentId " + equipmentId));
                } else if (alarm.get("pointId") == null || alarm.get("pointId").isNull()) {
                    unresolved.add(unresolvedEntry("alarmDefinitions", textOrNull(alarm, "id"),
                        "pointKey \"" + textOrNull(alarm, "pointKey") + "\" is not yet bound to a Point"));
                }
            }
        }

        JsonNode mappings = arrayFromBundle(nextBundle, "mappings.json", "pointMappings");
        if (mappings != null && mappings.isArray()) {
            for (JsonNode mapping : mappings) {
                String controllerId = textOrNull(mapping, "equipmentControllerId");
                String pointId = textOrNull(mapping, "pointId");
                if (controllerId == null || !nextControllerIds.contains(controllerId)) {
                    unresolved.add(unresolvedEntry("pointMappings", textOrNull(mapping, "id"),
                        "references missing controller " + controllerId));
                } else if (pointId == null || !nextPointIds.contains(pointId)) {
                    unresolved.add(unresolvedEntry("pointMappings", textOrNull(mapping, "id"),
                        "references missing point " + pointId));
                } else if (!mapping.path("isBound").asBoolean(true)) {
                    unresolved.add(unresolvedEntry("pointMappings", textOrNull(mapping, "id"), "mapping is not yet bound"));
                }
            }
        }

        JsonNode trends = arrayFromBundle(nextBundle, "trends.json", "trendDefinitions");
        if (trends != null && trends.isArray()) {
            for (JsonNode trend : trends) {
                JsonNode assignments = trend.get("assignments");
                if (assignments != null && assignments.isArray()) {
                    for (JsonNode assignment : assignments) {
                        String equipmentId = textOrNull(assignment, "equipmentId");
                        if (equipmentId == null || !nextEquipmentIds.contains(equipmentId)) {
                            unresolved.add(unresolvedEntry("trendDefinitions", textOrNull(trend, "id"),
                                "assignment references missing equipmentId " + equipmentId));
                        }
                    }
                }
            }
        }

        JsonNode schedules = arrayFromBundle(nextBundle, "schedules.json", "scheduleDefinitions");
        if (schedules != null && schedules.isArray()) {
            for (JsonNode schedule : schedules) {
                JsonNode assignments = schedule.get("assignments");
                if (assignments != null && assignments.isArray()) {
                    for (JsonNode assignment : assignments) {
                        String equipmentId = textOrNull(assignment, "equipmentId");
                        if (equipmentId == null || !nextEquipmentIds.contains(equipmentId)) {
                            unresolved.add(unresolvedEntry("scheduleDefinitions", textOrNull(schedule, "id"),
                                "assignment references missing equipmentId " + equipmentId));
                        }
                    }
                }
            }
        }

        ArrayNode preservedByPolicy = JsonNodeFactory.instance.arrayNode();
        preservedByPolicy.add("Point history (PointHistorySample)");
        preservedByPolicy.add("Alarm/event history (AlarmEvent)");
        preservedByPolicy.add("Audit/deployment history");
        preservedByPolicy.add("Operational users and credentials");
        preservedByPolicy.add("Current live values and communication state");

        ObjectNode out = JsonNodeFactory.instance.objectNode();
        out.set("collections", collections);
        out.set("unresolved", unresolved);
        out.set("preservedByPolicy", preservedByPolicy);
        return out;
    }

    private static ObjectNode unresolvedEntry(String collection, String id, String reason) {
        ObjectNode node = JsonNodeFactory.instance.objectNode();
        node.put("collection", collection);
        node.put("id", id);
        node.put("reason", reason);
        return node;
    }

    private static Set<String> idSet(JsonNode array) {
        Set<String> out = new LinkedHashSet<>();
        if (array != null && array.isArray()) {
            for (JsonNode item : array) {
                String id = textOrNull(item, "id");
                if (id != null) out.add(id);
            }
        }
        return out;
    }

    private static String textOrNull(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode value = node.get(field);
        return value != null && !value.isNull() ? value.asString() : null;
    }

    /**
     * Normalizes a raw JSONB payload (e.g. a SiteVersion's stored payload) into a
     * {@code Map<String, JsonNode>} "bundle" keyed by top-level property name, for use as either
     * side of {@link #computeChangePreview}. Returns an empty map for {@code null} or a non-object
     * node rather than throwing — a bundle missing a key entirely reads as an empty collection for
     * that key, never a crash (matches backend/src/lib/lspkg/diff.js's own tolerance of legacy
     * pre-package deployment snapshots that never tracked alarms/trends/schedules).
     */
    public static Map<String, JsonNode> toBundle(JsonNode node) {
        Map<String, JsonNode> out = new LinkedHashMap<>();
        if (node != null && node.isObject()) {
            for (String key : node.propertyNames()) out.put(key, node.get(key));
        }
        return out;
    }
}
