package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.DeploymentpackagerecordRecord;
import java.time.LocalDateTime;
import tools.jackson.databind.JsonNode;

/**
 * Java equivalent of deployment.service.js's {@code serializePackageRecord} — spreads the
 * DeploymentPackageRecord row as-is, renaming only the three JSONB columns
 * ({@code manifestJson}/{@code changePreviewJson}/{@code validationErrorsJson} ->
 * {@code manifest}/{@code changePreview}/{@code validationErrors}) so the frontend needs no changes.
 */
public record DeploymentPackageRecordDto(
    String id, String packageId, String siteId, String siteName, String packageVersion, int schemaVersion,
    String status, String source, String filePath, String checksumSha256, JsonNode manifest, JsonNode changePreview,
    JsonNode validationErrors, LocalDateTime receivedAt, LocalDateTime validatedAt, LocalDateTime activatedAt,
    LocalDateTime supersededAt, String failureReason, String createdSiteVersionId
) {
    public static DeploymentPackageRecordDto from(DeploymentpackagerecordRecord r, JsonUtil json) {
        if (r == null) return null;
        return new DeploymentPackageRecordDto(
            r.getId(), r.getPackageid(), r.getSiteid(), r.getSitename(), r.getPackageversion(),
            r.getSchemaversion(), r.getStatus().getLiteral(), r.getSource().getLiteral(), r.getFilepath(),
            r.getChecksumsha256(), r.getManifestjson() != null ? json.toJsonNode(r.getManifestjson()) : null,
            r.getChangepreviewjson() != null ? json.toJsonNode(r.getChangepreviewjson()) : null,
            r.getValidationerrorsjson() != null ? json.toJsonNode(r.getValidationerrorsjson()) : null,
            r.getReceivedat(), r.getValidatedat(), r.getActivatedat(), r.getSupersededat(),
            r.getFailurereason(), r.getCreatedsiteversionid()
        );
    }
}
