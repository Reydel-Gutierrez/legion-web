import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { siteLayoutRepository } from "../../../../lib/data";
import {
  createLeafletBasemapTileLayer,
  getLeafletBasemapConfig,
} from "../../../../lib/siteLayout/leafletBasemapConfig";
import SiteLayoutBuildingsPanel from "./SiteLayoutBuildingsPanel";

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(status) {
  if (status === "alert") return "legion-site-layout-status--alert";
  if (status === "warning") return "legion-site-layout-status--warning";
  return "legion-site-layout-status--normal";
}

function statusLabel(status) {
  if (status === "alert") return "Alert";
  if (status === "warning") return "Warning";
  return "Normal";
}

export default function SiteGlobalMapView({
  activeDeployment,
  siteDisplayName,
  selectedBuildingId,
  onSelectBuilding,
  onOpenBuilding,
}) {
  const deploymentSiteId =
    activeDeployment && activeDeployment.site && activeDeployment.site.id ? activeDeployment.site.id : null;

  const panelBuildings = useMemo(
    () => siteLayoutRepository.getSiteLayoutBuildingsList(activeDeployment),
    [activeDeployment]
  );

  const mapBuildings = useMemo(() => panelBuildings.filter((b) => b.hasGeo), [panelBuildings]);

  const [search, setSearch] = useState("");

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerByIdRef = useRef(new Map());
  const onSelectRef = useRef(onSelectBuilding);
  const onOpenRef = useRef(onOpenBuilding);

  onSelectRef.current = onSelectBuilding;
  onOpenRef.current = onOpenBuilding;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return panelBuildings;
    return panelBuildings.filter((b) => {
      const hay = `${b.name} ${b.addressLine} ${b.city} ${b.state}`.toLowerCase();
      return hay.includes(q);
    });
  }, [panelBuildings, search]);

  const basemap = useMemo(() => getLeafletBasemapConfig(), []);

  // Map + markers: runs whenever geo set or site changes. Always show basemap when the site has buildings.
  useEffect(() => {
    if (!mapElRef.current || panelBuildings.length === 0) return undefined;

    const el = mapElRef.current;
    const center =
      mapBuildings.length === 1
        ? [mapBuildings[0].lat, mapBuildings[0].lng]
        : [27.5, -81.2];
    const zoom = mapBuildings.length === 1 ? 14 : 7;

    const map = L.map(el, { scrollWheelZoom: true }).setView(center, zoom);
    mapRef.current = map;
    createLeafletBasemapTileLayer(L).addTo(map);

    const markerById = new Map();
    mapBuildings.forEach((b) => {
      const m = L.marker([b.lat, b.lng]).addTo(map);
      const html = `
        <div class="site-layout-popup-inner text-dark small">
          <div class="fw-semibold mb-1">${escapeHtml(b.name)}</div>
          <div class="text-muted mb-2">${escapeHtml(b.addressLine)}</div>
          <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
            <span class="badge rounded-pill ${statusClass(b.status)}">${statusLabel(b.status)}</span>
          </div>
          <button type="button" class="btn btn-sm btn-primary w-100 site-layout-open-building" data-building-id="${escapeHtml(
            b.id
          )}">
            Open building
          </button>
        </div>
      `;
      m.bindPopup(html, { minWidth: 260, className: "site-layout-popup shadow" });
      m.on("click", () => {
        onSelectRef.current(b.id);
      });
      markerById.set(b.id, m);
    });
    markerByIdRef.current = markerById;

    map.on("popupopen", (e) => {
      const node = e.popup.getElement();
      if (!node) return;
      const btn = node.querySelector(".site-layout-open-building");
      if (btn) {
        btn.onclick = (ev) => {
          ev.preventDefault();
          const id = btn.getAttribute("data-building-id");
          if (id) onOpenRef.current(id);
        };
      }
    });

    const pts = mapBuildings.map((b) => L.latLng(b.lat, b.lng));
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [52, 52], maxZoom: 14 });
    } else if (pts.length === 1) {
      map.setView(pts[0], 14);
    }

    const onResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", onResize);
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      window.removeEventListener("resize", onResize);
      map.remove();
      mapRef.current = null;
      markerByIdRef.current = new Map();
    };
  }, [mapBuildings, deploymentSiteId, panelBuildings.length]);

  // Fly to selection or refit when selection cleared (geo buildings only).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !panelBuildings.length) return;

    const run = () => {
      if (selectedBuildingId) {
        const one = panelBuildings.find((b) => b.id === selectedBuildingId);
        if (one && one.hasGeo) {
          map.flyTo([one.lat, one.lng], 14, { duration: 0.55, easeLinearity: 0.25 });
        }
        return;
      }
      const pts = mapBuildings.map((b) => L.latLng(b.lat, b.lng));
      if (pts.length > 1) {
        map.flyToBounds(L.latLngBounds(pts), { padding: [52, 52], maxZoom: 14, duration: 0.75, easeLinearity: 0.2 });
      } else if (pts.length === 1) {
        map.flyTo(pts[0], 14, { duration: 0.55, easeLinearity: 0.25 });
      }
    };

    map.whenReady(() => {
      setTimeout(run, 0);
    });
  }, [mapBuildings, panelBuildings, selectedBuildingId]);

  useEffect(() => {
    markerByIdRef.current.forEach((m, id) => {
      const selected = id === selectedBuildingId;
      m.setOpacity(selected ? 1 : 0.88);
      m.setZIndexOffset(selected ? 1200 : 0);
      const el = m.getElement();
      if (el) {
        el.classList.toggle("site-layout-marker--selected", selected);
      }
    });
  }, [selectedBuildingId]);

  if (panelBuildings.length === 0) {
    return (
      <div className="site-layout-global-root site-layout-global-map-shell w-100">
        <div className="site-layout-global-map-inner rounded border border-light border-opacity-10 overflow-hidden shadow-sm w-100">
          <div
            className="site-layout-global-map-leaflet d-flex align-items-center justify-content-center text-white-50 small bg-dark w-100"
          >
            No buildings in this site yet. Add buildings in Engineering → Site Builder.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="site-layout-global-root site-layout-global-map-shell w-100">
      <div className="site-layout-global-map position-relative w-100">
        <div className="site-layout-global-map-inner site-layout-global-map-inner--basemap rounded border border-light border-opacity-10 overflow-hidden shadow-sm position-relative w-100">
          <div
            ref={mapElRef}
            className={`site-layout-global-map-leaflet site-layout-leaflet-map site-layout-leaflet-map--${basemap.provider} w-100`}
          />
          {mapBuildings.length === 0 && (
            <div className="site-layout-map-no-geo-hint text-white-50 small">
              No geocoordinates for these buildings yet. Add lat/lng in Engineering → Site Builder to show map markers.
              You can still open a building from the list.
            </div>
          )}
        </div>

        <SiteLayoutBuildingsPanel
          buildings={filtered}
          allCount={panelBuildings.length}
          search={search}
          onSearchChange={setSearch}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={onSelectBuilding}
          onOpenBuilding={onOpenBuilding}
        />

        <div className="site-layout-global-map-badge d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-info" />
          <span>
            <span className="text-white-50">Global view</span>
            <span className="text-white-50 mx-1">·</span>
            <span className="text-white fw-semibold">{siteDisplayName}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
