package com.legioncontrols.server.users;

import com.legioncontrols.server.jooq.generated.tables.records.RoleRecord;
import com.legioncontrols.server.jooq.generated.tables.records.UserRecord;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import static com.legioncontrols.server.jooq.generated.tables.Role.ROLE;
import static com.legioncontrols.server.jooq.generated.tables.Site.SITE;
import static com.legioncontrols.server.jooq.generated.tables.User.USER;
import static com.legioncontrols.server.jooq.generated.tables.Usersiteaccess.USERSITEACCESS;

/**
 * Java equivalent of backend/src/lib/siteAccess.js — a dev/lab convenience (not real multi-tenant
 * access control, per the Node code's own comments) that auto-provisions a fixed "lab owner" user
 * with site_admin access whenever a site has zero access rows. Ported for full behavioral parity
 * with the Node backend rather than silently dropped.
 */
@Service
public class SiteAccessSeedService {

    private static final String DEFAULT_OWNER_EMAIL = "reydel.gutierrez@legioncontrol.com";
    private static final String DEFAULT_OWNER_NAME = "Reydel Gutierrez";
    private static final String LEGACY_OWNER_EMAIL = "reydel@legion.local";

    private final DSLContext dsl;

    @Value("${legion.seed-owner.email:}")
    private String configuredOwnerEmail;

    @Value("${legion.seed-owner.name:}")
    private String configuredOwnerName;

    public SiteAccessSeedService(DSLContext dsl) {
        this.dsl = dsl;
    }

    public UserRecord findOrCreateOwnerUser() {
        String primaryEmail = (blankToNull(configuredOwnerEmail) != null ? configuredOwnerEmail : DEFAULT_OWNER_EMAIL).trim().toLowerCase();
        String displayName = (blankToNull(configuredOwnerName) != null ? configuredOwnerName : DEFAULT_OWNER_NAME).trim();

        Set<String> tryEmails = new LinkedHashSet<>();
        tryEmails.add(primaryEmail);
        tryEmails.add(DEFAULT_OWNER_EMAIL);
        tryEmails.add(LEGACY_OWNER_EMAIL);

        for (String email : tryEmails) {
            UserRecord existing = dsl.selectFrom(USER).where(USER.EMAIL.eq(email)).fetchOne();
            if (existing != null) {
                if (!displayName.isBlank() && !displayName.equals(existing.getName())) {
                    existing.setName(displayName);
                    existing.setUpdatedat(LocalDateTime.now());
                    existing.update();
                }
                if (LEGACY_OWNER_EMAIL.equals(existing.getEmail()) && primaryEmail.equals(DEFAULT_OWNER_EMAIL) && !primaryEmail.equals(existing.getEmail())) {
                    boolean taken = dsl.fetchExists(dsl.selectFrom(USER).where(USER.EMAIL.eq(primaryEmail)));
                    if (!taken) {
                        existing.setEmail(primaryEmail);
                        existing.update();
                    }
                }
                return existing;
            }
        }

        UserRecord created = dsl.newRecord(USER);
        created.setId(UUID.randomUUID().toString());
        created.setEmail(primaryEmail);
        created.setName(!displayName.isBlank() ? displayName : DEFAULT_OWNER_NAME);
        created.setCreatedat(LocalDateTime.now());
        created.setUpdatedat(LocalDateTime.now());
        created.insert();
        return created;
    }

    private RoleRecord findOrCreateSiteAdminRole() {
        RoleRecord role = dsl.selectFrom(ROLE).where(ROLE.NAME.eq("site_admin")).fetchOne();
        if (role != null) return role;
        RoleRecord created = dsl.newRecord(ROLE);
        created.setId(UUID.randomUUID().toString());
        created.setName("site_admin");
        created.setCreatedat(LocalDateTime.now());
        created.setUpdatedat(LocalDateTime.now());
        created.insert();
        return created;
    }

    /** Ensures the lab owner user has UserSiteAccess to the site and is set as createdBy when missing. */
    public void ensureSeedOwnerSiteAccess(String siteId) {
        RoleRecord role = findOrCreateSiteAdminRole();
        UserRecord owner = findOrCreateOwnerUser();

        dsl.update(SITE).set(SITE.CREATEDBYUSERID, owner.getId())
            .where(SITE.ID.eq(siteId), SITE.CREATEDBYUSERID.isNull())
            .execute();

        boolean exists = dsl.fetchExists(dsl.selectFrom(USERSITEACCESS)
            .where(USERSITEACCESS.USERID.eq(owner.getId()), USERSITEACCESS.SITEID.eq(siteId)));
        if (exists) {
            dsl.update(USERSITEACCESS).set(USERSITEACCESS.ROLEID, role.getId())
                .where(USERSITEACCESS.USERID.eq(owner.getId()), USERSITEACCESS.SITEID.eq(siteId))
                .execute();
        } else {
            var access = dsl.newRecord(USERSITEACCESS);
            access.setId(UUID.randomUUID().toString());
            access.setUserid(owner.getId());
            access.setSiteid(siteId);
            access.setRoleid(role.getId());
            access.setCreatedat(LocalDateTime.now());
            access.setUpdatedat(LocalDateTime.now());
            access.insert();
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
