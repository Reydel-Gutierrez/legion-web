package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.jooq.generated.tables.records.DeploymentpackagerecordRecord;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Java port of backend/src/modules/deployment/directDeploy.service.js — Direct deploy (LC-ARCH-002
 * §4 "Direct deploy over LAN"). Builds a package exactly the way Export Site Package does, then
 * transfers those same bytes over HTTP to a configured LS-100's {@code /api/deployment/import}
 * endpoint — the identical staging/validate/preview/backup/activate pipeline as offline import
 * (DEP-004: "must not become separate configuration formats"). This module owns transfer only; it
 * never touches the target's database directly.
 */
@Service
public class DirectDeployService {

    private final SitePackageService sitePackageService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public DirectDeployService(SitePackageService sitePackageService, ObjectMapper objectMapper) {
        this.sitePackageService = sitePackageService;
        this.objectMapper = objectMapper;
    }

    public record DeployResult(boolean transferred, String targetUrl, DeploymentpackagerecordRecord packageRecord, JsonNode remoteRecord) {
    }

    public DeployResult deployDirect(String siteId, String targetUrl, String actor, String releaseNotes, boolean simulationPackage) {
        String trimmedUrl = targetUrl != null ? targetUrl.trim().replaceAll("/+$", "") : "";
        if (trimmedUrl.isEmpty()) {
            throw ApiException.badRequest("targetUrl is required (e.g. http://ls100-sim.local:4100)");
        }
        URI uri;
        try {
            uri = URI.create(trimmedUrl);
            if (uri.getScheme() == null) throw new IllegalArgumentException();
        } catch (RuntimeException e) {
            throw ApiException.badRequest("targetUrl is not a valid URL: " + trimmedUrl);
        }
        if (!"http".equals(uri.getScheme()) && !"https".equals(uri.getScheme())) {
            throw ApiException.badRequest("targetUrl must be http or https");
        }

        SitePackageService.BuildResult built = sitePackageService.buildProjectPackage(siteId, actor, releaseNotes, null, simulationPackage);
        SitePackageService.BuiltPackageBuffer buffer = sitePackageService.getBuiltPackageBuffer(built.record().getId());

        String token = System.getenv("LS100_DEPLOY_TOKEN");

        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(trimmedUrl + "/api/deployment/import?source=DIRECT"))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "application/octet-stream")
            .POST(HttpRequest.BodyPublishers.ofByteArray(buffer.buffer()));
        if (token != null && !token.isBlank()) requestBuilder.header("Authorization", "Bearer " + token);

        HttpResponse<String> response;
        try {
            response = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));
        } catch (java.io.IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw ApiException.badGateway("Could not reach LS-100 at " + trimmedUrl + ": " + e.getMessage());
        }

        JsonNode bodyJson = null;
        try {
            bodyJson = objectMapper.readTree(response.body());
        } catch (RuntimeException ignored) {
            // non-JSON error body from a proxy/unexpected endpoint; surfaced as-is below
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String detail = bodyJson != null && bodyJson.hasNonNull("error") ? bodyJson.get("error").asString()
                : (!response.body().isEmpty() ? response.body() : String.valueOf(response.statusCode()));
            throw new ApiException(response.statusCode(), "LS-100 rejected the package: " + detail);
        }

        return new DeployResult(true, trimmedUrl, built.record(), bodyJson);
    }
}
