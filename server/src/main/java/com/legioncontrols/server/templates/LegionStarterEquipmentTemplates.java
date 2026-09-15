package com.legioncontrols.server.templates;

import com.legioncontrols.server.common.JsonUtil;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Java equivalent of backend/src/lib/legionStarterEquipmentTemplates.js — the canonical starter
 * equipment point models (AHU/VAV-CLG-ONLY/VAV-HTG/FCU/RTU), used to lazily seed
 * GlobalEquipmentTemplate when the table is empty. Point shape matches the frontend's
 * equipmentTemplatePointModel exactly: {id, key, pointKey, label, pointLabel, expectedType,
 * commandType, commandConfig, mappingHint, notes}. Stable IDs (same GLOBAL_IDS as Node) keep
 * upserts idempotent across Spring/Express.
 */
@Component
public class LegionStarterEquipmentTemplates {

    public static final String AHU_ID = "e0000001-0000-4000-8000-000000000001";
    public static final String VAV_CLG_ONLY_ID = "e0000001-0000-4000-8000-000000000002";
    public static final String VAV_HTG_ID = "e0000001-0000-4000-8000-000000000003";
    public static final String FCU_ID = "e0000001-0000-4000-8000-000000000004";
    public static final String RTU_ID = "e0000001-0000-4000-8000-000000000005";

    private final JsonUtil json;

    public LegionStarterEquipmentTemplates(JsonUtil json) {
        this.json = json;
    }

    public record SeedRow(String id, String name, String equipmentType, String description,
                           String defaultGraphicName, ArrayNode pointsJson) {
    }

    private ObjectNode pt(String key, String label, String expectedType, String commandType, Map<String, Object> commandConfig, String notes) {
        ObjectNode node = json.newObject();
        node.put("id", "legion-pt-" + key);
        node.put("key", key);
        node.put("pointKey", key);
        node.put("label", label);
        node.put("pointLabel", label);
        node.put("expectedType", expectedType);
        node.put("commandType", commandType);
        if (commandConfig != null) {
            ObjectNode config = json.newObject();
            for (var e : commandConfig.entrySet()) {
                putAny(config, e.getKey(), e.getValue());
            }
            node.set("commandConfig", config);
        } else {
            node.putNull("commandConfig");
        }
        node.putNull("mappingHint");
        if (notes != null) node.put("notes", notes); else node.putNull("notes");
        return node;
    }

    @SuppressWarnings("unchecked")
    private void putAny(ObjectNode node, String key, Object value) {
        if (value instanceof String s) node.put(key, s);
        else if (value instanceof Integer i) node.put(key, i);
        else if (value instanceof Double d) node.put(key, d);
        else if (value instanceof Boolean b) node.put(key, b);
        else if (value instanceof List<?> list) {
            ArrayNode arr = json.newArray();
            for (Object item : list) {
                if (item instanceof Map<?, ?> m) {
                    ObjectNode child = json.newObject();
                    for (var e : ((Map<String, Object>) m).entrySet()) putAny(child, e.getKey(), e.getValue());
                    arr.add(child);
                }
            }
            node.set(key, arr);
        }
    }

    private static Map<String, Object> pct(int min, int max, int step, String unit) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("min", min); m.put("max", max); m.put("step", step); m.put("unit", unit);
        return m;
    }

    private static Map<String, Object> num(double min, double max, double step, String unit) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("min", min); m.put("max", max); m.put("step", step); m.put("unit", unit);
        return m;
    }

    private static Map<String, Object> bool(String off, String on) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("offLabel", off); m.put("onLabel", on);
        return m;
    }

    private static Map<String, Object> enumOptions(List<Map<String, Object>> options) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("options", options);
        return m;
    }

    private static Map<String, Object> option(String label, int value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", label); m.put("value", value);
        return m;
    }

    private ArrayNode ahuPoints() {
        ArrayNode a = json.newArray();
        a.add(pt("supplyAirTemp", "Supply Air Temperature", "AI", "none", null, null));
        a.add(pt("returnAirTemp", "Return Air Temperature", "AI", "none", null, null));
        a.add(pt("outdoorAirTemp", "Outdoor Air Temperature", "AI", "none", null, null));
        a.add(pt("mixedAirTemp", "Mixed Air Temperature", "AI", "none", null, null));
        a.add(pt("systemEnable", "System Enable", "BO", "boolean", bool("Off", "On"), null));
        a.add(pt("occupancyMode", "Occupancy Mode", "MSV", "enum", enumOptions(List.of(option("Off", 0), option("Occupied", 1), option("Unoccupied", 2), option("Bypass", 3))), null));
        a.add(pt("supplyAirTempSetpoint", "Supply Air Temp Setpoint", "AV", "numeric", num(55, 75, 0.5, "°F"), null));
        a.add(pt("staticPressureSetpoint", "Static Pressure Setpoint", "AV", "numeric", num(0.5, 3, 0.1, "in.w.g"), null));
        a.add(pt("supplyFanStatus", "Supply Fan Status", "BI", "none", null, null));
        a.add(pt("filterStatus", "Filter Status", "BI", "none", null, null));
        a.add(pt("alarmStatus", "Alarm Status", "BV", "none", null, null));
        a.add(pt("chilledWaterValve", "Chilled Water Valve Command", "AO", "percentage", pct(0, 100, 1, "%"), null));
        a.add(pt("supplyFanSpeed", "Supply Fan Speed Command", "AO", "percentage", pct(0, 100, 1, "%"), null));
        return a;
    }

    private ArrayNode vavClgOnlyPoints() {
        ArrayNode a = json.newArray();
        a.add(pt("zoneTemp", "Zone Temperature", "AI", "none", null, null));
        a.add(pt("dischargeAirTemp", "Discharge Air Temperature", "AI", "none", null, null));
        a.add(pt("airflow", "Airflow", "AI", "none", null, null));
        a.add(pt("coolingSetpoint", "Cooling Setpoint", "AV", "numeric", num(65, 78, 0.5, "°F"), null));
        a.add(pt("airflowSetpoint", "Airflow Setpoint", "AV", "numeric", num(0, 2000, 50, "CFM"), null));
        a.add(pt("damperPosition", "Damper Position", "AI", "none", null, null));
        a.add(pt("occupancyStatus", "Occupancy Status", "BV", "none", null, null));
        a.add(pt("damperCommand", "Damper Command", "AO", "percentage", pct(0, 100, 1, "%"), null));
        return a;
    }

    private ArrayNode vavHtgPoints() {
        ArrayNode a = json.newArray();
        a.add(pt("zoneTemp", "Zone Temperature", "AI", "none", null, null));
        a.add(pt("dischargeAirTemp", "Discharge Air Temperature", "AI", "none", null, null));
        a.add(pt("airflow", "Airflow", "AI", "none", null, null));
        a.add(pt("coolingSetpoint", "Cooling Setpoint", "AV", "numeric", num(65, 78, 0.5, "°F"), null));
        a.add(pt("heatingSetpoint", "Heating Setpoint", "AV", "numeric", num(65, 78, 0.5, "°F"), null));
        a.add(pt("airflowSetpoint", "Airflow Setpoint", "AV", "numeric", num(0, 2000, 50, "CFM"), null));
        a.add(pt("damperPosition", "Damper Position", "AI", "none", null, null));
        a.add(pt("reheatStatus", "Reheat Status", "BI", "none", null, null));
        a.add(pt("occupancyStatus", "Occupancy Status", "BV", "none", null, null));
        a.add(pt("damperCommand", "Damper Command", "AO", "percentage", pct(0, 100, 1, "%"), null));
        a.add(pt("reheatValve", "Reheat Valve Command", "AO", "percentage", pct(0, 100, 1, "%"), null));
        return a;
    }

    private ArrayNode fcuPoints() {
        ArrayNode a = json.newArray();
        a.add(pt("zoneTemp", "Zone Temperature", "AI", "none", null, null));
        a.add(pt("dischargeAirTemp", "Discharge Air Temperature", "AI", "none", null, null));
        a.add(pt("systemEnable", "System Enable", "BO", "boolean", bool("Off", "On"), null));
        a.add(pt("fanSpeed", "Fan Speed", "MSV", "enum", enumOptions(List.of(option("Off", 0), option("Low", 1), option("Medium", 2), option("High", 3))), null));
        a.add(pt("coolingSetpoint", "Cooling Setpoint", "AV", "numeric", num(65, 78, 0.5, "°F"), null));
        a.add(pt("heatingSetpoint", "Heating Setpoint", "AV", "numeric", num(65, 78, 0.5, "°F"), null));
        a.add(pt("fanStatus", "Fan Status", "BI", "none", null, null));
        a.add(pt("alarmStatus", "Alarm Status", "BV", "none", null, null));
        a.add(pt("chilledWaterValve", "Chilled Water Valve", "AO", "percentage", pct(0, 100, 1, "%"), null));
        a.add(pt("heatingValve", "Heating Valve", "AO", "percentage", pct(0, 100, 1, "%"), null));
        return a;
    }

    private ArrayNode rtuPoints() {
        ArrayNode a = json.newArray();
        a.add(pt("supplyAirTemp", "Supply Air Temperature", "AI", "none", null, null));
        a.add(pt("returnAirTemp", "Return Air Temperature", "AI", "none", null, null));
        a.add(pt("outdoorAirTemp", "Outdoor Air Temperature", "AI", "none", null, null));
        a.add(pt("systemEnable", "System Enable", "BO", "boolean", bool("Off", "On"), null));
        a.add(pt("occupancyMode", "Occupancy Mode", "MSV", "enum", enumOptions(List.of(option("Off", 0), option("Occupied", 1), option("Unoccupied", 2))), null));
        a.add(pt("coolingSetpoint", "Cooling Setpoint", "AV", "numeric", num(65, 78, 0.5, "°F"), null));
        a.add(pt("heatingSetpoint", "Heating Setpoint", "AV", "numeric", num(65, 78, 0.5, "°F"), null));
        a.add(pt("compressorStatus", "Compressor Status", "BI", "none", null, null));
        a.add(pt("fanStatus", "Fan Status", "BI", "none", null, null));
        a.add(pt("alarmStatus", "Alarm Status", "BV", "none", null, null));
        a.add(pt("fanSpeed", "Fan Speed Command", "AO", "percentage", pct(0, 100, 1, "%"), null));
        a.add(pt("economizerDamper", "Economizer Damper", "AO", "percentage", pct(0, 100, 1, "%"), null));
        return a;
    }

    public List<SeedRow> getGlobalStarterTemplateSeedRows() {
        return List.of(
            new SeedRow(AHU_ID, "AHU", "AHU", "Starter — air handling unit", null, ahuPoints()),
            new SeedRow(VAV_CLG_ONLY_ID, "VAV-CLG-ONLY", "VAV-CLG-ONLY", "Starter — VAV cooling only", null, vavClgOnlyPoints()),
            new SeedRow(VAV_HTG_ID, "VAV-HTG", "VAV-HTG", "Starter — VAV with heating / reheat", null, vavHtgPoints()),
            new SeedRow(FCU_ID, "FCU", "FCU", "Starter — fan coil unit", null, fcuPoints()),
            new SeedRow(RTU_ID, "RTU", "RTU", "Starter — rooftop unit", null, rtuPoints())
        );
    }
}
