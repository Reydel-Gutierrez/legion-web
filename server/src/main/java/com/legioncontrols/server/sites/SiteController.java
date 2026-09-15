package com.legioncontrols.server.sites;

import java.util.List;
import org.springframework.web.bind.annotation.*;

/** Java equivalent of the top-level routes in backend/src/modules/sites/site.routes.js. */
@RestController
@RequestMapping("/api/sites")
public class SiteController {

    private final SiteService siteService;

    public SiteController(SiteService siteService) {
        this.siteService = siteService;
    }

    @GetMapping
    public List<SiteDto> list() {
        return siteService.list().stream().map(SiteDto::from).toList();
    }

    @PostMapping
    public SiteDto create(@RequestBody SiteService.CreateSiteRequest request) {
        return SiteDto.from(siteService.create(request));
    }

    @GetMapping("/{id}")
    public SiteDto getById(@PathVariable String id) {
        return SiteDto.from(siteService.getById(id));
    }

    @PatchMapping("/{id}")
    public SiteDto update(@PathVariable String id, @RequestBody SiteService.UpdateSiteRequest request) {
        return SiteDto.from(siteService.update(id, request));
    }
}
