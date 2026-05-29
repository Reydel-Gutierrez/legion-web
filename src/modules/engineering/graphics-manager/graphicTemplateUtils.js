/**
 * Helpers for graphic templates (Template Library ↔ Graphics Manager).
 */

export function countBoundTemplatePointBindings(objects) {
  if (!Array.isArray(objects)) return 0;
  let n = 0;
  for (const obj of objects) {
    for (const b of obj.bindings || []) {
      if (b.pointId) n += 1;
    }
  }
  return n;
}

/** Pixel offset applied when duplicating or pasting canvas objects. */
export const GRAPHIC_OBJECT_CLONE_OFFSET = 12;

/** Deep-clone a canvas object (shape, text, value, link) including zoneConfig. */
export function cloneGraphicCanvasObject(obj, overrides = {}) {
  if (!obj) return null;
  const clone = JSON.parse(JSON.stringify(obj));
  return { ...clone, ...overrides };
}

export function cloneGraphicEditorState(graphic) {
  if (!graphic) {
    return { objects: [], canvasSize: { width: 800, height: 800 }, backgroundImage: undefined };
  }
  return {
    objects: JSON.parse(JSON.stringify(graphic.objects || [])),
    canvasSize: graphic.canvasSize || { width: 800, height: 800 },
    backgroundImage: graphic.backgroundImage
      ? JSON.parse(JSON.stringify(graphic.backgroundImage))
      : undefined,
  };
}

export function generateGraphicTemplateId() {
  return `site-gfx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
