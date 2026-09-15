package com.legioncontrols.server.deployment;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.DeploymentauditentryRecord;
import java.time.LocalDateTime;
import tools.jackson.databind.JsonNode;

/** Java equivalent of the raw DeploymentAuditEntry Prisma row shape (field stays `detailsJson`, unrenamed). */
public record AuditEntryDto(String id, String siteId, String packageRecordId, String action, String result,
                             String actor, JsonNode detailsJson, LocalDateTime createdAt) {
    public static AuditEntryDto from(DeploymentauditentryRecord r, JsonUtil json) {
        return new AuditEntryDto(r.getId(), r.getSiteid(), r.getPackagerecordid(), r.getAction(),
            r.getResult().getLiteral(), r.getActor(), r.getDetailsjson() != null ? json.toJsonNode(r.getDetailsjson()) : null,
            r.getCreatedat());
    }
}
