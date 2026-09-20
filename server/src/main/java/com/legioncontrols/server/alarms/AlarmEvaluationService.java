package com.legioncontrols.server.alarms;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.enums.Alarmeventstate;
import com.legioncontrols.server.jooq.generated.tables.records.AlarmdefinitionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.AlarmeventRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import static com.legioncontrols.server.jooq.generated.tables.Alarmdefinition.ALARMDEFINITION;
import static com.legioncontrols.server.jooq.generated.tables.Alarmevent.ALARMEVENT;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;

/**
 * Java equivalent of the evaluation engine in backend/src/modules/alarms/alarm.service.js.
 * Alarm state and communication state are independent (AGENTS.md) — this reads Point.presentValue
 * directly, entirely Server-owned (not Runtime-owned), exactly as in Node.
 */
@Service
public class AlarmEvaluationService {

    private final DSLContext dsl;
    private final JsonUtil json;

    /** definitionId -> first-violated epoch ms (process-local, matches Node's in-memory Map). */
    private final ConcurrentHashMap<String, Long> delayFirstViolatedAt = new ConcurrentHashMap<>();

    public AlarmEvaluationService(DSLContext dsl, JsonUtil json) {
        this.dsl = dsl;
        this.json = json;
    }

    // ---- value parsing -------------------------------------------------------------------

    private enum Kind { EMPTY, BOOL, NUM, STR }

    private record Parsed(Kind kind, Double num, Boolean bool, String str) {
    }

    private static Parsed parsePresentValue(String raw) {
        if (raw == null || raw.isEmpty()) return new Parsed(Kind.EMPTY, null, null, "");
        String s = raw.trim();
        if (s.isEmpty()) return new Parsed(Kind.EMPTY, null, null, "");
        String lower = s.toLowerCase();
        if (lower.equals("true") || lower.equals("on") || lower.equals("active")) return new Parsed(Kind.BOOL, null, true, s);
        if (lower.equals("false") || lower.equals("off") || lower.equals("inactive")) return new Parsed(Kind.BOOL, null, false, s);
        if (s.equals("1")) return new Parsed(Kind.BOOL, null, true, s);
        if (s.equals("0")) return new Parsed(Kind.BOOL, null, false, s);
        if (s.matches("-?\\d+(\\.\\d+)?")) return new Parsed(Kind.NUM, Double.parseDouble(s), null, s);
        return new Parsed(Kind.STR, null, null, s);
    }

    private static boolean isOn(Parsed p) {
        if (p.kind() == Kind.BOOL) return Boolean.TRUE.equals(p.bool());
        if (p.kind() == Kind.NUM) return p.num() != 0;
        String lower = p.str().toLowerCase();
        return lower.equals("on") || lower.equals("active") || lower.equals("true") || lower.equals("run") || lower.equals("running");
    }

    private static boolean isOff(Parsed p) {
        if (p.kind() == Kind.BOOL) return Boolean.FALSE.equals(p.bool());
        if (p.kind() == Kind.NUM) return p.num() == 0;
        String lower = p.str().toLowerCase();
        return lower.equals("off") || lower.equals("inactive") || lower.equals("false") || lower.equals("stop") || lower.equals("stopped");
    }

    private static Double numericOrNull(Parsed p) {
        if (p.kind() == Kind.NUM) return p.num();
        if (p.kind() == Kind.BOOL) return Boolean.TRUE.equals(p.bool()) ? 1.0 : 0.0;
        if (p.kind() == Kind.EMPTY) return null;
        try {
            return Double.parseDouble(p.str());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private record EvalResult(boolean violated, String displayValue) {
    }

    // ---- condition tree --------------------------------------------------------------------

    private EvalResult evaluateLeaf(JsonNode leaf, java.util.Map<String, PointRecord> pointsByKey) {
        String pointKeyRef = textOrEmpty(leaf, "pointKey", "pointId");
        PointRecord source = pointsByKey.get(pointKeyRef);
        if (source == null) return new EvalResult(false, "—");
        Parsed a = parsePresentValue(source.getPresentvalue());
        String targetKey = textOrNull(leaf, "targetPointKey");
        PointRecord targetPoint = targetKey != null ? pointsByKey.get(targetKey) : null;
        Parsed b = targetPoint != null ? parsePresentValue(targetPoint.getPresentvalue()) : null;
        JsonNode valueNode = leaf.get("value");
        Double n = valueNode == null || valueNode.isNull() || valueNode.asText("").isEmpty() ? null : parseNumeric(valueNode);
        String op = textOrNull(leaf, "operator");
        boolean violated = false;
        if ("IS_ON".equals(op)) violated = isOn(a);
        else if ("IS_OFF".equals(op)) violated = isOff(a);
        else if (targetPoint != null) {
            Double av = numericOrNull(a), bv = numericOrNull(b);
            if (av != null && bv != null) {
                violated = compare(op, av, bv);
            } else if ("EQ".equals(op) || "NEQ".equals(op)) {
                violated = "EQ".equals(op) ? a.str().equals(b.str()) : !a.str().equals(b.str());
            }
        } else if ("EQ".equals(op) || "NEQ".equals(op)) {
            String expected = (valueNode != null ? valueNode.asText("") : "").toLowerCase();
            String actual = a.str().toLowerCase();
            violated = "EQ".equals(op) ? actual.equals(expected) : !actual.equals(expected);
        } else if (n != null && numericOrNull(a) != null) {
            violated = compare(op, numericOrNull(a), n);
        }
        return new EvalResult(violated, source.getPresentvalue() == null ? "—" : source.getPresentvalue());
    }

    private static boolean compare(String op, double av, double bv) {
        return switch (op) {
            case "EQ" -> av == bv;
            case "NEQ" -> av != bv;
            case "GT" -> av > bv;
            case "GTE" -> av >= bv;
            case "LT" -> av < bv;
            case "LTE" -> av <= bv;
            default -> false;
        };
    }

    private EvalResult evaluateConditionTree(JsonNode node, java.util.Map<String, PointRecord> pointsByKey) {
        if (node == null || node.isNull()) return new EvalResult(false, "—");
        String type = textOrNull(node, "type");
        if ("condition".equals(type) || "comparison".equals(type)) return evaluateLeaf(node, pointsByKey);
        JsonNode children = node.get("children");
        List<EvalResult> results = new ArrayList<>();
        if (children != null && children.isArray()) {
            for (JsonNode child : children) results.add(evaluateConditionTree(child, pointsByKey));
        }
        String logic = textOrNull(node, "logic");
        boolean violated = "OR".equalsIgnoreCase(logic)
            ? results.stream().anyMatch(EvalResult::violated)
            : !results.isEmpty() && results.stream().allMatch(EvalResult::violated);
        String displayValue = results.stream().map(EvalResult::displayValue).filter(v -> !v.equals("—")).findFirst().orElse("—");
        return new EvalResult(violated, displayValue);
    }

    private Set<String> collectConditionTreeKeys(JsonNode node) {
        Set<String> out = new LinkedHashSet<>();
        collectConditionTreeKeysInto(node, out);
        return out;
    }

    private void collectConditionTreeKeysInto(JsonNode node, Set<String> out) {
        if (node == null || node.isNull()) return;
        String type = textOrNull(node, "type");
        if ("condition".equals(type) || "comparison".equals(type)) {
            String pk = textOrNull(node, "pointKey");
            String tpk = textOrNull(node, "targetPointKey");
            if (pk != null) out.add(pk);
            if (tpk != null) out.add(tpk);
            return;
        }
        JsonNode children = node.get("children");
        if (children != null && children.isArray()) {
            for (JsonNode child : children) collectConditionTreeKeysInto(child, out);
        }
    }

    // ---- flat category/operator evaluation --------------------------------------------------

    private EvalResult evaluateCondition(AlarmdefinitionRecord def, PointRecord point, PointRecord targetPoint) {
        Parsed src = parsePresentValue(point != null ? point.getPresentvalue() : null);
        String displayValue = point != null && point.getPresentvalue() != null ? point.getPresentvalue() : "—";
        Parsed tgt = targetPoint != null ? parsePresentValue(targetPoint.getPresentvalue()) : null;
        Double threshold = def.getTargetvalue();
        String cat = def.getCategory().getLiteral();
        String op = def.getOperator().getLiteral();

        if ("BINARY".equals(cat)) {
            if ("IS_ON".equals(op)) return new EvalResult(isOn(src), displayValue);
            if ("IS_OFF".equals(op)) return new EvalResult(isOff(src), displayValue);
            return new EvalResult(false, displayValue);
        }
        if ("DEVIATION".equals(cat)) {
            if (targetPoint == null || threshold == null) return new EvalResult(false, displayValue);
            Double a = numericOrNull(src), b = numericOrNull(tgt);
            if (a == null || b == null) return new EvalResult(false, displayValue);
            double diff = a - b;
            boolean v = switch (op) {
                case "DELTA_GT" -> diff > threshold;
                case "DELTA_GTE" -> diff >= threshold;
                case "DELTA_LT" -> diff < threshold;
                case "DELTA_LTE" -> diff <= threshold;
                default -> false;
            };
            return new EvalResult(v, displayValue);
        }
        if ("COMPARISON".equals(cat)) {
            if (targetPoint == null) return new EvalResult(false, displayValue);
            Double aNum = numericOrNull(src), bNum = numericOrNull(tgt);
            if (aNum != null && bNum != null) {
                return new EvalResult(compare(op, aNum, bNum), displayValue);
            }
            String aStr = !src.str().isEmpty() ? src.str() : displayValue;
            String bStr = tgt != null && !tgt.str().isEmpty() ? tgt.str() : (targetPoint.getPresentvalue() != null ? targetPoint.getPresentvalue() : "");
            if ("EQ".equals(op)) return new EvalResult(aStr.equals(bStr), displayValue);
            if ("NEQ".equals(op)) return new EvalResult(!aStr.equals(bStr), displayValue);
            return new EvalResult(false, displayValue);
        }
        return new EvalResult(false, displayValue);
    }

    private EvalResult evaluateThresholdWithHysteresis(AlarmdefinitionRecord def, PointRecord point, boolean hasActive) {
        Parsed src = parsePresentValue(point != null ? point.getPresentvalue() : null);
        String displayValue = point != null && point.getPresentvalue() != null ? point.getPresentvalue() : "—";
        Double t = def.getTargetvalue();
        double dead = def.getDeadband() != null ? def.getDeadband() : 0;
        Double v = numericOrNull(src);
        if (v == null || t == null) return new EvalResult(false, displayValue);
        String op = def.getOperator().getLiteral();

        boolean enter = switch (op) {
            case "GT" -> v > t; case "GTE" -> v >= t; case "LT" -> v < t; case "LTE" -> v <= t;
            case "EQ" -> v.doubleValue() == t; case "NEQ" -> v.doubleValue() != t; default -> false;
        };
        boolean clear = switch (op) {
            case "GT" -> v <= t - dead; case "GTE" -> v < t - dead; case "LT" -> v >= t + dead; case "LTE" -> v > t + dead;
            case "EQ" -> v.doubleValue() != t; case "NEQ" -> v.doubleValue() == t; default -> true;
        };
        if (!hasActive) return new EvalResult(enter, displayValue);
        if (enter) return new EvalResult(true, displayValue);
        return new EvalResult(!clear, displayValue);
    }

    private static String buildMessage(AlarmdefinitionRecord def, PointRecord point, String displayValue) {
        if (def.getMessagetemplate() != null && !def.getMessagetemplate().isBlank()) {
            return def.getMessagetemplate()
                .replaceAll("(?i)\\{value\\}", java.util.regex.Matcher.quoteReplacement(displayValue))
                .replaceAll("(?i)\\{name\\}", java.util.regex.Matcher.quoteReplacement(def.getName()));
        }
        String label = point != null ? (point.getPointname() != null ? point.getPointname() : point.getPointcode()) : def.getPointkey();
        return def.getName() + ": " + (label != null ? label : "Point") + " = " + displayValue;
    }

    // ---- point resolution ------------------------------------------------------------------

    private PointRecord resolveLivePoint(AlarmdefinitionRecord def, boolean source) {
        String pid = source ? def.getPointid() : def.getTargetpointid();
        String key = (source ? def.getPointkey() : def.getTargetpointkey());
        key = key != null ? key.trim() : "";

        if (pid != null) {
            PointRecord p = dsl.selectFrom(POINT)
                .where(POINT.ID.eq(pid), POINT.EQUIPMENTID.eq(def.getEquipmentid()), POINT.SITEID.eq(def.getSiteid()))
                .fetchOne();
            if (p != null) return p;
        }
        if (!key.isEmpty()) {
            return dsl.selectFrom(POINT)
                .where(POINT.EQUIPMENTID.eq(def.getEquipmentid()), POINT.SITEID.eq(def.getSiteid()), POINT.POINTCODE.eq(key))
                .fetchOne();
        }
        return null;
    }

    private AlarmdefinitionRecord persistResolvedPointers(AlarmdefinitionRecord def, PointRecord sourcePoint, PointRecord targetPoint) {
        boolean changed = false;
        if (sourcePoint != null && !sourcePoint.getId().equals(def.getPointid())) {
            def.setPointid(sourcePoint.getId());
            changed = true;
        }
        if (targetPoint != null && !targetPoint.getId().equals(def.getTargetpointid())) {
            def.setTargetpointid(targetPoint.getId());
            changed = true;
        }
        if (changed) {
            def.setUpdatedat(LocalDateTime.now());
            def.update();
        }
        return def;
    }

    /** When a Point row is created/updated, link alarm definitions that use the same logical key. */
    public void syncAlarmDefinitionsAfterPointWrite(PointRecord point) {
        if (point == null || point.getSiteid() == null || point.getEquipmentid() == null || point.getPointcode() == null) return;
        dsl.update(ALARMDEFINITION).set(ALARMDEFINITION.POINTID, point.getId())
            .where(ALARMDEFINITION.SITEID.eq(point.getSiteid()), ALARMDEFINITION.EQUIPMENTID.eq(point.getEquipmentid()),
                ALARMDEFINITION.POINTKEY.eq(point.getPointcode()), ALARMDEFINITION.POINTID.isNull())
            .execute();
        dsl.update(ALARMDEFINITION).set(ALARMDEFINITION.TARGETPOINTID, point.getId())
            .where(ALARMDEFINITION.SITEID.eq(point.getSiteid()), ALARMDEFINITION.EQUIPMENTID.eq(point.getEquipmentid()),
                ALARMDEFINITION.TARGETPOINTKEY.eq(point.getPointcode()), ALARMDEFINITION.TARGETPOINTID.isNull())
            .execute();
    }

    // ---- evaluation orchestration -----------------------------------------------------------

    public void evaluateDefinitionById(String definitionId) {
        AlarmdefinitionRecord row = dsl.selectFrom(ALARMDEFINITION).where(ALARMDEFINITION.ID.eq(definitionId)).fetchOne();
        if (row != null) evaluateOneDefinition(row);
    }

    private void evaluateOneDefinition(AlarmdefinitionRecord initial) {
        if (initial == null || !Boolean.TRUE.equals(initial.getEnabled())) return;
        AlarmdefinitionRecord full = dsl.selectFrom(ALARMDEFINITION).where(ALARMDEFINITION.ID.eq(initial.getId())).fetchOne();
        if (full == null) return;

        JsonNode conditionTree = full.getConditiontree() != null ? json.toJsonNode(full.getConditiontree()) : null;
        Set<String> treeKeys = conditionTree != null ? collectConditionTreeKeys(conditionTree) : Set.of();

        List<PointRecord> treePoints = treeKeys.isEmpty() ? List.of() : dsl.selectFrom(POINT)
            .where(POINT.EQUIPMENTID.eq(full.getEquipmentid()), POINT.SITEID.eq(full.getSiteid()), POINT.POINTCODE.in(treeKeys))
            .fetch();
        java.util.Map<String, PointRecord> pointsByKey = new java.util.HashMap<>();
        for (PointRecord p : treePoints) pointsByKey.put(p.getPointcode(), p);

        PointRecord sourcePoint = !treeKeys.isEmpty() ? (treePoints.isEmpty() ? null : treePoints.get(0)) : resolveLivePoint(full, true);
        boolean needsTarget = conditionTree == null && ("DEVIATION".equals(full.getCategory().getLiteral()) || "COMPARISON".equals(full.getCategory().getLiteral()));
        PointRecord targetPoint = needsTarget ? resolveLivePoint(full, false) : null;

        if (sourcePoint != null || targetPoint != null) {
            full = persistResolvedPointers(full, sourcePoint, targetPoint);
        }

        AlarmeventRecord active = dsl.selectFrom(ALARMEVENT)
            .where(ALARMEVENT.ALARMDEFINITIONID.eq(full.getId()), ALARMEVENT.STATE.eq(Alarmeventstate.ACTIVE))
            .fetchOne();

        LocalDateTime now = LocalDateTime.now();

        if (sourcePoint == null) {
            delayFirstViolatedAt.remove(full.getId());
            if (active != null) {
                clearActive(active, now, full.getName() + ": cleared — no live source for " + full.getPointkey(), null);
            }
            return;
        }
        if (needsTarget && targetPoint == null) {
            delayFirstViolatedAt.remove(full.getId());
            if (active != null) {
                clearActive(active, now, full.getName() + ": cleared — reference point not bound", null);
            }
            return;
        }

        EvalResult result = conditionTree != null
            ? evaluateConditionTree(conditionTree, pointsByKey)
            : "THRESHOLD".equals(full.getCategory().getLiteral())
                ? evaluateThresholdWithHysteresis(full, sourcePoint, active != null)
                : evaluateCondition(full, sourcePoint, needsTarget ? targetPoint : resolvePersistedTargetPoint(full));

        int delaySec = full.getDelayseconds() != null && full.getDelayseconds() > 0 ? full.getDelayseconds() : 0;
        boolean effectiveViolated = result.violated();
        if (result.violated() && delaySec > 0) {
            long nowMs = now.toInstant(ZoneOffset.UTC).toEpochMilli();
            long first = delayFirstViolatedAt.computeIfAbsent(full.getId(), k -> nowMs);
            if ((nowMs - first) / 1000.0 < delaySec) effectiveViolated = false;
        } else if (!result.violated()) {
            delayFirstViolatedAt.remove(full.getId());
        }

        String message = buildMessage(full, sourcePoint, result.displayValue());

        if (effectiveViolated) {
            if (active == null) {
                AlarmeventRecord created = dsl.newRecord(ALARMEVENT);
                created.setId(UUID.randomUUID().toString());
                created.setAlarmdefinitionid(full.getId());
                created.setSiteid(full.getSiteid());
                created.setEquipmentid(full.getEquipmentid());
                created.setPointid(sourcePoint.getId());
                created.setState(Alarmeventstate.ACTIVE);
                created.setAck(Boolean.TRUE.equals(full.getAutoacknowledge()));
                created.setMessage(message);
                created.setActivevalue(result.displayValue());
                created.setLastevaluatedat(now);
                created.setOccurredat(now);
                created.setCreatedat(now);
                created.setUpdatedat(now);
                created.insert();
            } else {
                active.setLastevaluatedat(now);
                active.setActivevalue(result.displayValue());
                active.setMessage(message);
                active.setPointid(sourcePoint.getId());
                active.setUpdatedat(now);
                active.update();
            }
        } else if (active != null) {
            String clearVal = sourcePoint.getPresentvalue();
            clearActive(active, now, null, clearVal);
            active.setPointid(sourcePoint.getId());
            active.update();
        }
    }

    private PointRecord resolvePersistedTargetPoint(AlarmdefinitionRecord def) {
        return def.getTargetpointid() != null ? dsl.selectFrom(POINT).where(POINT.ID.eq(def.getTargetpointid())).fetchOne() : null;
    }

    private void clearActive(AlarmeventRecord active, LocalDateTime now, String overrideMessage, String clearValue) {
        long durationSeconds = Math.max(0, java.time.Duration.between(active.getOccurredat(), now).getSeconds());
        active.setState(Alarmeventstate.CLEARED);
        active.setClearedat(now);
        active.setLastevaluatedat(now);
        active.setClearvalue(clearValue);
        active.setDurationseconds((int) durationSeconds);
        active.setUpdatedat(now);
        if (overrideMessage != null) active.setMessage(overrideMessage);
        active.update();
    }

    public void evaluateDefinitionsForSite(String siteId, List<String> pointIds) {
        Set<String> idSet = new LinkedHashSet<>(pointIds != null ? pointIds : List.of());
        var query = dsl.select(ALARMDEFINITION.ID).from(ALARMDEFINITION)
            .where(ALARMDEFINITION.SITEID.eq(siteId), ALARMDEFINITION.ENABLED.isTrue());
        List<String> defIds = idSet.isEmpty()
            ? query.fetch(ALARMDEFINITION.ID)
            : dsl.select(ALARMDEFINITION.ID).from(ALARMDEFINITION)
                .where(ALARMDEFINITION.SITEID.eq(siteId), ALARMDEFINITION.ENABLED.isTrue(),
                    ALARMDEFINITION.POINTID.in(idSet).or(ALARMDEFINITION.TARGETPOINTID.in(idSet)))
                .fetch(ALARMDEFINITION.ID);
        for (String id : defIds) evaluateDefinitionById(id);
    }

    /** Call after point value updates. Evaluates any alarm definitions tied to these points. */
    public void evaluateForPointIds(List<String> pointIds) {
        if (pointIds == null || pointIds.isEmpty()) return;
        List<PointRecord> points = dsl.selectFrom(POINT).where(POINT.ID.in(pointIds)).fetch();
        Set<String> defIds = new HashSet<>();
        for (PointRecord p : points) {
            List<String> matches = dsl.select(ALARMDEFINITION.ID).from(ALARMDEFINITION)
                .where(ALARMDEFINITION.SITEID.eq(p.getSiteid()), ALARMDEFINITION.ENABLED.isTrue(),
                    ALARMDEFINITION.POINTID.eq(p.getId())
                        .or(ALARMDEFINITION.TARGETPOINTID.eq(p.getId()))
                        .or(ALARMDEFINITION.EQUIPMENTID.eq(p.getEquipmentid()).and(ALARMDEFINITION.POINTKEY.eq(p.getPointcode())))
                        .or(ALARMDEFINITION.EQUIPMENTID.eq(p.getEquipmentid()).and(ALARMDEFINITION.TARGETPOINTKEY.eq(p.getPointcode()))))
                .fetch(ALARMDEFINITION.ID);
            defIds.addAll(matches);
            List<String> treeDefs = dsl.select(ALARMDEFINITION.ID).from(ALARMDEFINITION)
                .where(ALARMDEFINITION.SITEID.eq(p.getSiteid()), ALARMDEFINITION.EQUIPMENTID.eq(p.getEquipmentid()),
                    ALARMDEFINITION.ENABLED.isTrue(), ALARMDEFINITION.CONDITIONTREE.isNotNull())
                .fetch(ALARMDEFINITION.ID);
            defIds.addAll(treeDefs);
        }
        for (String id : defIds) evaluateDefinitionById(id);
    }

    public void clearDelayState(String definitionId) {
        delayFirstViolatedAt.remove(definitionId);
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v != null && !v.isNull() ? v.asText() : null;
    }

    private static String textOrEmpty(JsonNode node, String... fields) {
        for (String f : fields) {
            String v = textOrNull(node, f);
            if (v != null) return v;
        }
        return "";
    }

    private static Double parseNumeric(JsonNode node) {
        try {
            return Double.parseDouble(node.asText());
        } catch (Exception e) {
            return null;
        }
    }
}
