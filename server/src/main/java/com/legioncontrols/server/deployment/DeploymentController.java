package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.DeploymentpackagerecordRecord;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Java equivalent of backend/src/modules/deployment/deployment.controller.js +
 * deployment.routes.js — the LS-100 `.lspkg` commissioning/deployment HTTP surface. Same paths,
 * same status codes, same no-cache headers (LS-100 commissioning/deployment state changes on every
 * stage/validate/activate — never cacheable), so the frontend and any LS-100 client need no changes.
 */
@RestController
@RequestMapping("/api/deployment")
public class DeploymentController {

    private final DeploymentService service;
    private final DeploymentAuth auth;
    private final JsonUtil json;

    public DeploymentController(DeploymentService service, DeploymentAuth auth, JsonUtil json) {
        this.service = service;
        this.auth = auth;
        this.json = json;
    }

    private static ResponseEntity.BodyBuilder noCache(ResponseEntity.BodyBuilder builder) {
        return builder.header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, private");
    }

    private static String clampActor(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.substring(0, Math.min(trimmed.length(), 200));
    }

    private static String actorFromQueryOrHeader(HttpServletRequest request) {
        String actor = clampActor(request.getParameter("actor"));
        if (actor != null) return actor;
        return clampActor(request.getHeader("x-legion-actor"));
    }

    private static String actorFromBodyOrRequest(Map<String, Object> body, HttpServletRequest request) {
        Object bodyActor = body != null ? body.get("actor") : null;
        String fromBody = bodyActor != null ? clampActor(String.valueOf(bodyActor)) : null;
        return fromBody != null ? fromBody : actorFromQueryOrHeader(request);
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        DeploymentService.StatusResult status = service.getStatus();
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("commissioning", CommissioningDto.from(status.commissioning()));
        body.put("activePackage", DeploymentPackageRecordDto.from(status.activePackage(), json));
        return noCache(ResponseEntity.ok()).body(body);
    }

    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> getHistory(@RequestParam(required = false) String siteId) {
        DeploymentService.HistoryResult history = service.listHistory(siteId);
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("packages", history.packages().stream().map(r -> DeploymentPackageRecordDto.from(r, json)).toList());
        body.put("auditEntries", history.auditEntries().stream().map(r -> AuditEntryDto.from(r, json)).toList());
        return noCache(ResponseEntity.ok()).body(body);
    }

    @PostMapping(value = "/import", consumes = MediaType.ALL_VALUE)
    public ResponseEntity<DeploymentPackageRecordDto> importPackage(@RequestBody byte[] body,
                                                                      @RequestParam(required = false, defaultValue = "OFFLINE_IMPORT") String source,
                                                                      HttpServletRequest request) {
        auth.check(request);
        if (body == null || body.length == 0) {
            throw ApiException.badRequest("Request body must be the raw .lspkg file bytes (application/octet-stream)");
        }
        DeploymentpackagerecordRecord record = service.stagePackage(body, source.toUpperCase(), actorFromQueryOrHeader(request));
        return noCache(ResponseEntity.status(HttpStatus.CREATED)).body(DeploymentPackageRecordDto.from(record, json));
    }

    @GetMapping("/packages/{id}")
    public ResponseEntity<DeploymentPackageRecordDto> getPackage(@PathVariable String id, HttpServletRequest request) {
        auth.check(request);
        return noCache(ResponseEntity.ok()).body(DeploymentPackageRecordDto.from(service.getPackageRecord(id), json));
    }

    @PostMapping("/packages/{id}/validate")
    public ResponseEntity<DeploymentPackageRecordDto> validatePackage(@PathVariable String id,
                                                                        @RequestBody(required = false) Map<String, Object> body,
                                                                        HttpServletRequest request) {
        auth.check(request);
        DeploymentpackagerecordRecord record = service.validatePackage(id, actorFromBodyOrRequest(body, request));
        return noCache(ResponseEntity.ok()).body(DeploymentPackageRecordDto.from(record, json));
    }

    @GetMapping("/packages/{id}/preview")
    public ResponseEntity<DeploymentPackageRecordDto> previewPackage(@PathVariable String id, HttpServletRequest request) {
        auth.check(request);
        return noCache(ResponseEntity.ok()).body(DeploymentPackageRecordDto.from(service.previewPackage(id), json));
    }

    @PostMapping("/packages/{id}/activate")
    public ResponseEntity<DeploymentPackageRecordDto> activatePackage(@PathVariable String id,
                                                                        @RequestBody(required = false) Map<String, Object> body,
                                                                        HttpServletRequest request) {
        auth.check(request);
        DeploymentpackagerecordRecord record = service.activatePackage(id, actorFromBodyOrRequest(body, request));
        HttpStatus status = "ACTIVE".equals(record.getStatus().getLiteral()) ? HttpStatus.OK : HttpStatus.CONFLICT;
        return noCache(ResponseEntity.status(status)).body(DeploymentPackageRecordDto.from(record, json));
    }

    @PostMapping("/packages/{id}/discard")
    public ResponseEntity<DeploymentPackageRecordDto> discardPackage(@PathVariable String id,
                                                                       @RequestBody(required = false) Map<String, Object> body,
                                                                       HttpServletRequest request) {
        auth.check(request);
        DeploymentpackagerecordRecord record = service.discardPackage(id, actorFromBodyOrRequest(body, request));
        return noCache(ResponseEntity.ok()).body(DeploymentPackageRecordDto.from(record, json));
    }

    public record RollbackBody(String siteId, String actor) {
    }

    @PostMapping("/rollback")
    public ResponseEntity<Map<String, Object>> rollback(@RequestBody(required = false) RollbackBody body, HttpServletRequest request) {
        auth.check(request);
        if (body == null || body.siteId() == null || body.siteId().isBlank()) {
            throw ApiException.badRequest("siteId is required");
        }
        String actor = clampActor(body.actor()) != null ? clampActor(body.actor()) : actorFromQueryOrHeader(request);
        DeploymentService.RollbackResult result = service.rollbackToPreviousVersion(body.siteId(), actor);
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("ok", result.ok());
        out.put("siteVersionId", result.siteVersionId());
        return noCache(ResponseEntity.ok()).body(out);
    }

    @GetMapping("/backups/{id}/download")
    public ResponseEntity<byte[]> downloadBackup(@PathVariable String id, HttpServletRequest request) {
        auth.check(request);
        DeploymentService.DownloadableBackup backup = service.downloadBackup(id);
        return noCache(ResponseEntity.ok())
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_OCTET_STREAM_VALUE)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + backup.fileName() + "\"")
            .body(backup.buffer());
    }

    public record RecommissionBody(String actor, String reason) {
    }

    @PostMapping("/recommission")
    public ResponseEntity<CommissioningDto> recommission(@RequestBody(required = false) RecommissionBody body, HttpServletRequest request) {
        auth.check(request);
        String actorFromBody = body != null ? clampActor(body.actor()) : null;
        String actor = actorFromBody != null ? actorFromBody : actorFromQueryOrHeader(request);
        String reason = body != null ? body.reason() : null;
        return noCache(ResponseEntity.ok()).body(CommissioningDto.from(service.recommission(actor, reason)));
    }
}
