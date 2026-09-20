package com.legioncontrols.server.releases;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import java.time.Instant;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Java equivalent of backend/src/modules/siteVersions/siteVersion.payload.js — the working-version
 * flat state <-> deployment snapshot transforms. The payload is treated as a JSON tree here (not a
 * fully-typed Java object graph) because it is genuinely a flexible, engineering-editor-owned
 * document — the DB column is JSONB precisely because its shape evolves with the frontend, not a
 * fixed relational contract.
 */
@Service
public class ReleasePayloadService {

    private static final Pattern NON_DIGIT = Pattern.compile("\\D");

    private final JsonUtil json;

    public ReleasePayloadService(JsonUtil json) {
        this.json = json;
    }

    private ObjectNode createDefaultNetworkConfig() {
        ObjectNode config = json.newObject();
        config.set("bacnetIpNetworks", json.newArray());
        config.set("mstpTrunks", json.newArray());
        ObjectNode scanDefaults = json.newObject();
        scanDefaults.put("defaultScanMode", "all");
        scanDefaults.put("scanTimeoutSec", 15);
        scanDefaults.put("retries", 2);
        scanDefaults.put("includeUnconfiguredProtocols", false);
        scanDefaults.put("autoScanOnOpen", false);
        config.set("scanDefaults", scanDefaults);
        config.put("routingNotes", "");
        ArrayNode interfaces = json.newArray();
        ObjectNode defaultInterface = json.newObject();
        defaultInterface.put("id", "if-default");
        defaultInterface.put("label", "Primary interface");
        defaultInterface.put("bindAddress", "");
        defaultInterface.put("listenUdp", 47808);
        defaultInterface.put("enabled", true);
        defaultInterface.put("notes", "");
        interfaces.add(defaultInterface);
        config.set("networkInterfaces", interfaces);
        return config;
    }

    public ObjectNode createDefaultWorkingPayload() {
        ObjectNode payload = json.newObject();
        payload.putNull("site");
        ObjectNode templates = json.newObject();
        templates.set("equipmentTemplates", json.newArray());
        templates.set("graphicTemplates", json.newArray());
        payload.set("templates", templates);
        payload.set("equipment", json.newArray());
        payload.set("discoveredDevices", json.newArray());
        payload.set("discoveredObjects", json.newObject());
        payload.set("mappings", json.newObject());
        payload.set("graphics", json.newObject());
        payload.set("siteLayoutGraphics", json.newObject());
        payload.set("networkConfig", createDefaultNetworkConfig());
        payload.putNull("validation");
        payload.set("deploymentHistory", json.newArray());
        payload.putNull("activeDeploymentSnapshot");
        return payload;
    }

    public record SnapshotOverrides(String version, String lastDeployedAt, String deployedBy, String systemStatus) {
    }

    /** Java equivalent of buildDeploymentSnapshotFromWorking. */
    public ObjectNode buildDeploymentSnapshotFromWorking(JsonNode workingData, SnapshotOverrides overrides) {
        JsonNode activeSnapshot = workingData != null ? workingData.get("activeDeploymentSnapshot") : null;
        String currentVersion = activeSnapshot != null && activeSnapshot.hasNonNull("version")
            ? activeSnapshot.get("version").asText()
            : "v0";
        int versionNum = parseIntSafe(NON_DIGIT.matcher(currentVersion).replaceAll("")) + 1;
        String newVersion = overrides.version() != null ? overrides.version() : "v" + versionNum;

        ObjectNode snapshot = json.newObject();
        snapshot.put("version", newVersion);
        snapshot.put("lastDeployedAt", overrides.lastDeployedAt() != null ? overrides.lastDeployedAt() : Instant.now().toString());
        if (overrides.deployedBy() != null) snapshot.put("deployedBy", overrides.deployedBy()); else snapshot.putNull("deployedBy");
        snapshot.put("systemStatus", overrides.systemStatus() != null ? overrides.systemStatus() : "Running");

        JsonNode site = workingData != null ? workingData.get("site") : null;
        snapshot.set("site", site != null && !site.isNull() ? json.clone(site) : null);
        if (site == null || site.isNull()) snapshot.putNull("site");

        JsonNode equipment = workingData != null ? workingData.get("equipment") : null;
        snapshot.set("equipment", equipment instanceof ArrayNode ? json.clone(equipment) : json.newArray());

        JsonNode templates = workingData != null ? workingData.get("templates") : null;
        ObjectNode templatesOut = json.newObject();
        templatesOut.set("equipmentTemplates", extractArrayOrEmpty(templates, "equipmentTemplates"));
        templatesOut.set("graphicTemplates", extractArrayOrEmpty(templates, "graphicTemplates"));
        snapshot.set("templates", templatesOut);

        snapshot.set("mappings", objectOrEmpty(workingData, "mappings"));
        snapshot.set("graphics", objectOrEmpty(workingData, "graphics"));
        snapshot.set("siteLayoutGraphics", objectOrEmpty(workingData, "siteLayoutGraphics"));

        return snapshot;
    }

    private JsonNode extractArrayOrEmpty(JsonNode parent, String field) {
        if (parent == null) return json.newArray();
        JsonNode value = parent.get(field);
        return value instanceof ArrayNode ? json.clone(value) : json.newArray();
    }

    private JsonNode objectOrEmpty(JsonNode parent, String field) {
        if (parent == null) return json.newObject();
        JsonNode value = parent.get(field);
        return value != null && value.isObject() ? json.clone(value) : json.newObject();
    }

    private static int parseIntSafe(String digits) {
        try {
            return digits.isBlank() ? 0 : Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** Java equivalent of deploymentSnapshotToWorkingPayload. */
    public ObjectNode deploymentSnapshotToWorkingPayload(JsonNode snapshot) {
        if (snapshot == null || !snapshot.isObject()) {
            return createDefaultWorkingPayload();
        }
        ObjectNode payload = json.newObject();
        JsonNode site = snapshot.get("site");
        payload.set("site", site != null && !site.isNull() ? json.clone(site) : null);
        if (site == null || site.isNull()) payload.putNull("site");

        JsonNode templates = snapshot.get("templates");
        payload.set("templates", templates != null && templates.isObject() ? json.clone(templates) : defaultTemplates());
        payload.set("equipment", extractArrayOrEmpty(snapshot, "equipment"));
        payload.set("discoveredDevices", json.newArray());
        payload.set("discoveredObjects", json.newObject());
        payload.set("mappings", objectOrEmpty(snapshot, "mappings"));
        payload.set("graphics", objectOrEmpty(snapshot, "graphics"));
        payload.set("siteLayoutGraphics", objectOrEmpty(snapshot, "siteLayoutGraphics"));
        payload.set("networkConfig", createDefaultNetworkConfig());
        payload.putNull("validation");
        payload.set("deploymentHistory", json.newArray());

        if (snapshot.hasNonNull("version")) {
            ObjectNode active = json.newObject();
            active.set("version", snapshot.get("version"));
            active.set("lastDeployedAt", snapshot.get("lastDeployedAt"));
            active.set("deployedBy", snapshot.get("deployedBy"));
            active.set("systemStatus", snapshot.get("systemStatus"));
            payload.set("activeDeploymentSnapshot", active);
        } else {
            payload.putNull("activeDeploymentSnapshot");
        }
        return payload;
    }

    private ObjectNode defaultTemplates() {
        ObjectNode templates = json.newObject();
        templates.set("equipmentTemplates", json.newArray());
        templates.set("graphicTemplates", json.newArray());
        return templates;
    }

    /** Java equivalent of validateWorkingPayloadForDeploy — returns an error message, or null if valid. */
    public String validateWorkingPayloadForDeploy(JsonNode payload) {
        if (payload == null || payload.isNull()) {
            return "Working version has no payload";
        }
        if (!payload.isObject()) {
            return "Working version payload must be a JSON object";
        }
        return null;
    }

    public void requireValidForDeploy(JsonNode payload) {
        String error = validateWorkingPayloadForDeploy(payload);
        if (error != null) {
            throw ApiException.badRequest(error);
        }
    }
}
