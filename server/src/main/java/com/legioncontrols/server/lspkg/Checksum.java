package com.legioncontrols.server.lspkg;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * Java port of backend/src/lib/lspkg/checksum.js — deterministic canonical JSON serialization
 * (object keys sorted recursively) and SHA-256 hashing. This is what makes checksums (and the whole
 * package) stable across rebuilds: two logically-identical objects with keys inserted in a different
 * order always serialize to the same bytes.
 *
 * Java is now the sole producer AND consumer of every checksum this module writes/reads — a package
 * built here is later validated here, never round-tripped through the retired Node implementation —
 * so exact byte-for-byte parity with JS's JSON.stringify number formatting is not required, only
 * internal determinism. Number formatting below (whole doubles without a trailing ".0", trimmed
 * trailing zeros otherwise) is a best-effort match to JS's behavior for readability, not a
 * compatibility contract.
 */
public final class Checksum {

    private Checksum() {
    }

    public static String canonicalStringify(JsonNode value) {
        StringBuilder sb = new StringBuilder();
        write(value, sb);
        return sb.toString();
    }

    private static void write(JsonNode node, StringBuilder sb) {
        if (node == null || node.isNull()) {
            sb.append("null");
            return;
        }
        if (node.isObject()) {
            sb.append('{');
            List<String> keys = new ArrayList<>(node.propertyNames());
            Collections.sort(keys);
            boolean first = true;
            for (String key : keys) {
                if (!first) sb.append(',');
                first = false;
                writeString(key, sb);
                sb.append(':');
                write(node.get(key), sb);
            }
            sb.append('}');
        } else if (node.isArray()) {
            sb.append('[');
            for (int i = 0; i < node.size(); i++) {
                if (i > 0) sb.append(',');
                write(node.get(i), sb);
            }
            sb.append(']');
        } else if (node.isString()) {
            writeString(node.asString(), sb);
        } else if (node.isBoolean()) {
            sb.append(node.asBoolean());
        } else if (node.isNumber()) {
            sb.append(formatNumber(node));
        } else {
            writeString(node.asString(), sb);
        }
    }

    private static String formatNumber(JsonNode node) {
        if (node.isIntegralNumber()) {
            return node.bigIntegerValue().toString();
        }
        double d = node.asDouble();
        if (Double.isNaN(d) || Double.isInfinite(d)) {
            return "null"; // JSON has no NaN/Infinity; JSON.stringify also emits null here
        }
        if (d == Math.floor(d) && !Double.isInfinite(d) && Math.abs(d) < 1e15) {
            return String.valueOf((long) d);
        }
        BigDecimal bd = BigDecimal.valueOf(d).stripTrailingZeros();
        return bd.toPlainString();
    }

    private static void writeString(String s, StringBuilder sb) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append('"');
    }

    public static String sha256Hex(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String sha256Hex(String data) {
        return sha256Hex(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
