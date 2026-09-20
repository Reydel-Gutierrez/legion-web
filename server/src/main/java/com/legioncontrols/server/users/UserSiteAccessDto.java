package com.legioncontrols.server.users;

import com.legioncontrols.server.jooq.generated.tables.records.UsersiteaccessRecord;
import com.legioncontrols.server.sites.SiteDto;
import java.time.LocalDateTime;

/** Matches Prisma's UserSiteAccess row shape, with optional nested user/site/role includes. */
public record UserSiteAccessDto(
    String id,
    String userId,
    String siteId,
    String roleId,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    UserDto user,
    SiteDto site,
    RoleDto role
) {
    public static UserSiteAccessDto from(UsersiteaccessRecord r, UserDto user, SiteDto site, RoleDto role) {
        return new UserSiteAccessDto(
            r.getId(), r.getUserid(), r.getSiteid(), r.getRoleid(),
            r.getCreatedat(), r.getUpdatedat(), user, site, role
        );
    }
}
