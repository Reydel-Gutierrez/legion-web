import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faChevronRight, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import FacilityKindIcon from "../../../components/legion/FacilityKindIcon";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import {
  countFacilityBuildings,
  countFacilityEquipment,
  countFacilityFloors,
  findFacilityNode,
} from "../../../lib/operator/facilityTree";
import NodeEditorPanel from "../site-builder/components/NodeEditorPanel";
import { useEngineeringSiteTree } from "./EngineeringSiteTreeContext";

/** Mirrors Operator's SiteWorkspace (same header/card structure) for the selected Site node — no live status/alarms, sourced from the Engineering working state instead of a release. */
export default function EngineeringSiteWorkspace() {
  const {
    siteTree,
    facilityTree,
    selectedNode,
    workingState,
    breadcrumb,
    floors,
    handleSelectNode,
    handleSaveNode,
    handleDeleteNode,
    handleDeleteConfirm,
  } = useEngineeringSiteTree();
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => setEditing(false), [selectedNode?.id]);

  const facilityNode = findFacilityNode(facilityTree, selectedNode?.id) || facilityTree;
  const graphic = workingState.siteLayoutGraphics?.[selectedNode?.id] || null;
  const imageUrl = graphic?.backgroundImage?.dataUrl || null;
  const buildingCount = countFacilityBuildings(facilityNode);
  const floorCount = countFacilityFloors(facilityNode);
  const deviceCount = countFacilityEquipment(facilityNode);
  const buildings = (facilityNode?.children || []).filter((c) => c.kind === "building");
  const description = (selectedNode?.description || "").trim();

  const goToBuilding = (buildingFacilityNode) => {
    const realNode = (siteTree?.children || []).find((b) => String(b.id) === String(buildingFacilityNode.id));
    handleSelectNode(realNode || buildingFacilityNode);
  };

  return (
    <div className={`site-workspace${expandedId ? ` is-expanded-${expandedId}` : ""}`}>
      <header className="equipment-header">
        <div className="equipment-header__row">
          <span className="equipment-header__icon" aria-hidden="true">
            <FacilityKindIcon kind="site" />
          </span>
          <div>
            <div className="equipment-header__title-row">
              <h1 className="workspace-header__title">{selectedNode?.name || "Site"}</h1>
            </div>
            <p className="workspace-header__meta">
              {buildingCount} Building{buildingCount === 1 ? "" : "s"}
              <span className="workspace-header__dot">|</span>
              {floorCount} Floor{floorCount === 1 ? "" : "s"}
              <span className="workspace-header__dot">|</span>
              {deviceCount} Device{deviceCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </header>

      <div className="site-workspace__grid">
        <ExpandableWorkspaceCard
          title="Site Overview"
          cardId="overview"
          expandedId={expandedId}
          onToggleExpand={setExpandedId}
          className="site-overview-card"
          headerExtra={
            <button type="button" className="operator-text-link" onClick={() => setEditing((v) => !v)}>
              {editing ? "Done" : "Edit"}
            </button>
          }
        >
          {editing ? (
            <div className="engineering-light-form">
              <NodeEditorPanel
                node={selectedNode}
                breadcrumb={breadcrumb}
                floors={floors}
                onSave={(id, form) => {
                  handleSaveNode(id, form);
                  setEditing(false);
                }}
                onDelete={handleDeleteNode}
                onDeleteConfirm={handleDeleteConfirm}
              />
            </div>
          ) : (
            <div className="site-overview">
              <div className="site-overview__image">
                {imageUrl ? (
                  <img src={imageUrl} alt="" />
                ) : (
                  <div className="site-overview__image-empty">
                    No site graphic assigned. Select Site in Graphics Manager to add one.
                  </div>
                )}
              </div>
              <div className="site-overview__stats">
                <div className="site-overview__stat">
                  <FontAwesomeIcon icon={faBuilding} className="site-overview__stat-icon" />
                  <div className="site-overview__stat-copy">
                    <span className="site-overview__stat-label">Buildings</span>
                    <span className="site-overview__stat-value">{buildingCount}</span>
                  </div>
                </div>
                <div className="site-overview__stat">
                  <FontAwesomeIcon icon={faLayerGroup} className="site-overview__stat-icon" />
                  <div className="site-overview__stat-copy">
                    <span className="site-overview__stat-label">Floors</span>
                    <span className="site-overview__stat-value">{floorCount}</span>
                  </div>
                </div>
                <div className="site-overview__stat">
                  <FacilityKindIcon kind="equipment" className="site-overview__stat-icon" />
                  <div className="site-overview__stat-copy">
                    <span className="site-overview__stat-label">Devices</span>
                    <span className="site-overview__stat-value">{deviceCount}</span>
                  </div>
                </div>
              </div>
              <div className="site-overview__desc">
                <div className="site-overview__fact-label">Description</div>
                <p>{description || "—"}</p>
              </div>
            </div>
          )}
        </ExpandableWorkspaceCard>

        <ExpandableWorkspaceCard title="Building(s)" cardId="buildings" expandedId={expandedId} onToggleExpand={setExpandedId}>
          {buildings.length === 0 ? (
            <div className="operator-empty-graphic">No buildings in this site.</div>
          ) : (
            <table className="site-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Floors</th>
                  <th>Devices</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <button type="button" className="site-table__link" onClick={() => goToBuilding(b)}>
                        {b.label}
                      </button>
                    </td>
                    <td>{countFacilityFloors(b)}</td>
                    <td>{countFacilityEquipment(b)}</td>
                    <td>
                      <button
                        type="button"
                        className="site-table__go"
                        aria-label={`Open ${b.label}`}
                        onClick={() => goToBuilding(b)}
                      >
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ExpandableWorkspaceCard>

        <ExpandableWorkspaceCard title="Recent Activity" cardId="activity" expandedId={expandedId} onToggleExpand={setExpandedId}>
          <div className="operator-empty-graphic">No recent activity for this site.</div>
        </ExpandableWorkspaceCard>
      </div>
    </div>
  );
}
