import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faChevronRight, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import FacilityKindIcon from "../../../components/legion/FacilityKindIcon";
import { operatorRepository } from "../../../lib/data";
import { loadPersistedLogs } from "../../../lib/app-activity/logStorage";
import { LOG_CATEGORY } from "../../../lib/app-activity/types";
import {
  countFacilityBuildings,
  countFacilityEquipment,
  countFacilityFloors,
} from "../../../lib/operator/facilityTree";
import { collectSiteRecentActivity } from "../../../lib/operator/siteRecentActivity";
import { formatOverviewTimestamp } from "../../../lib/operator/equipmentDetails";
import { useSiteRuntimeStatus } from "../../../hooks/useSiteRuntimeStatus";
import StatusIndicator from "../../../components/legion/StatusIndicator";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import OperatorBreadcrumbs from "./OperatorBreadcrumbs";

function overviewStatusLabel(siteStatus) {
  if (siteStatus === "LIVE") return "Online";
  if (siteStatus === "STALE") return "Stale";
  if (siteStatus === "OFFLINE") return "Offline";
  return "Unknown";
}

function siteGraphicImage(graphic) {
  return graphic?.backgroundImage?.dataUrl || null;
}

export default function SiteWorkspace({
  releaseData,
  tree,
  selectedNode,
  siteKey,
  onSelectNode,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const { siteStatus, lastSeenAt } = useSiteRuntimeStatus();
  const graphic = (releaseData?.siteLayoutGraphics || {})[selectedNode?.id];
  const imageUrl = siteGraphicImage(graphic);
  const buildings = (selectedNode?.children || []).filter((c) => c.kind === "building");
  const buildingCount = countFacilityBuildings(selectedNode);
  const floorCount = countFacilityFloors(selectedNode);
  const deviceCount = countFacilityEquipment(selectedNode);
  const description = (releaseData?.site?.description || "").trim();
  const lastUpdated =
    lastSeenAt || releaseData?.lastDeployedAt || releaseData?.site?.updatedAt || null;
  const statusLabel = overviewStatusLabel(siteStatus);

  useEffect(() => {
    let cancelled = false;
    operatorRepository
      .fetchAlarmsForSite(siteKey)
      .then((list) => {
        if (!cancelled) setAlarms(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setAlarms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  const activity = useMemo(() => {
    const events = operatorRepository.getEvents(siteKey) || [];
    const logs = (loadPersistedLogs() || []).filter((e) => e && e.category !== LOG_CATEGORY.API);
    return collectSiteRecentActivity({ events, alarms, logs, tree });
  }, [siteKey, alarms, tree]);

  return (
    <div className={`site-workspace${expandedId ? ` is-expanded-${expandedId}` : ""}`}>
      <OperatorBreadcrumbs tree={tree} selectedNode={selectedNode} />
      <header className="equipment-header">
        <div className="equipment-header__row">
          <span className="equipment-header__icon" aria-hidden="true">
            <FacilityKindIcon kind="site" />
          </span>
          <div>
            <div className="equipment-header__title-row">
              <h1 className="workspace-header__title">{selectedNode?.label || "Site"}</h1>
              <StatusIndicator status={siteStatus} label={statusLabel} />
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
        >
          <div className="site-overview">
            <div className="site-overview__image">
              {imageUrl ? (
                <img src={imageUrl} alt="" />
              ) : (
                <div className="site-overview__image-empty">
                  No deployed site graphic. Select Site in Engineering → Graphics Manager and import
                  an image, then deploy.
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
            <div className="site-overview__facts">
              <div className="site-overview__fact">
                <div className="site-overview__fact-label">Site Status</div>
                <StatusIndicator status={siteStatus} label={statusLabel} className="site-overview__status" />
              </div>
              <div className="site-overview__fact">
                <div className="site-overview__fact-label">Last Updated</div>
                <div className="site-overview__fact-value">{formatOverviewTimestamp(lastUpdated)}</div>
              </div>
            </div>
            <div className="site-overview__desc">
              <div className="site-overview__fact-label">Description</div>
              <p>{description || "—"}</p>
            </div>
          </div>
        </ExpandableWorkspaceCard>

        <ExpandableWorkspaceCard
          title="Building(s)"
          cardId="buildings"
          expandedId={expandedId}
          onToggleExpand={setExpandedId}
        >
          {buildings.length === 0 ? (
            <div className="operator-empty-graphic">No buildings in this site.</div>
          ) : (
            <table className="site-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Floors</th>
                  <th>Devices</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <button type="button" className="site-table__link" onClick={() => onSelectNode(b)}>
                        {b.label}
                      </button>
                    </td>
                    <td>{countFacilityFloors(b)}</td>
                    <td>{countFacilityEquipment(b)}</td>
                    <td>{b.status || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="site-table__go"
                        aria-label={`Open ${b.label}`}
                        onClick={() => onSelectNode(b)}
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

        <ExpandableWorkspaceCard
          title="Recent Activity"
          cardId="activity"
          expandedId={expandedId}
          onToggleExpand={setExpandedId}
        >
          {activity.length === 0 ? (
            <div className="operator-empty-graphic">No recent activity for this site.</div>
          ) : (
            <table className="site-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Object</th>
                  <th>Message</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.id}>
                    <td>{row.time}</td>
                    <td>{row.object}</td>
                    <td>{row.message}</td>
                    <td>
                      {row.node ? (
                        <button
                          type="button"
                          className="site-table__go"
                          aria-label={`Open ${row.object}`}
                          onClick={() => onSelectNode(row.node)}
                        >
                          <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ExpandableWorkspaceCard>
      </div>
    </div>
  );
}
