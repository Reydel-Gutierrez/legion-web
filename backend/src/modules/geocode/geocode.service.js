/**
 * Forward geocoding via OpenStreetMap Nominatim (server-side with proper User-Agent).
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */

const https = require('https');

const NOMINATIM_HOST = 'nominatim.openstreetmap.org';
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'LegionControls/1.0 (site-builder; contact: engineering@legion.local)';

function httpsGetJson(pathAndQuery) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: NOMINATIM_HOST,
        path: pathAndQuery,
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Geocoding HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function pickCity(addr) {
  if (!addr || typeof addr !== 'object') return '';
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.hamlet ||
    addr.suburb ||
    ''
  );
}

function pickState(addr) {
  if (!addr || typeof addr !== 'object') return '';
  return addr.state || addr.region || addr.county || '';
}

function streetLine(addr, displayName) {
  if (!addr || typeof addr !== 'object') {
    return displayName ? String(displayName).split(',')[0].trim() : '';
  }
  const parts = [addr.house_number, addr.road, addr.pedestrian, addr.path].filter(Boolean);
  if (parts.length) return parts.join(' ').trim();
  if (addr.neighbourhood && addr.road) return `${addr.road}`.trim();
  return displayName ? String(displayName).split(',')[0].trim() : '';
}

/**
 * @param {string} q
 * @param {number} [limit]
 * @returns {Promise<Array<{ id: string, label: string, addressLine: string, city: string, state: string, lat: number, lng: number }>>}
 */
async function suggestAddresses(q, limit = 6) {
  const query = String(q || '').trim();
  if (query.length < 3) {
    return [];
  }
  const lim = Math.min(Math.max(Number(limit) || 6, 1), 10);
  const path = `/search?${new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: String(lim),
    q: query,
  }).toString()}`;

  const data = await httpsGetJson(path);
  if (!Array.isArray(data)) return [];

  return data.map((hit) => {
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    const addr = hit.address || {};
    return {
      id: String(hit.place_id ?? `${hit.lat},${hit.lon}`),
      label: hit.display_name || '',
      addressLine: streetLine(addr, hit.display_name),
      city: pickCity(addr),
      state: pickState(addr),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  });
}

module.exports = {
  suggestAddresses,
};
