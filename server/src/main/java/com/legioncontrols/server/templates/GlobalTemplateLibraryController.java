package com.legioncontrols.server.templates;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/** Java equivalent of backend/src/modules/globalTemplateLibrary/globalTemplateLibrary.controller.js. */
@RestController
@RequestMapping("/api/global-template-library")
public class GlobalTemplateLibraryController {

    private final GlobalTemplateLibraryService service;

    public GlobalTemplateLibraryController(GlobalTemplateLibraryService service) {
        this.service = service;
    }

    @GetMapping("/equipment-templates")
    public List<GlobalTemplateLibraryService.EquipmentListRow> listEquipment() {
        return service.listEquipmentTemplates();
    }

    @PostMapping("/equipment-templates")
    public ResponseEntity<GlobalTemplateLibraryService.EquipmentDetail> postEquipment(@RequestBody JsonNode body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createEquipmentTemplateFromSitePayload(body));
    }

    @GetMapping("/equipment-templates/{id}")
    public GlobalTemplateLibraryService.EquipmentDetail getEquipment(@PathVariable String id) {
        return service.getEquipmentTemplateById(id);
    }

    @PatchMapping("/equipment-templates/{id}")
    public GlobalTemplateLibraryService.EquipmentListRow patchEquipment(@PathVariable String id, @RequestBody(required = false) JsonNode body) {
        return service.updateEquipmentTemplateName(id, body);
    }

    @DeleteMapping("/equipment-templates/{id}")
    public ResponseEntity<Void> deleteEquipment(@PathVariable String id) {
        service.deleteEquipmentTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/graphic-templates")
    public List<GlobalTemplateLibraryService.GraphicListRow> listGraphic() {
        return service.listGraphicTemplates();
    }

    @PostMapping("/graphic-templates")
    public ResponseEntity<GlobalTemplateLibraryService.GraphicDetail> postGraphic(@RequestBody JsonNode body) {
        JsonNode equipmentTemplates = body.has("equipmentTemplates") && body.get("equipmentTemplates").isArray() ? body.get("equipmentTemplates") : null;
        JsonNode templatePayload = body.has("template") && body.get("template").isObject() ? body.get("template") : body;
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createGraphicTemplateFromSitePayload(templatePayload, equipmentTemplates));
    }

    @GetMapping("/graphic-templates/{id}")
    public GlobalTemplateLibraryService.GraphicDetail getGraphic(@PathVariable String id) {
        return service.getGraphicTemplateById(id);
    }

    @PatchMapping("/graphic-templates/{id}")
    public GlobalTemplateLibraryService.GraphicListRow patchGraphic(@PathVariable String id, @RequestBody(required = false) JsonNode body) {
        return service.updateGraphicTemplateName(id, body);
    }

    @DeleteMapping("/graphic-templates/{id}")
    public ResponseEntity<Void> deleteGraphic(@PathVariable String id) {
        service.deleteGraphicTemplate(id);
        return ResponseEntity.noContent().build();
    }
}
