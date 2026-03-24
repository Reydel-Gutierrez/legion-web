/**
 * Leaflet basemap configuration (Global Site Layout, Site Builder map picker).
 *
 * With REACT_APP_MAPBOX_TOKEN: Mapbox public raster style `mapbox/streets-v12` (full-color “Streets” — water, parks, roads).
 * Without a token: OpenStreetMap.
 *
 * @see https://docs.mapbox.com/api/maps/raster-tiles/
 */

const MAPBOX_PUBLIC_STYLE = "mapbox/streets-v12";

function readMapboxToken() {
  const raw =
    typeof process !== "undefined" && process.env && process.env.REACT_APP_MAPBOX_TOKEN
      ? process.env.REACT_APP_MAPBOX_TOKEN
      : null;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
}

/**
 * @returns {{ provider: 'mapbox' | 'osm', url: string, attribution: string, tileLayerOptions: object }}
 */
export function getLeafletBasemapConfig() {
  const token = readMapboxToken();
  if (token) {
    const qs = new URLSearchParams({ access_token: token });
    return {
      provider: "mapbox",
      url: `https://api.mapbox.com/styles/v1/${MAPBOX_PUBLIC_STYLE}/tiles/256/{z}/{x}/{y}?${qs.toString()}`,
      attribution:
        '&copy; <a href="https://www.mapbox.com/about/maps/" rel="noreferrer">Mapbox</a> ' +
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      tileLayerOptions: {
        maxZoom: 22,
        maxNativeZoom: 22,
      },
    };
  }
  return {
    provider: "osm",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    tileLayerOptions: {
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
    },
  };
}

/** @param {object} L - Leaflet namespace */
export function createLeafletBasemapTileLayer(L) {
  const cfg = getLeafletBasemapConfig();
  const { url, attribution, tileLayerOptions } = cfg;
  return L.tileLayer(url, {
    attribution,
    ...tileLayerOptions,
  });
}
