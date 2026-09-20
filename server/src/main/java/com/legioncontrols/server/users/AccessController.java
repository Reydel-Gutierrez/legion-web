package com.legioncontrols.server.users;

import org.springframework.web.bind.annotation.*;

/** Java equivalent of backend/src/modules/access/access.controller.js. */
@RestController
public class AccessController {

    private final AccessService accessService;

    public AccessController(AccessService accessService) {
        this.accessService = accessService;
    }

    @PostMapping("/api/sites/{siteId}/users/access")
    public UserSiteAccessDto grantAccess(@PathVariable String siteId, @RequestBody AccessService.GrantAccessRequest request) {
        return accessService.grantUserSiteAccess(siteId, request);
    }
}
