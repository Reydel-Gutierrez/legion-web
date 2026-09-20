package com.legioncontrols.server.runtime;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.config.RuntimeClientProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Java equivalent of backend/src/lib/runtimeClient.ts — the ONLY way this Server talks to the
 * standalone Legion Runtime process (see runtime/). Every call degrades to a clear
 * {@link ApiException} (503/502) when Runtime is unreachable or erroring, never an uncaught
 * exception, so a Runtime outage never crashes this Server (LC-ARCH-004 / Phase 2 boundary).
 */
@Component
public class RuntimeClient {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final RuntimeClientProperties properties;

    public RuntimeClient(RuntimeClientProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(properties.getConnectTimeoutMs()))
            .build();
    }

    private record RawResponse(int status, JsonNode body) {
    }

    private RawResponse fetch(String path, String method, Object body) {
        try {
            HttpRequest.BodyPublisher publisher = body != null
                ? HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body))
                : HttpRequest.BodyPublishers.noBody();
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(properties.getBaseUrl() + path))
                .timeout(Duration.ofMillis(properties.getRequestTimeoutMs()))
                .header("Content-Type", "application/json")
                .method(method, publisher);
            if (properties.getInternalToken() != null && !properties.getInternalToken().isBlank()) {
                builder.header("X-Runtime-Token", properties.getInternalToken());
            }
            // JSON is UTF-8 by spec; force it explicitly rather than trusting the response's
            // Content-Type charset (Runtime's error messages can contain non-ASCII punctuation
            // like an em dash, and BodyHandlers.ofString()'s no-charset fallback double-encodes it —
            // see the identical fix in GeocodeService for the same class of bug).
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));
            JsonNode json = null;
            String responseBody = response.body();
            if (responseBody != null && !responseBody.isBlank()) {
                try {
                    json = objectMapper.readTree(responseBody);
                } catch (Exception ignored) {
                    json = null;
                }
            }
            return new RawResponse(response.statusCode(), json);
        } catch (IOException e) {
            throw ApiException.serviceUnavailable("Legion Runtime is unavailable: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApiException.serviceUnavailable("Legion Runtime is unavailable: " + e.getMessage());
        }
    }

    private static String upstreamErrorMessage(JsonNode body, String fallback) {
        if (body != null && body.hasNonNull("error")) {
            return body.get("error").asText();
        }
        return fallback;
    }

    /** GET; returns {@code notFoundValue} on a 404, or throws {@link ApiException} 502/503. */
    public JsonNode get(String path, JsonNode notFoundValue) {
        RawResponse res = fetch(path, "GET", null);
        if (res.status() == 404) return notFoundValue;
        if (res.status() >= 500) throw ApiException.badGateway(upstreamErrorMessage(res.body(), "Legion Runtime returned an error"));
        return res.body();
    }

    public JsonNode get(String path) {
        return get(path, null);
    }

    public JsonNode post(String path, Object payload, JsonNode notFoundValue) {
        RawResponse res = fetch(path, "POST", payload != null ? payload : Map.of());
        if (res.status() == 404) return notFoundValue;
        if (res.status() >= 500) throw ApiException.badGateway(upstreamErrorMessage(res.body(), "Legion Runtime returned an error"));
        return res.body();
    }

    public JsonNode post(String path, Object payload) {
        return post(path, payload, null);
    }

    /** Never throws — for health/status probes where "unreachable" is itself a valid, reportable state. */
    public RuntimeProbe probe(String path) {
        try {
            RawResponse res = fetch(path, "GET", null);
            return new RuntimeProbe(true, res.status(), res.body(), null);
        } catch (ApiException e) {
            return new RuntimeProbe(false, 0, null, e.getMessage());
        }
    }

    public record RuntimeProbe(boolean reachable, int status, JsonNode body, String error) {
    }
}
