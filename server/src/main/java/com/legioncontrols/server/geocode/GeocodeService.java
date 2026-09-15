package com.legioncontrols.server.geocode;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Java equivalent of backend/src/modules/geocode/geocode.service.js — forward geocoding via
 * OpenStreetMap Nominatim, server-side with a proper User-Agent (Nominatim usage policy requires
 * one; see https://operations.osmfoundation.org/policies/nominatim/).
 */
@Service
public class GeocodeService {

    private static final String NOMINATIM_HOST = "https://nominatim.openstreetmap.org";
    private static final String USER_AGENT = System.getenv("NOMINATIM_USER_AGENT") != null
        ? System.getenv("NOMINATIM_USER_AGENT")
        : "LegionControls/1.0 (site-builder; contact: engineering@legion.local)";

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper objectMapper;

    public GeocodeService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public record AddressSuggestion(String id, String label, String addressLine, String city, String state,
                                     Double lat, Double lng) {
    }

    private static String pickCity(JsonNode addr) {
        if (addr == null || !addr.isObject()) return "";
        for (String field : new String[]{"city", "town", "village", "municipality", "hamlet", "suburb"}) {
            if (addr.hasNonNull(field)) return addr.get(field).asText();
        }
        return "";
    }

    private static String pickState(JsonNode addr) {
        if (addr == null || !addr.isObject()) return "";
        for (String field : new String[]{"state", "region", "county"}) {
            if (addr.hasNonNull(field)) return addr.get(field).asText();
        }
        return "";
    }

    private static String streetLine(JsonNode addr, String displayName) {
        if (addr == null || !addr.isObject()) {
            return displayName != null ? displayName.split(",")[0].trim() : "";
        }
        List<String> parts = new ArrayList<>();
        for (String field : new String[]{"house_number", "road", "pedestrian", "path"}) {
            if (addr.hasNonNull(field)) parts.add(addr.get(field).asText());
        }
        if (!parts.isEmpty()) return String.join(" ", parts).trim();
        if (addr.hasNonNull("neighbourhood") && addr.hasNonNull("road")) return addr.get("road").asText().trim();
        return displayName != null ? displayName.split(",")[0].trim() : "";
    }

    public List<AddressSuggestion> suggestAddresses(String q, Integer limit) {
        String query = q != null ? q.trim() : "";
        if (query.length() < 3) return List.of();
        int lim = Math.min(Math.max(limit != null ? limit : 6, 1), 10);

        String path = "/search?format=json&addressdetails=1&limit=" + lim
            + "&q=" + URLEncoder.encode(query, StandardCharsets.UTF_8);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(NOMINATIM_HOST + path))
                .timeout(Duration.ofSeconds(8))
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/json")
                .GET()
                .build();
            // JSON is UTF-8 by spec; force it explicitly rather than trusting the response's
            // Content-Type charset (Nominatim's header omits one, and BodyHandlers.ofString()'s
            // fallback in that case double-encodes non-ASCII characters like "España").
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException("Geocoding HTTP " + response.statusCode() + ": " + truncate(response.body(), 200));
            }
            JsonNode data = objectMapper.readTree(response.body());
            if (!data.isArray()) return List.of();

            List<AddressSuggestion> out = new ArrayList<>();
            for (JsonNode hit : data) {
                Double lat = parseDoubleOrNull(hit.get("lat"));
                Double lng = parseDoubleOrNull(hit.get("lon"));
                JsonNode addr = hit.get("address");
                String displayName = hit.hasNonNull("display_name") ? hit.get("display_name").asText() : "";
                String id = hit.hasNonNull("place_id") ? hit.get("place_id").asText() : (lat + "," + lng);
                out.add(new AddressSuggestion(id, displayName, streetLine(addr, displayName), pickCity(addr), pickState(addr), lat, lng));
            }
            return out;
        } catch (java.io.IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new RuntimeException("Geocoding request failed: " + e.getMessage(), e);
        }
    }

    private static Double parseDoubleOrNull(JsonNode node) {
        if (node == null || node.isNull()) return null;
        try {
            double v = Double.parseDouble(node.asText());
            return Double.isFinite(v) ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String truncate(String s, int max) {
        return s != null && s.length() > max ? s.substring(0, max) : s;
    }
}
