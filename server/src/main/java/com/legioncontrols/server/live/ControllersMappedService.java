package com.legioncontrols.server.live;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.ControllersmappedRecord;
import com.legioncontrols.server.jooq.generated.tables.records.EquipmentRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import static com.legioncontrols.server.jooq.generated.tables.Controllersmapped.CONTROLLERSMAPPED;
import static com.legioncontrols.server.jooq.generated.tables.Equipment.EQUIPMENT;

/**
 * Java equivalent of the CORE CRUD in backend/src/modules/equipmentControllers/
 * equipmentControllers.service.js — Engineering's mutable controller-assignment table (distinct
 * from LiveControllerBinding, which only the deploy/rollback path in ReleaseService
 * materializes; AGENTS.md). Intentionally does NOT touch Runtime here.
 *
 * NOT ported: the Node version's SIM-catalog controllerCode/deviceInstance identity resolution
 * (resolveSimAssignIdentity, lib/simulatedControllers/catalog.js) and its post-assign
 * syncSimCatalogBindingsForEquipmentId self-heal call. Both are demo/SIM-catalog-specific
 * conveniences for the hardcoded FCU-1/FCU-2/VAV-1 demo devices, not core architecture — same
 * category of deferral as the release-deploy SIM resync (see ReleaseService). A caller assigning a
 * real (non-demo) controller code is unaffected; a caller relying on the SIM catalog's fuzzy
 * code/instance matching should keep using the Express endpoint until this is ported.
 */
@Service
public class ControllersMappedService {

    private final DSLContext dsl;
    private final JsonUtil json;

    public ControllersMappedService(DSLContext dsl, JsonUtil json) {
        this.dsl = dsl;
        this.json = json;
    }

    public record AssignRequest(String equipmentId, String controllerCode, String displayName, String protocol,
                                 String deviceInstance, String ipAddress, String networkAddress,
                                 Integer pollRateMs, Boolean isSimulated, JsonNode metadata) {
    }

    public ControllersmappedRecord assign(AssignRequest req) {
        if (isBlank(req.equipmentId()) || isBlank(req.controllerCode()) || isBlank(req.protocol())) {
            throw ApiException.badRequest("equipmentId, controllerCode, and protocol are required");
        }
        String protocol = req.protocol().trim();
        boolean isSimulated = req.isSimulated() != null ? req.isSimulated() : "SIM".equalsIgnoreCase(protocol);
        String controllerCode = req.controllerCode().trim();

        EquipmentRecord equipment = dsl.selectFrom(EQUIPMENT).where(EQUIPMENT.ID.eq(req.equipmentId().trim())).fetchOne();
        if (equipment == null) throw ApiException.notFound("Equipment not found");

        boolean codeTakenElsewhere = dsl.fetchExists(dsl.selectFrom(CONTROLLERSMAPPED)
            .where(CONTROLLERSMAPPED.SITEID.eq(equipment.getSiteid()))
            .and(CONTROLLERSMAPPED.CONTROLLERCODE.equalIgnoreCase(controllerCode))
            .and(CONTROLLERSMAPPED.EQUIPMENTID.ne(equipment.getId())));
        if (codeTakenElsewhere) {
            throw ApiException.conflict("controllerCode \"" + controllerCode + "\" is already assigned to another equipment on this site");
        }

        ControllersmappedRecord existing = dsl.selectFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.EQUIPMENTID.eq(equipment.getId())).fetchOne();
        if (existing != null && !existing.getControllercode().equalsIgnoreCase(controllerCode)) {
            dsl.deleteFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.ID.eq(existing.getId())).execute();
            existing = null;
        }

        LocalDateTime now = LocalDateTime.now();
        ControllersmappedRecord record = existing != null ? existing : dsl.newRecord(CONTROLLERSMAPPED);
        if (existing == null) {
            record.setId(UUID.randomUUID().toString());
            record.setCreatedat(now);
        }
        record.setEquipmentid(equipment.getId());
        record.setControllercode(controllerCode);
        record.setDisplayname(blankToNull(req.displayName()));
        record.setProtocol(protocol);
        record.setDeviceinstance(blankToNull(req.deviceInstance()));
        record.setIpaddress(blankToNull(req.ipAddress()));
        record.setNetworkaddress(blankToNull(req.networkAddress()));
        record.setSiteid(equipment.getSiteid());
        record.setBuildingid(equipment.getBuildingid());
        record.setFloorid(equipment.getFloorid());
        record.setPollratems(req.pollRateMs() != null ? req.pollRateMs() : 5000);
        record.setIssimulated(isSimulated);
        record.setIsenabled(true);
        record.setStatus("ASSIGNED");
        if (req.metadata() != null) record.setMetadatajson(json.toJsonb(req.metadata()));
        record.setUpdatedat(now);
        if (existing == null) record.insert(); else record.update();
        record.refresh();
        return record;
    }

    public ControllersmappedRecord getByEquipmentId(String equipmentId) {
        return dsl.selectFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.EQUIPMENTID.eq(equipmentId.trim())).fetchOne();
    }

    public List<ControllersmappedRecord> list() {
        return dsl.selectFrom(CONTROLLERSMAPPED).orderBy(CONTROLLERSMAPPED.UPDATEDAT.desc()).fetch();
    }

    public ControllersmappedRecord update(String id, JsonNode body) {
        ControllersmappedRecord existing = dsl.selectFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.ID.eq(id.trim())).fetchOne();
        if (existing == null) throw ApiException.notFound("ControllersMapped row not found");

        boolean changed = false;
        if (body.has("displayName")) { existing.setDisplayname(nullableTrim(body.get("displayName"))); changed = true; }
        if (body.has("pollRateMs")) { existing.setPollratems(body.get("pollRateMs").isNull() ? null : body.get("pollRateMs").asInt()); changed = true; }
        if (body.has("isEnabled")) { existing.setIsenabled(body.get("isEnabled").asBoolean()); changed = true; }
        if (body.has("status")) { existing.setStatus(nullableTrim(body.get("status"))); changed = true; }
        if (body.has("metadata")) { existing.setMetadatajson(body.get("metadata").isNull() ? null : json.toJsonb(body.get("metadata"))); changed = true; }
        if (body.has("deviceInstance")) { existing.setDeviceinstance(nullableTrim(body.get("deviceInstance"))); changed = true; }
        if (body.has("ipAddress")) { existing.setIpaddress(nullableTrim(body.get("ipAddress"))); changed = true; }
        if (body.has("networkAddress")) { existing.setNetworkaddress(nullableTrim(body.get("networkAddress"))); changed = true; }
        if (body.has("lastSeenAt")) {
            var node = body.get("lastSeenAt");
            existing.setLastseenat(node.isNull() || node.asText("").isBlank() ? null : java.time.OffsetDateTime.parse(node.asText()).toLocalDateTime());
            changed = true;
        }
        if (!changed) throw ApiException.badRequest("No fields to update");

        existing.setUpdatedat(LocalDateTime.now());
        existing.update();
        return existing;
    }

    public void remove(String id) {
        boolean exists = dsl.fetchExists(dsl.selectFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.ID.eq(id.trim())));
        if (!exists) throw ApiException.notFound("ControllersMapped row not found");
        // PointsMapped rows cascade-delete with the controller assignment (FK ON DELETE CASCADE).
        dsl.deleteFrom(CONTROLLERSMAPPED).where(CONTROLLERSMAPPED.ID.eq(id.trim())).execute();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String nullableTrim(JsonNode node) {
        if (node == null || node.isNull()) return null;
        String trimmed = node.asText().trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
