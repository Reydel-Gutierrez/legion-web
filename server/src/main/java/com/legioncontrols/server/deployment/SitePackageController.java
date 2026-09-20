package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.JsonUtil;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Java equivalent of the LC-ARCH-002 §6 Engineering workflow routes in
 * backend/src/modules/siteVersions/sitePackage.controller.js, mounted (as in siteVersion.routes.js)
 * under {@code /api/sites/{siteId}/package}: Validate Project, Build Site Package, Export Site
 * Package, Deploy to LS-100 (direct). These evolve the legacy same-database "Deploy to Live"
 * ({@link com.legioncontrols.server.releases.ReleaseController}, kept working unchanged for backward
 * compatibility) into the real offline-project -> portable-package model.
 */
@RestController
@RequestMapping("/api/sites/{siteId}/package")
public class SitePackageController {

    private final SitePackageService sitePackageService;
    private final DirectDeployService directDeployService;
    private final DeploymentAuth auth;
    private final JsonUtil json;

    public SitePackageController(SitePackageService sitePackageService, DirectDeployService directDeployService,
                                  DeploymentAuth auth, JsonUtil json) {
        this.sitePackageService = sitePackageService;
        this.directDeployService = directDeployService;
        this.auth = auth;
        this.json = json;
    }

    // Validate Project is never gated behind the deployment auth boundary in the Node original —
    // it is a read-only structural check Engineering runs freely, unlike Build/Export/Deploy which
    // produce or transfer a real deployable package.
    @PostMapping("/validate")
    public SitePackageService.ValidationResult validateProject(@PathVariable String siteId) {
        return sitePackageService.validateProjectForPackage(siteId);
    }

    public record BuildPackageBody(String author, String releaseNotes, String deploymentScope, Boolean simulationPackage) {
    }

    @PostMapping("/build")
    public ResponseEntity<Map<String, Object>> buildPackage(@PathVariable String siteId,
                                                               @RequestBody(required = false) BuildPackageBody body,
                                                               HttpServletRequest request) {
        auth.check(request);
        BuildPackageBody b = body != null ? body : new BuildPackageBody(null, null, null, null);
        SitePackageService.BuildResult result = sitePackageService.buildProjectPackage(
            siteId, b.author(), b.releaseNotes(), b.deploymentScope(), Boolean.TRUE.equals(b.simulationPackage()));
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("packageRecord", DeploymentPackageRecordDto.from(result.record(), json));
        out.put("fileName", result.fileName());
        out.put("validation", result.validation());
        out.put("exportUrl", "/api/sites/" + siteId + "/package/" + result.record().getId() + "/export");
        return ResponseEntity.status(HttpStatus.CREATED).body(out);
    }

    @GetMapping("/{packageRecordId}/export")
    public ResponseEntity<byte[]> exportPackage(@PathVariable String siteId, @PathVariable String packageRecordId,
                                                  HttpServletRequest request) {
        auth.check(request);
        SitePackageService.BuiltPackageBuffer built = sitePackageService.getBuiltPackageBuffer(packageRecordId);
        String fileName = String.valueOf(built.record().getSitename() != null ? built.record().getSitename() : "Site")
            .replaceAll("[^a-zA-Z0-9_-]+", "_") + "_" + built.record().getPackageversion() + ".lspkg";
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_OCTET_STREAM_VALUE)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
            .body(built.buffer());
    }

    public record DeployDirectBody(String targetUrl, String author, String releaseNotes, Boolean simulationPackage) {
    }

    @PostMapping("/deploy-direct")
    public ResponseEntity<Map<String, Object>> deployDirect(@PathVariable String siteId,
                                                               @RequestBody(required = false) DeployDirectBody body,
                                                               HttpServletRequest request) {
        auth.check(request);
        DeployDirectBody b = body != null ? body : new DeployDirectBody(null, null, null, null);
        DirectDeployService.DeployResult result = directDeployService.deployDirect(
            siteId, b.targetUrl(), b.author(), b.releaseNotes(), Boolean.TRUE.equals(b.simulationPackage()));
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("transferred", result.transferred());
        out.put("targetUrl", result.targetUrl());
        out.put("packageRecord", DeploymentPackageRecordDto.from(result.packageRecord(), json));
        out.put("remoteRecord", result.remoteRecord());
        return ResponseEntity.ok(out);
    }
}
