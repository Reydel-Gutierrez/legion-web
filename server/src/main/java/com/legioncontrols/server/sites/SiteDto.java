package com.legioncontrols.server.sites;

import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import java.time.LocalDateTime;

/**
 * API-facing Site shape, matching the Node backend's field names exactly (Prisma returns the
 * model's own camelCase field names verbatim as JSON). jOOQ's generated Record getters are
 * all-lowercase (e.g. {@code getSitetype()}) purely as a Java naming artifact — never serialize a
 * Record directly, always go through a DTO like this one so the wire shape stays camelCase.
 */
public record SiteDto(
    String id,
    String name,
    String status,
    String timezone,
    String siteType,
    String description,
    String displayLabel,
    String engineeringNotes,
    String icon,
    String createdByUserId,
    String activeReleaseVersionId,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static SiteDto from(SiteRecord r) {
        return new SiteDto(
            r.getId(),
            r.getName(),
            r.getStatus() != null ? r.getStatus().getLiteral() : null,
            r.getTimezone(),
            r.getSitetype(),
            r.getDescription(),
            r.getDisplaylabel(),
            r.getEngineeringnotes(),
            r.getIcon(),
            r.getCreatedbyuserid(),
            r.getActivereleaseversionid(),
            r.getCreatedat(),
            r.getUpdatedat()
        );
    }
}
