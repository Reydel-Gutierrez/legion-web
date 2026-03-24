const accessService = require('./access.service');

async function grantAccess(req, res) {
  const record = await accessService.grantUserSiteAccess(
    req.params.siteId,
    req.body
  );
  res.status(200).json(record);
}

module.exports = {
  grantAccess,
};
