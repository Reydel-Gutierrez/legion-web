package com.legioncontrols.server.lspkg;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/**
 * Java port of backend/src/lib/lspkg/manifest.js — the `.lspkg` manifest schema (LC-ARCH-002 §3).
 * Bumping {@link #PACKAGE_SCHEMA_VERSION} requires a decision on backward/forward compatibility
 * (LC-ARCH-002 §11) — an LS-100 that does not recognize a package's schemaVersion must refuse to
 * stage it (DEP-003/DEP-005) rather than guess at its structure.
 */
public final class Manifest {

    private Manifest() {
    }

    public static final int PACKAGE_SCHEMA_VERSION = 1;

    public static final List<Integer> SUPPORTED_SCHEMA_VERSIONS = List.of(1);

    public static final List<String> REQUIRED_MANIFEST_FIELDS = List.of(
        "packageSchemaVersion", "packageId", "siteId", "siteName", "projectVersion",
        "createdAt", "minLs100Version", "deploymentScope", "files", "checksums", "signature"
    );

    /** Field names that must never appear anywhere in a built package (defense in depth). */
    private static final Pattern FORBIDDEN_KEY_PATTERN = Pattern.compile(
        "password|passwd|secret|token|apikey|api_key|privatekey|private_key|credential",
        Pattern.CASE_INSENSITIVE
    );

    public record ValidationResult(boolean ok, List<String> errors) {
    }

    public static ValidationResult validateManifest(JsonNode manifest) {
        List<String> errors = new ArrayList<>();
        if (manifest == null || manifest.isNull() || !manifest.isObject()) {
            return new ValidationResult(false, List.of("manifest must be a JSON object"));
        }
        for (String field : REQUIRED_MANIFEST_FIELDS) {
            if (!manifest.hasNonNull(field)) errors.add("manifest." + field + " is required");
        }
        if (manifest.has("packageSchemaVersion") && manifest.get("packageSchemaVersion").isNumber()) {
            int v = manifest.get("packageSchemaVersion").asInt();
            if (!SUPPORTED_SCHEMA_VERSIONS.contains(v)) {
                errors.add("Unsupported package schema version " + v + "; this LS-100 supports " + SUPPORTED_SCHEMA_VERSIONS);
            }
        }
        if (!manifest.has("siteId") || !manifest.get("siteId").isString() || manifest.get("siteId").asString().isBlank()) {
            errors.add("manifest.siteId must be a non-empty string");
        }
        if (!manifest.has("packageId") || !manifest.get("packageId").isString() || manifest.get("packageId").asString().isBlank()) {
            errors.add("manifest.packageId must be a non-empty string");
        }
        if (!manifest.has("files") || !manifest.get("files").isArray()) {
            errors.add("manifest.files must be an array");
        }
        if (!manifest.has("checksums") || !manifest.get("checksums").isObject()) {
            errors.add("manifest.checksums must be an object");
        }
        if (manifest.has("simulationPackage") && !manifest.get("simulationPackage").isNull() && !manifest.get("simulationPackage").isBoolean()) {
            errors.add("manifest.simulationPackage must be a boolean when present");
        }
        return new ValidationResult(errors.isEmpty(), errors);
    }

    /**
     * Recursively scans a JSON value for keys that must never be present in a deployable package
     * (passwords, tokens, private keys, machine secrets). Throws rather than silently stripping, so
     * a leak is a loud build failure, not a quiet omission.
     */
    public static void assertNoForbiddenKeys(JsonNode value) {
        assertNoForbiddenKeys(value, "$");
    }

    /** Overload for a package's {@code files} map ({@code { "equipment.json": {...}, ... }}). */
    public static void assertNoForbiddenKeys(java.util.Map<String, JsonNode> files) {
        for (var entry : files.entrySet()) {
            assertNoForbiddenKeys(entry.getValue(), "$." + entry.getKey());
        }
    }

    private static void assertNoForbiddenKeys(JsonNode value, String path) {
        if (value == null) return;
        if (value.isArray()) {
            for (int i = 0; i < value.size(); i++) {
                assertNoForbiddenKeys(value.get(i), path + "[" + i + "]");
            }
            return;
        }
        if (value.isObject()) {
            for (String key : value.propertyNames()) {
                if (FORBIDDEN_KEY_PATTERN.matcher(key).find()) {
                    throw new IllegalStateException("Refusing to build package: forbidden key \"" + key + "\" found at " + path + "." + key);
                }
                assertNoForbiddenKeys(value.get(key), path + "." + key);
            }
        }
    }
}
