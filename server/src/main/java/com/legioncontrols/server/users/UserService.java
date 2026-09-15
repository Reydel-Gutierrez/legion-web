package com.legioncontrols.server.users;

import com.legioncontrols.server.common.ApiException;
import com.legioncontrols.server.jooq.generated.enums.Entitystatus;
import com.legioncontrols.server.jooq.generated.tables.records.RoleRecord;
import com.legioncontrols.server.jooq.generated.tables.records.SiteRecord;
import com.legioncontrols.server.jooq.generated.tables.records.UserRecord;
import com.legioncontrols.server.jooq.generated.tables.records.UsersiteaccessRecord;
import com.legioncontrols.server.sites.SiteDto;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record4;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Role.ROLE;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static com.legioncontrols.server.jooq.generated.tables.User.USER;
import static com.legioncontrols.server.jooq.generated.tables.Usersiteaccess.USERSITEACCESS;

/** Java equivalent of backend/src/modules/users/user.service.js. */
@Service
public class UserService {

    private final DSLContext dsl;
    private final SiteAccessSeedService seedService;

    public UserService(DSLContext dsl, SiteAccessSeedService seedService) {
        this.dsl = dsl;
        this.seedService = seedService;
    }

    public List<UserDto> listUsers() {
        List<UserRecord> users = dsl.selectFrom(USER).orderBy(USER.EMAIL.asc()).fetch();
        return users.stream().map(u -> UserDto.from(u, fetchAccessForUser(u.getId()))).toList();
    }

    private List<UserSiteAccessDto> fetchAccessForUser(String userId) {
        return fetchAccessRows(USERSITEACCESS.USERID.eq(userId), USERSITEACCESS.CREATEDAT.asc());
    }

    public record CreateUserRequest(String email, String name, String status) {
    }

    public UserRecord createUser(CreateUserRequest req) {
        if (req.email() == null || req.email().isBlank()) {
            throw ApiException.badRequest("email is required");
        }
        UserRecord record = dsl.newRecord(USER);
        record.setId(UUID.randomUUID().toString());
        record.setEmail(req.email().trim().toLowerCase());
        if (req.name() != null) record.setName(req.name().trim());
        if (req.status() != null) record.setStatus(Entitystatus.valueOf(req.status().toUpperCase()));
        record.setCreatedat(LocalDateTime.now());
        record.setUpdatedat(LocalDateTime.now());
        record.insert();
        record.refresh();
        return record;
    }

    public List<UserSiteAccessDto> listUsersBySite(String siteId) {
        boolean siteExists = dsl.fetchExists(dsl.selectFrom(SITE).where(SITE.ID.eq(siteId)));
        if (!siteExists) {
            throw ApiException.notFound("Site not found");
        }
        List<UserSiteAccessDto> rows = fetchAccessRows(USERSITEACCESS.SITEID.eq(siteId), USERSITEACCESS.CREATEDAT.asc());
        if (rows.isEmpty()) {
            seedService.ensureSeedOwnerSiteAccess(siteId);
            rows = fetchAccessRows(USERSITEACCESS.SITEID.eq(siteId), USERSITEACCESS.CREATEDAT.asc());
        }
        return rows;
    }

    private List<UserSiteAccessDto> fetchAccessRows(org.jooq.Condition condition, org.jooq.SortField<?> order) {
        List<Record4<UsersiteaccessRecord, UserRecord, SiteRecord, RoleRecord>> rows = dsl
            .select(USERSITEACCESS, USER, SITE, ROLE)
            .from(USERSITEACCESS)
            .join(USER).on(USER.ID.eq(USERSITEACCESS.USERID))
            .join(SITE).on(SITE.ID.eq(USERSITEACCESS.SITEID))
            .join(ROLE).on(ROLE.ID.eq(USERSITEACCESS.ROLEID))
            .where(condition)
            .orderBy(order)
            .fetch();
        return rows.stream()
            .map(r -> UserSiteAccessDto.from(r.value1(), UserDto.from(r.value2()), SiteDto.from(r.value3()), RoleDto.from(r.value4())))
            .toList();
    }
}
