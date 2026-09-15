package com.legioncontrols.server.bacnet;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.config.BacnetCommissioningClientProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The ONLY way this Server talks to the isolated Node BACnet commissioning process (see
 * backend/src/bacnetCommissioningServer.js) — mirrors {@link com.legioncontrols.server.runtime.RuntimeClient}
 * exactly, including its degradation contract: every call becomes a clear {@link ApiException}
 * (502/503) when the commissioning process is unreachable or erroring, never an uncaught exception,
 * so a commissioning-service outage never crashes this Server or affects normal Operator/Engineering
 * operation (LC-ARCH-004-style failure-domain isolation, applied to commissioning the same way
 * Phase 2 applied it to Runtime).
 *
 * BACnet commissioning/discovery deliberately stays on the proven, working {@code node-bacnet}
 * library rather than being re-implemented in Java (BACnet4J) for language purity — this client is
 * what lets Spring own the public HTTP surface (so the frontend and any future caller need no
 * per-module knowledge of where BACnet commissioning actually runs) while the full multi-domain
 * Express Legion Server is no longer required to keep that capability alive in production.
 */
@Component
public class BacnetCommissioningClient {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final BacnetCommissioningClientProperties properties;

    public BacnetCommissioningClient(BacnetCommissioningClientProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(properties.getConnectTimeoutMs()))
            .build();
    }

    public record ProxiedResponse(int status, JsonNode body) {
    }

    private static String upstreamErrorMessage(JsonNode body, String fallback) {
        if (body != null && body.hasNonNull("error")) {
            return body.get("error").asString();
        }
        return fallback;
    }

    /**
     * Forwards one request to the commissioning process and returns its status/body verbatim
     * (2xx/4xx pass through unchanged, matching the Node commissioning service's own error
     * contract) — only a genuinely unreachable process or a 5xx upstream response is translated
     * into this Server's own 502/503 degradation contract.
     */
    public ProxiedResponse forward(String method, String pathWithQuery, JsonNode body) {
        try {
            HttpRequest.BodyPublisher publisher = body != null
                ? HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body))
                : HttpRequest.BodyPublishers.noBody();
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(properties.getBaseUrl() + pathWithQuery))
                .timeout(Duration.ofMillis(properties.getRequestTimeoutMs()))
                .header("Content-Type", "application/json")
                .method(method, publisher)
                .build();
            // JSON is UTF-8 by spec; force it explicitly rather than trusting the response's
            // Content-Type charset (see the identical fix in RuntimeClient/GeocodeService).
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));
            JsonNode json = null;
            String responseBody = response.body();
            if (responseBody != null && !responseBody.isBlank()) {
                try {
                    json = objectMapper.readTree(responseBody);
                } catch (RuntimeException ignored) {
                    json = null;
                }
            }
            if (response.statusCode() >= 500) {
                throw ApiException.badGateway(upstreamErrorMessage(json, "BACnet commissioning service returned an error"));
            }
            return new ProxiedResponse(response.statusCode(), json);
        } catch (IOException e) {
            throw ApiException.serviceUnavailable("BACnet commissioning service is unavailable: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApiException.serviceUnavailable("BACnet commissioning service is unavailable: " + e.getMessage());
        }
    }
}
