package com.legioncontrols.server.releases;

import com.legioncontrols.server.TestcontainersConfiguration;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.enums.Entitystatus;
import com.legioncontrols.server.jooq.generated.enums.Sitedeploymentaction;
import com.legioncontrols.server.jooq.generated.tables.records.ControllersmappedRecord;
import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import com.legioncontrols.server.jooq.generated.tables.records.FloorRecord;
import com.legioncontrols.server.jooq.generated.tables.records.BuildingRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointRecord;
import com.legioncontrols.server.jooq.generated.tables.records.PointsmappedRecord;
import com.legioncontrols.server.jooq.generated.tables.records.LivecontrollerbindingRecord;
import com.legioncontrols.server.jooq.generated.tables.records.LivepointbindingRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SitedeploymenteventRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteversionRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import tools.jackson.databind.node.ObjectNode;

import static com.legioncontrols.server.jooq.generated.tables.Building.BUILDING;
import static com.legioncontrols.server.jooq.generated.tables.Controllersmapped.CONTROLLERSMAPPED;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;
import static com.legioncontrols.server.jooq.generated.tables.Floor.FLOOR;
import static com.legioncontrols.server.jooq.generated.tables.Livecontrollerbinding.LIVECONTROLLERBINDING;
import static com.legioncontrols.server.jooq.generated.tables.Livepointbinding.LIVEPOINTBINDING;
import static com.legioncontrols.server.jooq.generated.tables.Point.POINT;
import static com.legioncontrols.server.jooq.generated.tables.Pointsmapped.POINTSMAPPED;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the Phase 1 Engineering / Release / Live lifecycle invariants (AGENTS.md,
 * backend/src/modules/siteVersions/siteVersion.service.js) hold in the Spring/jOOQ
 * reimplementation, against a real Postgres schema (Testcontainers, seeded with the actual Prisma
 * migrations — see PrismaSchemaInitializer). Most important single property under test: Engineering
 * edits must NEVER alter Live Runtime behavior before deployment (Phase 4 spec item 7).
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class EngineeringReleaseLifecycleIT {

    @Autowired
    private ReleaseService releaseService;

    @Autowired
    private DSLContext dsl;

    @Autowired
    private JsonUtil json;

    private String createSite(String name) {
        String id = UUID.randomUUID().toString();
        SiteRecord site = dsl.newRecord(SITE);
        site.setId(id);
        site.setName(name);
        site.setStatus(Entitystatus.ACTIVE);
        site.setCreatedat(LocalDateTime.now());
        site.setUpdatedat(LocalDateTime.now());
        site.insert();
        return id;
    }

    @Test
    void engineeringEditsNeverAlterActiveReleaseBeforeDeploy() {
        String siteId = createSite("IT — engineering isolation");

        // Build and deploy an initial release so there IS an active release to protect.
        SiteversionRecord firstRelease = releaseService.buildRelease(siteId, "it-test", null);
        releaseService.deployRelease(siteId, firstRelease.getId(), "it-test", "DEPLOY");

        SiteRecord siteAfterDeploy = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        String activeReleaseId = siteAfterDeploy.getActivereleaseversionid();
        assertThat(activeReleaseId).isEqualTo(firstRelease.getId());

        // Now make an Engineering edit to the WORKING version only.
        ObjectNode edited = json.newObject();
        edited.put("marker", "engineering-edit-should-not-reach-live");
        releaseService.putWorkingVersion(siteId, new ReleaseService.PutWorkingVersionRequest(edited, "mid-edit"));

        // The active release pointer, and the released version's own payload, must be untouched.
        SiteRecord siteAfterEdit = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        assertThat(siteAfterEdit.getActivereleaseversionid()).isEqualTo(activeReleaseId);

        SiteversionRecord releaseRowAfterEdit = dsl.selectFrom(
                com.legioncontrols.server.jooq.generated.tables.Siteversion.SITEVERSION)
            .where(com.legioncontrols.server.jooq.generated.tables.Siteversion.SITEVERSION.ID.eq(firstRelease.getId()))
            .fetchOne();
        assertThat(releaseRowAfterEdit.getStatus().getLiteral()).isEqualTo("RELEASED");
        assertThat(releaseService.payloadFor(releaseRowAfterEdit).toString()).doesNotContain("engineering-edit-should-not-reach-live");
    }

    @Test
    void buildCreatesANewImmutableReleaseWithoutMutatingWorking() {
        String siteId = createSite("IT — build immutability");

        SiteversionRecord working = releaseService.getOrCreateWorkingVersion(siteId);
        SiteversionRecord release = releaseService.buildRelease(siteId, "it-test", "first build");

        assertThat(release.getId()).isNotEqualTo(working.getId());
        assertThat(release.getStatus().getLiteral()).isEqualTo("RELEASED");
        assertThat(release.getSourceworkingversionid()).isEqualTo(working.getId());

        // Working row must still exist, unchanged in status, after building from it.
        SiteversionRecord workingAfterBuild = dsl.selectFrom(
                com.legioncontrols.server.jooq.generated.tables.Siteversion.SITEVERSION)
            .where(com.legioncontrols.server.jooq.generated.tables.Siteversion.SITEVERSION.ID.eq(working.getId()))
            .fetchOne();
        assertThat(workingAfterBuild.getStatus().getLiteral()).isEqualTo("WORKING");
    }

    @Test
    void deployActivatesReleaseAndRollbackRestoresThePrevious() {
        String siteId = createSite("IT — deploy and rollback");

        SiteversionRecord releaseOne = releaseService.buildRelease(siteId, "it-test", null);
        releaseService.deployRelease(siteId, releaseOne.getId(), "it-test", "DEPLOY");

        SiteversionRecord releaseTwo = releaseService.buildRelease(siteId, "it-test", null);
        releaseService.deployRelease(siteId, releaseTwo.getId(), "it-test", "DEPLOY");

        SiteRecord afterSecondDeploy = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        assertThat(afterSecondDeploy.getActivereleaseversionid()).isEqualTo(releaseTwo.getId());

        releaseService.rollbackToPreviousRelease(siteId, "it-test");

        SiteRecord afterRollback = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        assertThat(afterRollback.getActivereleaseversionid()).isEqualTo(releaseOne.getId());

        // Deployment ledger must show DEPLOY, DEPLOY, ROLLBACK in that order (by sequence).
        List<SitedeploymenteventRecord> events = releaseService.listDeploymentEvents(siteId);
        assertThat(events).hasSize(3);
        assertThat(events.get(0).getAction()).isEqualTo(Sitedeploymentaction.ROLLBACK);
        assertThat(events.get(0).getReleaseversionid()).isEqualTo(releaseOne.getId());
        assertThat(events.get(0).getPreviousreleaseversionid()).isEqualTo(releaseTwo.getId());
    }

    @Test
    void deployMaterializesLiveControllerBindingsFromTheDeployedReleaseOnly() {
        String siteId = createSite("IT — live materialization");

        // No controllers mapped at build time -> the release's frozen controllerBindings is empty,
        // so deploy must leave zero LiveControllerBinding rows for this site.
        SiteversionRecord release = releaseService.buildRelease(siteId, "it-test", null);
        releaseService.deployRelease(siteId, release.getId(), "it-test", "DEPLOY");

        int liveBindingCount = dsl.selectCount().from(LIVECONTROLLERBINDING)
            .where(LIVECONTROLLERBINDING.SITEID.eq(siteId))
            .fetchOne(0, int.class);
        assertThat(liveBindingCount).isZero();
    }

    @Test
    void deployMaterializesRealControllerAndPointBindingsFromControllersMapped() {
        String siteId = createSite("IT — real binding materialization");

        LocalDateTime now = LocalDateTime.now();
        BuildingRecord building = dsl.newRecord(BUILDING);
        building.setId(UUID.randomUUID().toString());
        building.setSiteid(siteId);
        building.setName("B1");
        building.setAddressline1("1 Test St");
        building.setCity("Testville");
        building.setState("FL");
        building.setPostalcode("00000");
        building.setCountry("USA");
        building.setStatus(Entitystatus.ACTIVE);
        building.setSortorder(0);
        building.setCreatedat(now);
        building.setUpdatedat(now);
        building.insert();

        FloorRecord floor = dsl.newRecord(FLOOR);
        floor.setId(UUID.randomUUID().toString());
        floor.setBuildingid(building.getId());
        floor.setName("F1");
        floor.setStatus(Entitystatus.ACTIVE);
        floor.setSortorder(0);
        floor.setCreatedat(now);
        floor.setUpdatedat(now);
        floor.insert();

        EquipmentRecord equipment = dsl.newRecord(EQUIPMENT);
        equipment.setId(UUID.randomUUID().toString());
        equipment.setSiteid(siteId);
        equipment.setBuildingid(building.getId());
        equipment.setFloorid(floor.getId());
        equipment.setName("AHU-1");
        equipment.setCode("AHU-1");
        equipment.setEquipmenttype("AHU");
        equipment.setStatus(Entitystatus.ACTIVE);
        equipment.setCreatedat(now);
        equipment.setUpdatedat(now);
        equipment.insert();

        PointRecord point = dsl.newRecord(POINT);
        point.setId(UUID.randomUUID().toString());
        point.setEquipmentid(equipment.getId());
        point.setSiteid(siteId);
        point.setBuildingid(building.getId());
        point.setFloorid(floor.getId());
        point.setPointname("Discharge Air Temp");
        point.setPointcode("DAT");
        point.setPointtype("AI");
        point.setWritable(false);
        point.setStatus(Entitystatus.ACTIVE);
        point.setCreatedat(now);
        point.setUpdatedat(now);
        point.insert();

        ControllersmappedRecord controller = dsl.newRecord(CONTROLLERSMAPPED);
        controller.setId(UUID.randomUUID().toString());
        controller.setEquipmentid(equipment.getId());
        controller.setControllercode("IT-CTRL-1");
        controller.setProtocol("SIM");
        controller.setSiteid(siteId);
        controller.setBuildingid(building.getId());
        controller.setFloorid(floor.getId());
        controller.setPollratems(5000);
        controller.setIssimulated(true);
        controller.setIsenabled(true);
        controller.setCreatedat(now);
        controller.setUpdatedat(now);
        controller.insert();

        PointsmappedRecord mapping = dsl.newRecord(POINTSMAPPED);
        mapping.setId(UUID.randomUUID().toString());
        mapping.setEquipmentcontrollerid(controller.getId());
        mapping.setEquipmentid(equipment.getId());
        mapping.setPointid(point.getId());
        mapping.setFieldpointkey("DAT");
        mapping.setReadenabled(true);
        mapping.setWriteenabled(false);
        mapping.setIsbound(true);
        mapping.setCreatedat(now);
        mapping.setUpdatedat(now);
        mapping.insert();

        SiteversionRecord release = releaseService.buildRelease(siteId, "it-test", null);
        releaseService.deployRelease(siteId, release.getId(), "it-test", "DEPLOY");

        LivecontrollerbindingRecord liveBinding = dsl.selectFrom(LIVECONTROLLERBINDING)
            .where(LIVECONTROLLERBINDING.SITEID.eq(siteId))
            .fetchOne();
        assertThat(liveBinding).isNotNull();
        assertThat(liveBinding.getControllercode()).isEqualTo("IT-CTRL-1");
        assertThat(liveBinding.getEquipmentid()).isEqualTo(equipment.getId());
        assertThat(liveBinding.getReleaseversionid()).isEqualTo(release.getId());

        LivepointbindingRecord livePointBinding = dsl.selectFrom(LIVEPOINTBINDING)
            .where(LIVEPOINTBINDING.LIVECONTROLLERBINDINGID.eq(liveBinding.getId()))
            .fetchOne();
        assertThat(livePointBinding).isNotNull();
        assertThat(livePointBinding.getFieldpointkey()).isEqualTo("DAT");
        assertThat(livePointBinding.getPointid()).isEqualTo(point.getId());
    }
}
