const geocodeService = require('./geocode.service');
const { HttpError } = require('../../lib/httpError');

async function suggest(req, res) {
  const q = req.query.q;
  const limit = req.query.limit;
  if (!q || typeof q !== 'string' || !String(q).trim()) {
    throw new HttpError(400, 'Query parameter q is required');
  }
  const results = await geocodeService.suggestAddresses(q, limit);
  res.json({ results });
}

module.exports = {
  suggest,
};
