package com.legioncontrols.server.lspkg;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Java port of backend/src/lib/lspkg/parser.js — parses and validates a `.lspkg` buffer
 * (LC-ARCH-002 §3, §11). Shared by both deployment entry points — direct LAN transfer and offline
 * import — so they can never diverge into competing formats (DEP-004). Returns a structured result
 * rather than throwing on recoverable validation problems, so callers can persist a FAILED record
 * with a reason instead of a bare 500.
 */
@Component
public class Parser {

    private final ObjectMapper objectMapper;

    public Parser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public record ParseResult(boolean ok, List<String> errors, List<String> warnings, JsonNode manifest,
                               Map<String, JsonNode> files) {
        static ParseResult failure(List<String> errors, List<String> warnings, JsonNode manifest, Map<String, JsonNode> files) {
            return new ParseResult(false, errors, warnings, manifest, files);
        }
    }

    public ParseResult parseSitePackage(byte[] buffer) {
        return parseSitePackage(buffer, Zip.Limits.defaults());
    }

    public ParseResult parseSitePackage(byte[] buffer, Zip.Limits limits) {
        List<String> warnings = new ArrayList<>();
        List<Zip.Entry> entries;
        try {
            entries = Zip.readZip(buffer, limits);
        } catch (Zip.ZipError e) {
            return ParseResult.failure(List.of(e.getMessage()), warnings, null, null);
        }

        Map<String, byte[]> byName = new LinkedHashMap<>();
        for (Zip.Entry entry : entries) byName.put(entry.name(), entry.data());

        if (!byName.containsKey("manifest.json")) {
            return ParseResult.failure(List.of("Package is missing manifest.json"), warnings, null, null);
        }

        JsonNode manifest;
        try {
            manifest = objectMapper.readTree(new String(byName.get("manifest.json"), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ParseResult.failure(List.of("manifest.json is not valid JSON: " + e.getMessage()), warnings, null, null);
        }

        Manifest.ValidationResult manifestCheck = Manifest.validateManifest(manifest);
        if (!manifestCheck.ok()) {
            return ParseResult.failure(manifestCheck.errors(), warnings, manifest, null);
        }

        int schemaVersion = manifest.get("packageSchemaVersion").asInt();
        if (!Manifest.SUPPORTED_SCHEMA_VERSIONS.contains(schemaVersion)) {
            return ParseResult.failure(List.of("Unsupported package schema version " + schemaVersion), warnings, manifest, null);
        }

        List<String> errors = new ArrayList<>();
        Map<String, JsonNode> files = new LinkedHashMap<>();
        JsonNode checksums = manifest.get("checksums");
        for (JsonNode fileNameNode : manifest.get("files")) {
            String fileName = fileNameNode.asString();
            if (!byName.containsKey(fileName)) {
                errors.add("manifest declares file \"" + fileName + "\" but it is missing from the archive");
                continue;
            }
            JsonNode parsed;
            try {
                parsed = objectMapper.readTree(new String(byName.get(fileName), StandardCharsets.UTF_8));
            } catch (Exception e) {
                errors.add("\"" + fileName + "\" is not valid JSON: " + e.getMessage());
                continue;
            }
            JsonNode expected = checksums != null ? checksums.get(fileName) : null;
            String actualChecksum = Checksum.sha256Hex(Checksum.canonicalStringify(parsed));
            if (expected == null || expected.isNull()) {
                errors.add("manifest.checksums is missing an entry for \"" + fileName + "\"");
            } else if (!expected.asString().equals(actualChecksum)) {
                errors.add("Checksum mismatch for \"" + fileName + "\" — package is corrupt or tampered");
            }
            files.put(fileName, parsed);
        }

        List<String> declaredFiles = new ArrayList<>();
        for (JsonNode n : manifest.get("files")) declaredFiles.add(n.asString());
        for (String name : byName.keySet()) {
            if (!name.equals("manifest.json") && !declaredFiles.contains(name)) {
                errors.add("Archive contains undeclared file \"" + name + "\"");
            }
        }

        if (!errors.isEmpty()) {
            return new ParseResult(false, errors, warnings, manifest, files);
        }

        try {
            Manifest.assertNoForbiddenKeys(manifest);
            Manifest.assertNoForbiddenKeys(files);
        } catch (IllegalStateException e) {
            return ParseResult.failure(List.of(e.getMessage()), warnings, manifest, null);
        }

        JsonNode signature = manifest.get("signature");
        if (signature != null && signature.has("signed") && !signature.get("signed").asBoolean(true)) {
            warnings.add("Package is unsigned (development build) — integrity was checked via checksum only, not a cryptographic signature.");
        }

        return new ParseResult(true, List.of(), warnings, manifest, files);
    }
}
