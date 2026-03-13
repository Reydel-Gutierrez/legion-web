# GRAPHICS / DRAFT / DEPLOY PASS SUMMARY

## Sites/drafts persistence changes

- **New module** `src/lib/data/persistence/draftPersistence.js`: load/save drafts and deployed snapshots by site name to `localStorage` (`legion_site_drafts`, `legion_site_deployments`). Backend-ready shapes.
- **EngineeringDraftProvider** loads draft on site change: built-in sites (Miami HQ, New Site) use seed or stored draft; custom sites load from persistence or start empty. Draft is persisted (debounced 500 ms) on change; when `draft.site.name` is set, draft is also saved under that name so switching to the named site restores it.
- **Deployments** are persisted on deploy and hydrated on app load so custom deployed sites survive refresh.

## Graphics manager changes

- **Points without discovery**: `getPointDisplayInfoForEquipment(equipment, draftTemplates)` now accepts optional `draftTemplates`; template points can come from global `TEMPLATE_POINTS` or from `draft.templates.equipmentTemplates` (template name/id match). Graphics Manager passes `draft?.templates` so template-only sites get bindable points.
- **Header UX**: Site name and Draft vs Deployed badge (e.g. “Deployed v12” or “Draft”) shown next to the Graphics Manager title.
- **Empty state**: “Select a site to get started” when no site; “Add equipment in Site Builder first” when site has no equipment. No “discover devices first” requirement.

## Logical point binding model changes

- **Binding target**: Graphics bind to **logical/template point id** (e.g. `tp-vav-1`), not only to discovered BACnet object ids. `getPointDisplayInfoForEquipment` returns points from equipment template (with optional draft templates fallback); value state can be `template_only`, `unmapped`, `mapped`, or `offline`.
- **Contracts** (`src/lib/data/contracts.js`): Added JSDoc types `LogicalPoint`, `GraphicBinding`, `DeployedSiteVersion` for clarity and future API alignment.
- **Operator workspace**: Points are derived from the **deployed snapshot** (equipment + templates → logical points). Values come from mapped BACnet when present; otherwise placeholder and status `"Unbound"`.

## Deployment behavior changes

- **No discovery required**: Deployment uses `buildFullDeploymentSnapshot(draft)` (site, equipment, templates, mappings, graphics). No dependency on discovered devices.
- **Persist on deploy**: Deployed snapshot is saved to localStorage and to in-memory `activeDeploymentBySite[site]`. Operator and workspace point resolution use this snapshot.
- **Draft after deploy**: Editing the draft does not change the live operator view until the next deploy.

## Operator-side behavior changes

- **Data source**: Operator reads from **deployed snapshot only** (`useActiveDeployment()` → `activeDeploymentBySite[site]`). Equipment tree from `activeDeploymentToEquipmentTree(activeDeployment)`; workspace points from `getWorkspaceRowsFromDeployment(activeDeployment, equipmentId, equipmentName)` when `activeDeployment` is passed.
- **Workspace points**: `operatorRepository.getWorkspacePointsForEquipment(..., options)` accepts `options.activeDeployment`. When set, `getWorkspaceRowsFromDeployment` builds rows from deployed equipment + templates; unmapped points get placeholder value and status `"Unbound"`.
- **Site list**: In operator mode, the site dropdown shows **only deployed sites** (sites with non-null `activeDeploymentBySite[site]`). Undeployed draft-only sites do not appear as live options.

## Persistence mechanism used

- **localStorage** keys: `legion_site_drafts` (object keyed by site name → full draft state), `legion_site_deployments` (object keyed by site name → full deployment snapshot).
- **Hydration**: On load, `getInitialActiveDeployments()` merges stored deployments; provider loads draft from storage when site changes. No backend calls; shapes are suitable for a future REST/API layer.

## Use cases covered

1. **Template-only site**: Create site → add floors/equipment/templates → no discovery → open Graphics Manager → bind to template points → save graphic → deploy → operator sees site, equipment, graphics, points (Unbound where no live source).
2. **Site later gets discovery**: Graphics already bound to logical points; when mappings are added, values resolve to live without recreating graphics.
3. **Partial device reality**: Mix of mapped and template-only equipment; Graphics Manager and operator support both; status reflects Unbound vs OK.
4. **Draft persistence across site switch**: Create Site A, add equipment/graphics, save (auto-persisted) → switch to Site B → return to Site A → draft restored from storage.
5. **Deploy without devices**: Deploy with valid structure, equipment, templates, graphics; operator sees deployed site with Unbound point placeholders.
6. **Refresh**: Draft and deployed state persist in localStorage and are restored on reload.

## Files/modules updated

- `src/lib/data/persistence/draftPersistence.js` (new)
- `src/app/providers/EngineeringDraftProvider.jsx`
- `src/app/layout/Sidebar.js`
- `src/modules/engineering/data/mockPointMappingData.js` (`getTemplatePoints`, `getMappingsForEquipment`, `getPointDisplayInfoForEquipment`)
- `src/modules/engineering/graphics-manager/GraphicsManagerPage.jsx`
- `src/lib/activeDeploymentUtils.js` (`getLogicalPointsForEquipmentFromDeployment`, `getWorkspaceRowsFromDeployment`, `BINDING_STATUS`)
- `src/lib/data/adapters/mock/operatorAdapter.js` (`getWorkspacePointsForEquipmentMock` with `options.activeDeployment`)
- `src/lib/data/repositories/operatorRepository.js` (`getWorkspacePointsForEquipment` options param)
- `src/modules/operator/equipment/EquipmentPage.jsx` (pass `activeDeployment` into `WorkspacePanel` and into `getWorkspacePointsForEquipment`)
- `src/lib/data/contracts.js` (LogicalPoint, GraphicBinding, DeployedSiteVersion)

## Remaining limitations

- **Validation**: Validation center may still report “errors” for unmapped required points on template-only sites; “Deploy Anyway” is required to deploy in that case. No change to validation rules in this pass.
- **Operator graphics view**: Operator equipment page shows workspace points from deployment; a dedicated operator “Graphics” view that renders deployed graphics and resolves bindings to logical points with Unbound/live values is not implemented in this pass (graphics data is in the snapshot and can be consumed by such a view).
- **Single browser**: Persistence is localStorage only; no multi-device or server sync.

## Suggested next step

- Add an **operator-facing Graphics view** that loads deployed graphics from `activeDeployment.graphics`, renders equipment graphics, and resolves each binding to the deployed logical point (value/status from same runtime/placeholder logic as workspace points). Then run through scenarios 1–5 in the spec (create site → no discovery → graphics → deploy → operator sees graphics and Unbound/live values).

---

**Product rule**: A Legion site is a logical engineering model first. Physical discovery improves runtime data but is not required to design, save, deploy, or operate the site structure and graphics.
