/**
 * Shared graphic canvas / import limits for Engineering + Operator.
 * Layout graphics (site / building / floor) use a wide HD workspace; equipment graphics keep legacy dimensions.
 */

/** Default engineering canvas for equipment diagrams (unchanged). */
export const EQUIPMENT_GRAPHIC_CANVAS_DEFAULT = { width: 800, height: 800 };

/** Default engineering canvas for site / building / floor layout graphics — floorplan-style workspace. */
export const LAYOUT_GRAPHIC_CANVAS_DEFAULT = { width: 1920, height: 1080 };

/**
 * Max raster size when importing a background image for layout graphics (before base64).
 * Must stay small enough that persisted working versions (JSON + base64) fit in localStorage (~5MB per origin).
 * Matches the default layout canvas so imports align with the authoring surface.
 */
export const LAYOUT_BACKGROUND_IMPORT_MAX = { width: 1920, height: 1080 };
