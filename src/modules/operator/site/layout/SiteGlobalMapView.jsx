import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { siteLayoutRepository } from "../../../../lib/data";
import {
  createLeafletBasemapTileLayer,
  getLeafletBasemapConfig,
} from "../../../../lib/siteLayout/leafletBasemapConfig";
import { formatBuildingHeroTitle } from "../../../../lib/siteBuildingOverviewUtils";
import SiteQuickNavigation from "./SiteQuickNavigation";

const MAP_POPUP_BLDG_SVG = `<svg class="site-layout-map-popup__bldg-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm48 64h32V224H112V96zm64 0h32V320h-32V96zm64 0h32V192h-32V96zm64 0h32V256h-32V96z"/></svg>`;
const MAP_POPUP_CTA_GRID = `<span class="site-layout-map-popup__cta-grid" aria-hidden="true"><span></span><span></span><span></span><span></span></span>`;

function buildMapMarkerPopupHtml(b) {
  const title = escapeHtml(formatBuildingHeroTitle(b.name || "Building"));
  const typeLine = escapeHtml(b.buildingType && String(b.buildingType).trim() ? b.buildingType : "Building");
  const address = escapeHtml(b.addressLine || "—");
  const fc = Number(b.floorCount) || 0;
  const meta =
    fc === 0
      ? "No floors yet — add floors in Site Builder"
      : `${fc} floor${fc !== 1 ? "s" : ""} · Open to plan & monitor`;
  const metaEsc = escapeHtml(meta);
  const idEsc = escapeHtml(b.id);
  return `
    <div class="site-layout-map-popup">
      <div class="site-layout-map-popup__accent" aria-hidden="true"></div>
      <div class="site-layout-map-popup__main">
        <div class="site-layout-map-popup__top">
          <span class="site-layout-map-popup__icon-wrap" aria-hidden="true">${MAP_POPUP_BLDG_SVG}</span>
          <div class="site-layout-map-popup__copy">
            <div class="site-layout-map-popup__title">${title}</div>
            <div class="site-layout-map-popup__type">${typeLine}</div>
            <div class="site-layout-map-popup__address">${address}</div>
            <div class="site-layout-map-popup__meta">${metaEsc}</div>
          </div>
        </div>
        <div class="site-layout-map-popup__badge-row">
          <span class="site-layout-map-popup__badge badge rounded-pill ${statusClass(b.status)}">${statusLabel(b.status)}</span>
        </div>
        <button type="button" class="site-layout-map-popup__cta site-layout-open-building" data-building-id="${idEsc}">
          ${MAP_POPUP_CTA_GRID}
          <span class="site-layout-map-popup__cta-label">Open building</span>
        </button>
      </div>
    </div>
  `;
}

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
  activeReleaseData,
  siteDisplayName,
  selectedBuildingId,
  onSelectBuilding,
  onOpenBuilding,
}) {
  const releaseSiteId =
    activeReleaseData && activeReleaseData.site && activeReleaseData.site.id ? activeReleaseData.site.id : null;

  /** Stable when deployment data is unchanged — avoids Leaflet init loop when parent passes new object refs each render. */
  const activeLayoutFingerprint = useMemo(() => {
    const site = activeReleaseData?.site;
    if (!site?.buildings?.length) return `${releaseSiteId ?? ""}:empty`;
    return JSON.stringify(
      site.buildings.map((b) => ({
        id: b.id,
        lat: b.lat ?? null,
        lng: b.lng ?? null,
        name: b.name,
        status: b.status,
      }))
    );
  }, [activeReleaseData, releaseSiteId]);

  const panelBuildings = useMemo(
    () => siteLayoutRepository.getSiteLayoutBuildingsList(activeReleaseData),
    // Intentionally fingerprint only — avoids rebuilding when parent passes a new deployment object ref with identical site data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeLayoutFingerprint]
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

  // Map + markers: runs when layout fingerprint changes (not on every parent re-render).
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
      const html = buildMapMarkerPopupHtml(b);
      m.bindPopup(html, {
        minWidth: 280,
        maxWidth: 340,
        className: "site-layout-popup--legion",
        closeButton: true,
      });
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
  }, [activeLayoutFingerprint, releaseSiteId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [activeLayoutFingerprint, selectedBuildingId]); // eslint-disable-line react-hooks/exhaustive-deps

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

        <SiteQuickNavigation
          variant="map"
          activeReleaseData={activeReleaseData}
          selectedBuildingId={selectedBuildingId}
          onOpenBuilding={onOpenBuilding}
          siteDisplayName={siteDisplayName}
          buildings={filtered}
          allBuildingsCount={panelBuildings.length}
          search={search}
          onSearchChange={setSearch}
          onSelectBuilding={onSelectBuilding}
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
