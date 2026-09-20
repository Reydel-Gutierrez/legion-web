package com.legioncontrols.server.users;

import com.legioncontrols.server.jooq.generated.tables.records.RoleRecord;
import java.time.LocalDateTime;

public record RoleDto(String id, String name, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static RoleDto from(RoleRecord r) {
        return new RoleDto(r.getId(), r.getName(), r.getCreatedat(), r.getUpdatedat());
    }
}
