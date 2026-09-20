const service = require('./operatorDefinitions.service');
const handler = (fn) => async (req, res) => res.json({ data: await fn(req) });
exports.list = handler((req) => service.list(req.params.siteId, req.params.kind, req.query));
exports.create = handler((req) => service.create(req.params.siteId, req.params.kind, req.body));
exports.update = handler((req) => service.update(req.params.siteId, req.params.kind, req.params.id, req.body));
exports.remove = handler((req) => service.remove(req.params.siteId, req.params.kind, req.params.id));
exports.assign = handler((req) => service.assign(req.params.siteId, req.params.kind, req.params.id, req.body));
exports.unassign = handler((req) => service.unassign(req.params.siteId, req.params.kind, req.params.id, req.params.equipmentId));
