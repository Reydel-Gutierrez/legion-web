package com.legioncontrols.server.users;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.jooq.generated.tables.records.RoleRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import com.legioncontrols.server.jooq.generated.tables.records.UserRecord;
import com.legioncontrols.server.jooq.generated.tables.records.UsersiteaccessRecord;
import com.legioncontrols.server.sites.SiteDto;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Role.ROLE;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static com.legioncontrols.server.jooq.generated.tables.User.USER;
import static com.legioncontrols.server.jooq.generated.tables.Usersiteaccess.USERSITEACCESS;

/** Java equivalent of backend/src/modules/access/access.service.js. */
@Service
public class AccessService {

    /** Maps UI/mock role keys to seeded Role.name values (Prisma seed has no org_admin/viewer). */
    private static final Map<String, String> ROLE_ALIASES = Map.of("org_admin", "super_admin", "viewer", "operator");

    private final DSLContext dsl;

    public AccessService(DSLContext dsl) {
        this.dsl = dsl;
    }

    public record GrantAccessRequest(String userId, String roleId, String roleName) {
    }

    public UserSiteAccessDto grantUserSiteAccess(String siteId, GrantAccessRequest req) {
        if (req.userId() == null || req.userId().isBlank()) {
            throw ApiException.badRequest("userId is required");
        }

        SiteRecord site = dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)).fetchOne();
        if (site == null) {
            throw ApiException.notFound("Site not found");
        }
        UserRecord user = dsl.selectFrom(USER).where(USER.ID.eq(req.userId())).fetchOne();
        if (user == null) {
            throw ApiException.notFound("User not found");
        }

        RoleRecord role = resolveRole(req.roleId(), req.roleName());

        UsersiteaccessRecord existing = dsl.selectFrom(USERSITEACCESS)
            .where(USERSITEACCESS.USERID.eq(req.userId()), USERSITEACCESS.SITEID.eq(siteId))
            .fetchOne();
        UsersiteaccessRecord access;
        if (existing != null) {
            existing.setRoleid(role.getId());
            existing.setUpdatedat(LocalDateTime.now());
            existing.update();
            access = existing;
        } else {
            access = dsl.newRecord(USERSITEACCESS);
            access.setId(UUID.randomUUID().toString());
            access.setUserid(req.userId());
            access.setSiteid(siteId);
            access.setRoleid(role.getId());
            access.setCreatedat(LocalDateTime.now());
            access.setUpdatedat(LocalDateTime.now());
            access.insert();
        }

        return UserSiteAccessDto.from(access, UserDto.from(user), SiteDto.from(site), RoleDto.from(role));
    }

    private RoleRecord resolveRole(String roleId, String roleName) {
        if (roleId != null && !roleId.isBlank()) {
            RoleRecord byId = dsl.selectFrom(ROLE).where(ROLE.ID.eq(roleId.trim())).fetchOne();
            if (byId != null) return byId;
        }
        String raw = roleName != null && !roleName.isBlank() ? roleName.trim().toLowerCase() : "";
        String name = ROLE_ALIASES.getOrDefault(raw, raw.isBlank() ? "site_admin" : raw);

        RoleRecord byName = dsl.selectFrom(ROLE).where(ROLE.NAME.eq(name)).fetchOne();
        if (byName != null) return byName;

        RoleRecord fallback = dsl.selectFrom(ROLE).where(ROLE.NAME.eq("site_admin")).fetchOne();
        if (fallback != null) return fallback;

        RoleRecord created = dsl.newRecord(ROLE);
        created.setId(UUID.randomUUID().toString());
        created.setName("site_admin");
        created.setCreatedat(LocalDateTime.now());
        created.setUpdatedat(LocalDateTime.now());
        created.insert();
        return created;
    }
}
