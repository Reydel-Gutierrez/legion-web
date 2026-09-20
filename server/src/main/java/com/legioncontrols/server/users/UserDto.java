package com.legioncontrols.server.users;

import com.legioncontrols.server.jooq.generated.tables.records.UserRecord;
import java.time.LocalDateTime;
import java.util.List;

public record UserDto(
    String id,
    String email,
    String name,
    String status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<UserSiteAccessDto> userSiteAccess
) {
    public static UserDto from(UserRecord r, List<UserSiteAccessDto> access) {
        return new UserDto(
            r.getId(), r.getEmail(), r.getName(),
            r.getStatus() != null ? r.getStatus().getLiteral() : null,
            r.getCreatedat(), r.getUpdatedat(), access
        );
    }

    public static UserDto from(UserRecord r) {
        return from(r, null);
    }
}
