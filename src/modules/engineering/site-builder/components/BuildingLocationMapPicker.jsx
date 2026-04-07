import React, { useEffect, useMemo, useRef } from "react";
import L from "leaflet";

import {
  createLeafletBasemapTileLayer,
  getLeafletBasemapConfig,
} from "../../../../lib/siteLayout/leafletBasemapConfig";

const DEFAULT_CENTER = [27.5, -81.2];
const DEFAULT_ZOOM_NO_POINT = 4;
const ZOOM_WITH_POINT = 14;

function parseCoords(latStr, lngStr) {
  const la = parseFloat(String(latStr ?? "").trim());
  const ln = parseFloat(String(lngStr ?? "").trim());
  if (Number.isFinite(la) && Number.isFinite(ln)) return [la, ln];
  return null;
}

function formatCoord(n) {
  return Number(Number(n).toFixed(6));
}

function attachDrag(marker, onPositionChangeRef) {
  marker.off("dragend");
  marker.on("dragend", () => {
    const p = marker.getLatLng();
    onPositionChangeRef.current(String(formatCoord(p.lat)), String(formatCoord(p.lng)));
  });
}

/**
 * Small map (Mapbox streets-v12 when REACT_APP_MAPBOX_TOKEN is set, else OSM): click to place/move marker, drag to fine-tune.
 * Updates lat/lng as strings (decimal degrees) for the Site Builder form.
 */
export default function BuildingLocationMapPicker({ lat, lng, onPositionChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;

  const basemap = useMemo(() => getLeafletBasemapConfig(), []);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const el = containerRef.current;
    const map = L.map(el, { scrollWheelZoom: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM_NO_POINT);
    mapRef.current = map;
    createLeafletBasemapTileLayer(L).addTo(map);

    const handleClick = (e) => {
      const { lat: la, lng: ln } = e.latlng;
      const fa = formatCoord(la);
      const fn = formatCoord(ln);
      if (!markerRef.current) {
        const m = L.marker([la, ln], { draggable: true }).addTo(map);
        markerRef.current = m;
        attachDrag(m, onPositionChangeRef);
      } else {
        markerRef.current.setLatLng([la, ln]);
      }
      onPositionChangeRef.current(String(fa), String(fn));
    };

    map.on("click", handleClick);

    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      window.clearTimeout(t);
      map.off("click", handleClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const parsed = parseCoords(lat, lng);
    if (!parsed) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }
    const [la, ln] = parsed;
    if (!markerRef.current) {
      const m = L.marker([la, ln], { draggable: true }).addTo(map);
      markerRef.current = m;
      attachDrag(m, onPositionChangeRef);
      map.setView([la, ln], ZOOM_WITH_POINT);
      return;
    }
    const cur = markerRef.current.getLatLng();
    if (Math.abs(cur.lat - la) > 1e-7 || Math.abs(cur.lng - ln) > 1e-7) {
      markerRef.current.setLatLng([la, ln]);
      map.setView([la, ln], ZOOM_WITH_POINT);
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className={`site-builder-building-map-picker site-layout-leaflet-map site-layout-leaflet-map--${basemap.provider}`}
      role="application"
      aria-label="Map: click to place building location, drag marker to adjust"
    />
  );
}
