package com.legioncontrols.server.sites;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.jooq.generated.enums.Entitystatus;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;

/**
 * Java equivalent of backend/src/modules/sites/site.controller.js + site.service.js — top-level
 * Site CRUD. Site hierarchy (buildings/floors/equipment/points) lives in {@link SiteHierarchyService}.
 */
@Service
public class SiteService {

    private final DSLContext dsl;

    public SiteService(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<SiteRecord> list() {
        return dsl.selectFrom(SITE).orderBy(SITE.NAME.asc()).fetch();
    }

    public SiteRecord getById(String id) {
        SiteRecord site = dsl.selectFrom(SITE).where(SITE.ID.eq(id)).fetchOne();
        if (site == null) {
            throw ApiException.notFound("Site not found");
        }
        return site;
    }

    public record CreateSiteRequest(String name, String timezone, String siteType, String description) {
    }

    public SiteRecord create(CreateSiteRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw ApiException.badRequest("name is required");
        }
        SiteRecord site = dsl.newRecord(SITE);
        site.setId(UUID.randomUUID().toString());
        site.setName(request.name().trim());
        site.setStatus(Entitystatus.ACTIVE);
        site.setTimezone(request.timezone());
        site.setSitetype(request.siteType());
        site.setDescription(request.description());
        site.setCreatedat(LocalDateTime.now());
        site.setUpdatedat(LocalDateTime.now());
        site.insert();
        return site;
    }

    public record UpdateSiteRequest(String name, String timezone, String siteType, String description,
                                     String displayLabel, String engineeringNotes, String icon, String status) {
    }

    public SiteRecord update(String id, UpdateSiteRequest request) {
        SiteRecord site = getById(id);
        boolean changed = false;
        if (request.name() != null) { site.setName(request.name()); changed = true; }
        if (request.timezone() != null) { site.setTimezone(request.timezone()); changed = true; }
        if (request.siteType() != null) { site.setSitetype(request.siteType()); changed = true; }
        if (request.description() != null) { site.setDescription(request.description()); changed = true; }
        if (request.displayLabel() != null) { site.setDisplaylabel(request.displayLabel()); changed = true; }
        if (request.engineeringNotes() != null) { site.setEngineeringnotes(request.engineeringNotes()); changed = true; }
        if (request.icon() != null) { site.setIcon(request.icon()); changed = true; }
        if (request.status() != null) {
            site.setStatus(Entitystatus.valueOf(request.status().toUpperCase()));
            changed = true;
        }
        if (!changed) {
            throw ApiException.badRequest("No fields to update");
        }
        site.setUpdatedat(LocalDateTime.now());
        site.update();
        return site;
    }
}
