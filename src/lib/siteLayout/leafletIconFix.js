/**
 * CRA/webpack bundles break Leaflet's default marker image paths; merge explicit asset URLs once at startup.
 */
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

let applied = false;

export function ensureLeafletDefaultIcons() {
  if (applied) return;
  applied = true;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
}
