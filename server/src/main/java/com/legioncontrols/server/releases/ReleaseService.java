package com.legioncontrols.server.releases;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.enums.Sitedeploymentaction;
import com.legioncontrols.server.jooq.generated.enums.Siteversionstatus;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SitedeploymenteventRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteversionRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteversionpayloadRecord;
import com.legioncontrols.server.live.LiveConfigService;
import com.legioncontrols.server.runtime.RuntimeService;
import com.legioncontrols.server.sites.SiteHierarchyService;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static com.legioncontrols.server.jooq.generated.tables.Sitedeploymentevent.SITEDEPLOYMENTEVENT;
import static com.legioncontrols.server.jooq.generated.tables.Siteversion.SITEVERSION;
import static com.legioncontrols.server.jooq.generated.tables.Siteversionpayload.SITEVERSIONPAYLOAD;

/**
 * Java equivalent of backend/src/modules/siteVersions/siteVersion.service.js — preserves EXACTLY
 * the Phase 1 Engineering -> Working -> immutable Release -> Deploy -> Live Configuration ->
 * rollback/history architecture (AGENTS.md). Every method here mirrors its Node counterpart's
 * transaction boundaries and ordering precisely; see the class-level comment on each method for the
 * specific invariant it must never violate.
 */
@Service
public class ReleaseService {

    private static final Logger log = LoggerFactory.getLogger(ReleaseService.class);

    private final DSLContext dsl;
    private final JsonUtil json;
    private final ReleasePayloadService payloadService;
    private final SiteHierarchyService hierarchyService;
    private final LiveConfigService liveConfigService;
    private final RuntimeService runtimeService;

    public ReleaseService(DSLContext dsl, JsonUtil json, ReleasePayloadService payloadService,
                           SiteHierarchyService hierarchyService, LiveConfigService liveConfigService,
                           RuntimeService runtimeService) {
        this.dsl = dsl;
        this.json = json;
        this.payloadService = payloadService;
        this.hierarchyService = hierarchyService;
        this.liveConfigService = liveConfigService;
        this.runtimeService = runtimeService;
    }

    private SiteRecord assertSiteExists(DSLContext ctx, String siteId) {
        SiteRecord site = ctx.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        if (site == null) {
            throw ApiException.notFound("Site not found");
        }
        return site;
    }

    private int nextVersionNumber(DSLContext ctx, String siteId) {
        Integer max = ctx.select(org.jooq.impl.DSL.max(SITEVERSION.VERSIONNUMBER))
            .from(SITEVERSION)
            .where(SITEVERSION.SITEID.eq(siteId))
            .fetchOne(0, Integer.class);
        return (max != null ? max : 0) + 1;
    }

    private JsonNode payloadOf(DSLContext ctx, String siteVersionId) {
        SiteversionpayloadRecord row = ctx.selectFrom(SITEVERSIONPAYLOAD)
            .where(SITEVERSIONPAYLOAD.SITEVERSIONID.eq(siteVersionId))
            .fetchOne();
        return row != null ? json.toJsonNode(row.getPayloadjson()) : null;
    }

    private void upsertPayload(DSLContext ctx, String siteVersionId, JsonNode payload) {
        SiteversionpayloadRecord existing = ctx.selectFrom(SITEVERSIONPAYLOAD)
            .where(SITEVERSIONPAYLOAD.SITEVERSIONID.eq(siteVersionId))
            .fetchOne();
        if (existing != null) {
            existing.setPayloadjson(json.toJsonb(payload));
            existing.update();
        } else {
            SiteversionpayloadRecord row = ctx.newRecord(SITEVERSIONPAYLOAD);
            row.setId(UUID.randomUUID().toString());
            row.setSiteversionid(siteVersionId);
            row.setPayloadjson(json.toJsonb(payload));
            row.insert();
        }
    }

    /** Find current WORKING version or create one (clone from active release or empty default). */
    public SiteversionRecord getOrCreateWorkingVersion(String siteId) {
        return dsl.transactionResult(cfg -> {
            DSLContext ctx = org.jooq.impl.DSL.using(cfg);
            SiteRecord site = assertSiteExists(ctx, siteId);

            SiteversionRecord existing = ctx.selectFrom(SITEVERSION)
                .where(SITEVERSION.SITEID.eq(siteId), SITEVERSION.STATUS.eq(Siteversionstatus.WORKING))
                .fetchOne();
            if (existing != null) return existing;

            ObjectNode initialPayload;
            String parentVersionId = null;
            if (site.getActivereleaseversionid() != null) {
                JsonNode activePayload = payloadOf(ctx, site.getActivereleaseversionid());
                initialPayload = activePayload != null
                    ? payloadService.deploymentSnapshotToWorkingPayload(activePayload)
                    : payloadService.createDefaultWorkingPayload();
                parentVersionId = site.getActivereleaseversionid();
            } else {
                initialPayload = payloadService.createDefaultWorkingPayload();
            }

            int versionNumber = nextVersionNumber(ctx, siteId);
            SiteversionRecord created = ctx.newRecord(SITEVERSION);
            created.setId(UUID.randomUUID().toString());
            created.setSiteid(siteId);
            created.setVersionnumber(versionNumber);
            created.setStatus(Siteversionstatus.WORKING);
            created.setParentversionid(parentVersionId);
            created.setCreatedat(LocalDateTime.now());
            created.setUpdatedat(LocalDateTime.now());
            created.insert();
            upsertPayload(ctx, created.getId(), initialPayload);
            return created;
        });
    }

    /** Merge relational hierarchy into the WORKING payload so Site Builder and deploy see DB truth. */
    public SiteversionRecord syncWorkingPayloadFromDb(String siteId) {
        assertSiteExists(dsl, siteId);
        SiteversionRecord working = dsl.selectFrom(SITEVERSION)
            .where(SITEVERSION.SITEID.eq(siteId), SITEVERSION.STATUS.eq(Siteversionstatus.WORKING))
            .fetchOne();
        if (working == null) {
            working = getOrCreateWorkingVersion(siteId);
        }

        JsonNode existingPayload = payloadOf(dsl, working.getId());
        ObjectNode merged = existingPayload != null
            ? (ObjectNode) json.clone(existingPayload)
            : payloadService.createDefaultWorkingPayload();

        SiteHierarchyService.HierarchyResult hierarchy = hierarchyService.buildWorkingSiteEquipmentFromDb(siteId);
        merged.set("site", hierarchy.site());
        merged.set("equipment", hierarchy.equipment());

        upsertPayload(dsl, working.getId(), merged);
        return dsl.selectFrom(SITEVERSION).where(SITEVERSION.ID.eq(working.getId())).fetchOne();
    }

    public record PutWorkingVersionRequest(JsonNode payload, String notes) {
    }

    public SiteversionRecord putWorkingVersion(String siteId, PutWorkingVersionRequest request) {
        assertSiteExists(dsl, siteId);
        if (request.payload() == null || !request.payload().isObject()) {
            throw ApiException.badRequest("payload is required and must be a JSON object");
        }

        SiteversionRecord working = dsl.selectFrom(SITEVERSION)
            .where(SITEVERSION.SITEID.eq(siteId), SITEVERSION.STATUS.eq(Siteversionstatus.WORKING))
            .fetchOne();
        if (working == null) {
            working = getOrCreateWorkingVersion(siteId);
        }

        if (request.notes() != null) {
            working.setNotes(request.notes());
            working.update();
        }
        upsertPayload(dsl, working.getId(), json.clone(request.payload()));

        return syncWorkingPayloadFromDb(siteId);
    }

    public record ActiveRelease(SiteversionRecord version, JsonNode payload) {
    }

    public ActiveRelease getActiveRelease(String siteId) {
        SiteRecord site = assertSiteExists(dsl, siteId);
        if (site.getActivereleaseversionid() == null) {
            return null;
        }
        SiteversionRecord version = dsl.selectFrom(SITEVERSION).where(SITEVERSION.ID.eq(site.getActivereleaseversionid())).fetchOne();
        if (version == null) return null;
        return new ActiveRelease(version, payloadOf(dsl, version.getId()));
    }

    /**
     * BUILD RELEASE: validate the current WORKING version and freeze it into a brand-new, immutable
     * RELEASED SiteVersion. The WORKING version itself is left completely untouched — Engineering
     * keeps editing the same working copy — and nothing about the Live/active release changes yet
     * (see {@link #deployRelease} for activation). Lineage: parentVersionId chains to the site's
     * CURRENT active RELEASED version (release-to-release only, never to the mutable WORKING row).
     * Also freezes ControllersMapped/PointsMapped into controllerBindings/pointBindings so DEPLOY can
     * later materialize Runtime's Live projection from what was true at BUILD time.
     */
    public SiteversionRecord buildRelease(String siteId, String builtBy, String notes) {
        SiteRecord site = assertSiteExists(dsl, siteId);
        syncWorkingPayloadFromDb(siteId);

        SiteversionRecord working = dsl.selectFrom(SITEVERSION)
            .where(SITEVERSION.SITEID.eq(siteId), SITEVERSION.STATUS.eq(Siteversionstatus.WORKING))
            .fetchOne();
        if (working == null) {
            throw ApiException.notFound("No working version to build");
        }

        JsonNode workingPayload = payloadOf(dsl, working.getId());
        payloadService.requireValidForDeploy(workingPayload);

        int versionNumber = nextVersionNumber(dsl, siteId);
        String cleanBuiltBy = builtBy != null && !builtBy.isBlank() ? builtBy.trim() : null;
        String cleanNotes = notes != null && !notes.isBlank() ? notes.trim() : null;

        ObjectNode snapshot = payloadService.buildDeploymentSnapshotFromWorking(
            workingPayload,
            new ReleasePayloadService.SnapshotOverrides("v" + versionNumber, null, null, "Built")
        );

        SiteHierarchyService.HierarchyResult opHierarchy = hierarchyService.buildWorkingSiteEquipmentFromDb(siteId);
        snapshot.set("site", opHierarchy.site());
        snapshot.set("equipment", opHierarchy.equipment());

        LiveConfigService.CapturedLiveConfig captured = liveConfigService.captureLiveConfigForSite(dsl, siteId);
        snapshot.set("controllerBindings", captured.controllerBindings());
        snapshot.set("pointBindings", captured.pointBindings());

        SiteversionRecord release = dsl.newRecord(SITEVERSION);
        release.setId(UUID.randomUUID().toString());
        release.setSiteid(siteId);
        release.setVersionnumber(versionNumber);
        release.setStatus(Siteversionstatus.RELEASED);
        release.setParentversionid(site.getActivereleaseversionid());
        release.setSourceworkingversionid(working.getId());
        release.setCreatedby(cleanBuiltBy);
        release.setNotes(cleanNotes);
        release.setCreatedat(LocalDateTime.now());
        release.setUpdatedat(LocalDateTime.now());
        release.insert();
        upsertPayload(dsl, release.getId(), snapshot);

        return release;
    }

    /**
     * DEPLOY: activate an existing, already-built RELEASED version. Never mutates the released
     * version's engineering configuration — only deploy-lifecycle stamps change. The active-pointer
     * flip, Live projection materialization, and activation-event append all happen in ONE
     * transaction, so a failure leaves the previously active release (and the Live projection
     * Runtime is reading) completely untouched. Runtime reload happens AFTER commit and never rolls
     * back the activation on failure (see the try/catch below).
     */
    public SiteversionRecord deployRelease(String siteId, String releaseVersionId, String deployedBy, String action) {
        assertSiteExists(dsl, siteId);

        SiteversionRecord release = dsl.selectFrom(SITEVERSION).where(SITEVERSION.ID.eq(releaseVersionId)).fetchOne();
        if (release == null || !release.getSiteid().equals(siteId)) {
            throw ApiException.notFound("Release version not found for this site");
        }
        if (release.getStatus() != Siteversionstatus.RELEASED) {
            throw ApiException.conflict("Version v" + release.getVersionnumber() + " is not a built release and cannot be deployed");
        }

        String cleanDeployedBy = deployedBy != null && !deployedBy.isBlank() ? deployedBy.trim() : null;
        Sitedeploymentaction eventAction = "ROLLBACK".equals(action) ? Sitedeploymentaction.ROLLBACK : Sitedeploymentaction.DEPLOY;
        LocalDateTime deployedAt = LocalDateTime.now();

        JsonNode basePayload = payloadOf(dsl, release.getId());
        JsonNode controllerBindings = basePayload != null ? basePayload.get("controllerBindings") : null;
        JsonNode pointBindings = basePayload != null ? basePayload.get("pointBindings") : null;

        SiteversionRecord activated = dsl.transactionResult(cfg -> {
            DSLContext ctx = org.jooq.impl.DSL.using(cfg);

            SiteRecord siteBefore = ctx.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
            String previousReleaseVersionId = siteBefore.getActivereleaseversionid();

            SiteversionRecord toUpdate = ctx.selectFrom(SITEVERSION).where(SITEVERSION.ID.eq(release.getId())).fetchOne();
            toUpdate.setDeployedat(deployedAt);
            toUpdate.setDeployedby(cleanDeployedBy);
            toUpdate.update();

            if (basePayload != null && basePayload.isObject()) {
                ObjectNode displayPayload = (ObjectNode) json.clone(basePayload);
                displayPayload.put("lastDeployedAt", deployedAt.atZone(java.time.ZoneOffset.UTC).toInstant().toString());
                if (cleanDeployedBy != null) displayPayload.put("deployedBy", cleanDeployedBy); else displayPayload.putNull("deployedBy");
                displayPayload.put("systemStatus", "Running");
                upsertPayload(ctx, release.getId(), displayPayload);
            }

            ctx.update(SITE).set(SITE.ACTIVERELEASEVERSIONID, release.getId()).where(SITE.ID.eq(siteId)).execute();

            // Materialize Runtime's Live projection from THIS release's own frozen bindings — never
            // from whatever ControllersMapped/PointsMapped say right now.
            liveConfigService.materializeLiveConfigForSite(ctx, siteId, release.getId(), controllerBindings, pointBindings);

            SitedeploymenteventRecord event = ctx.newRecord(SITEDEPLOYMENTEVENT);
            event.setId(UUID.randomUUID().toString());
            event.setSiteid(siteId);
            event.setReleaseversionid(release.getId());
            event.setPreviousreleaseversionid(previousReleaseVersionId);
            event.setAction(eventAction);
            event.setActivatedat(deployedAt);
            event.setActivatedby(cleanDeployedBy);
            event.insert();

            return toUpdate;
        });

        // Best-effort, outside the transaction: tell Runtime to re-resolve its controller store.
        // Deliberately never throws and never rolls back the activation above on failure.
        try {
            runtimeService.resyncLiveSimBindings();
        } catch (Exception e) {
            log.warn("[deploy] Runtime live-binding resync skipped: {}", e.getMessage());
        }

        return activated;
    }

    /** Combined "Deploy version" convenience: BUILD RELEASE followed immediately by DEPLOY of it. */
    public SiteversionRecord deployWorkingVersion(String siteId, String deployedBy, String notes) {
        SiteversionRecord release = buildRelease(siteId, deployedBy, notes);
        return deployRelease(siteId, release.getId(), deployedBy, "DEPLOY");
    }

    /** ROLLBACK: reactivate a previously RELEASED version as-is (no duplication/edit of its content). */
    public SiteversionRecord rollbackToVersion(String siteId, String releaseVersionId, String actor) {
        return deployRelease(siteId, releaseVersionId, actor, "ROLLBACK");
    }

    /**
     * Convenience rollback: reactivate whichever RELEASED version was active immediately before the
     * current one. Derives "previous" from the append-only SiteDeploymentEvent ledger's `sequence`
     * (never from a release row's mutable deployedAt cache, which cannot answer this correctly once a
     * release has been reactivated more than once).
     */
    public SiteversionRecord rollbackToPreviousRelease(String siteId, String actor) {
        SiteRecord site = assertSiteExists(dsl, siteId);
        if (site.getActivereleaseversionid() == null) {
            throw ApiException.conflict("Site has no active release to roll back from");
        }

        List<SitedeploymenteventRecord> history = dsl.selectFrom(SITEDEPLOYMENTEVENT)
            .where(SITEDEPLOYMENTEVENT.SITEID.eq(siteId))
            .fetch()
            .stream()
            .sorted(Comparator.comparingInt(SitedeploymenteventRecord::getSequence).reversed())
            .toList();

        SitedeploymenteventRecord previousEvent = history.stream()
            .filter(e -> !e.getReleaseversionid().equals(site.getActivereleaseversionid()))
            .findFirst()
            .orElse(null);
        if (previousEvent == null) {
            throw ApiException.conflict("No prior released version exists to roll back to");
        }

        return rollbackToVersion(siteId, previousEvent.getReleaseversionid(), actor);
    }

    /** Deployment/activation history for a site, newest first — ordered by sequence, not activatedAt. */
    public List<SitedeploymenteventRecord> listDeploymentEvents(String siteId) {
        assertSiteExists(dsl, siteId);
        return dsl.selectFrom(SITEDEPLOYMENTEVENT)
            .where(SITEDEPLOYMENTEVENT.SITEID.eq(siteId))
            .fetch()
            .stream()
            .sorted(Comparator.comparingInt(SitedeploymenteventRecord::getSequence).reversed())
            .toList();
    }

    public List<SiteversionRecord> listVersionHistory(String siteId) {
        assertSiteExists(dsl, siteId);
        return dsl.selectFrom(SITEVERSION)
            .where(SITEVERSION.SITEID.eq(siteId))
            .orderBy(SITEVERSION.VERSIONNUMBER.desc())
            .fetch();
    }

    public JsonNode payloadFor(SiteversionRecord version) {
        return payloadOf(dsl, version.getId());
    }
}
