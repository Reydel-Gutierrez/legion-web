const globalTemplateLibraryService = require('./globalTemplateLibrary.service');

async function listEquipment(req, res) {
  const rows = await globalTemplateLibraryService.listEquipmentTemplates();
  res.json(rows);
}

async function getEquipment(req, res) {
  const row = await globalTemplateLibraryService.getEquipmentTemplateById(req.params.id);
  res.json(row);
}

async function postEquipment(req, res) {
  const row = await globalTemplateLibraryService.createEquipmentTemplateFromSitePayload(req.body);
  res.status(201).json(row);
}

async function patchEquipment(req, res) {
  const row = await globalTemplateLibraryService.updateEquipmentTemplateName(req.params.id, req.body || {});
  res.json(row);
}

async function deleteEquipment(req, res) {
  await globalTemplateLibraryService.deleteEquipmentTemplate(req.params.id);
  res.status(204).end();
}

async function listGraphic(req, res) {
  const rows = await globalTemplateLibraryService.listGraphicTemplates();
  res.json(rows);
}

async function getGraphic(req, res) {
  const row = await globalTemplateLibraryService.getGraphicTemplateById(req.params.id);
  res.json(row);
}

async function postGraphic(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const equipmentTemplates = Array.isArray(body.equipmentTemplates) ? body.equipmentTemplates : [];
  const templatePayload = body.template && typeof body.template === 'object' ? body.template : body;
  const row = await globalTemplateLibraryService.createGraphicTemplateFromSitePayload(
    templatePayload,
    equipmentTemplates
  );
  res.status(201).json(row);
}

async function patchGraphic(req, res) {
  const row = await globalTemplateLibraryService.updateGraphicTemplateName(req.params.id, req.body || {});
  res.json(row);
}

async function deleteGraphic(req, res) {
  await globalTemplateLibraryService.deleteGraphicTemplate(req.params.id);
  res.status(204).end();
}

module.exports = {
  listEquipment,
  getEquipment,
  postEquipment,
  patchEquipment,
  deleteEquipment,
  listGraphic,
  getGraphic,
  postGraphic,
  patchGraphic,
  deleteGraphic,
};
