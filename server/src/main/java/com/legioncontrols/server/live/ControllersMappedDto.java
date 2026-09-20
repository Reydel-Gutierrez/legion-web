package com.legioncontrols.server.live;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.ControllersmappedRecord;
import java.time.LocalDateTime;
import tools.jackson.databind.JsonNode;

public record ControllersMappedDto(
    String id, String equipmentId, String controllerCode, String displayName, String protocol,
    String deviceInstance, String ipAddress, String networkAddress, String siteId, String buildingId,
    String floorId, Integer pollRateMs, boolean isSimulated, boolean isEnabled, String status,
    LocalDateTime lastSeenAt, JsonNode metadata, LocalDateTime createdAt, LocalDateTime updatedAt
) {
    public static ControllersMappedDto from(ControllersmappedRecord r, JsonUtil json) {
        return new ControllersMappedDto(
            r.getId(), r.getEquipmentid(), r.getControllercode(), r.getDisplayname(), r.getProtocol(),
            r.getDeviceinstance(), r.getIpaddress(), r.getNetworkaddress(), r.getSiteid(), r.getBuildingid(),
            r.getFloorid(), r.getPollratems(), Boolean.TRUE.equals(r.getIssimulated()), !Boolean.FALSE.equals(r.getIsenabled()),
            r.getStatus(), r.getLastseenat(), r.getMetadatajson() != null ? json.toJsonNode(r.getMetadatajson()) : null,
            r.getCreatedat(), r.getUpdatedat()
        );
    }
}
