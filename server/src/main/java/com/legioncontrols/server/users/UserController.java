package com.legioncontrols.server.users;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Java equivalent of backend/src/modules/users/user.controller.js. */
@RestController
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/api/users")
    public List<UserDto> list() {
        return userService.listUsers();
    }

    @PostMapping("/api/users")
    public ResponseEntity<UserDto> create(@RequestBody UserService.CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(UserDto.from(userService.createUser(request)));
    }

    @GetMapping("/api/sites/{siteId}/users")
    public List<UserSiteAccessDto> listBySite(@PathVariable String siteId) {
        return userService.listUsersBySite(siteId);
    }
}
