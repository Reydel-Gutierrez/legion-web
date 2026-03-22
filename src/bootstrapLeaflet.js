/**
 * Leaflet CSS + default marker URLs (webpack-safe). Single side-effect module; keep index.js import/first clean.
 */
import "leaflet/dist/leaflet.css";
import { ensureLeafletDefaultIcons } from "./lib/siteLayout/leafletIconFix";

ensureLeafletDefaultIcons();
