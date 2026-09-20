package com.legioncontrols.server.deployment;

import com.legioncontrols.server.jooq.generated.tables.records.LscommissioningRecord;
import java.time.LocalDateTime;

/** Java equivalent of the raw LsCommissioning Prisma row shape returned by deployment.service.js. */
public record CommissioningDto(String id, String state, String activeSiteId, String activePackageRecordId, LocalDateTime updatedAt) {
    public static CommissioningDto from(LscommissioningRecord r) {
        if (r == null) return null;
        return new CommissioningDto(r.getId(), r.getState().getLiteral(), r.getActivesiteid(), r.getActivepackagerecordid(), r.getUpdatedat());
    }
}
