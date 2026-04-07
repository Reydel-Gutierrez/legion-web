import React, { useMemo } from "react";
import { useHistory } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faUsers,
  faWifi,
  faDoorOpen,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@themesberg/react-bootstrap";
import { useSite } from "../../../../app/providers/SiteProvider";
import { operatorRepository } from "../../../../lib/data";
import { Routes } from "../../../../routes";
import {
  occupancyZonesFromEquipment,
  networkInsightFromEquipment,
  summarizeUsersForInsight,
} from "../../../../lib/siteBuildingOverviewUtils";

function InsightCard({ icon, children, expanded, className = "" }) {
  return (
    <div
      className={["site-building-insight-card", className].filter(Boolean).join(" ")}
      role="region"
      tabIndex={0}
    >
      <div className="site-building-insight-card__main">
        <div className="site-building-insight-card__icon" aria-hidden>
          <FontAwesomeIcon icon={icon} className="site-building-insight-card__fa" fixedWidth />
        </div>
        <div className="site-building-insight-card__body">{children}</div>
      </div>
      {expanded ? <div className="site-building-insight-card__expand">{expanded}</div> : null}
    </div>
  );
}

export default function SiteBuildingInsightWidgets({ buildingId, buildingEquipment }) {
  const history = useHistory();
  const { site } = useSite();

  const siteUsers = useMemo(() => {
    const list = operatorRepository.getUsers(site);
    if (!site) return list;
    return list.filter((u) => !Array.isArray(u.sites) || u.sites.length === 0 || u.sites.includes(site));
  }, [site]);

  const occ = useMemo(
    () => occupancyZonesFromEquipment(buildingEquipment, buildingId),
    [buildingEquipment, buildingId]
  );

  const net = useMemo(() => networkInsightFromEquipment(buildingEquipment), [buildingEquipment]);

  const userInsight = useMemo(() => summarizeUsersForInsight(siteUsers), [siteUsers]);

  const occPct = occ.total === 0 ? 0 : Math.round((100 * occ.occupiedCount) / occ.total);

  const goSchedules = () => history.push(Routes.LegionSchedules.path);
  const goUsers = () => history.push(Routes.LegionUsers.path);

  const occExpanded = (
    <>
      {occ.zones.length === 0 ? (
        <p className="text-white-50 small mb-2">No equipment rows yet — occupancy will list each asset as a zone.</p>
      ) : (
        <ul className="site-building-insight-card__list" aria-label="Zone occupancy">
          {occ.zones.slice(0, 8).map((z) => (
            <li key={z.id} className="site-building-insight-card__row">
              <span className="site-building-insight-card__row-label text-truncate" title={z.label}>
                {z.label}
              </span>
              <span
                className={[
                  "site-building-insight-card__pill",
                  z.occupied ? "site-building-insight-card__pill--on" : "site-building-insight-card__pill--off",
                ].join(" ")}
              >
                {z.occupied ? "Occupied" : "Vacant"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {occ.zones.length > 8 ? (
        <div className="site-building-insight-card__more text-white-50 small">
          +{occ.zones.length - 8} more zones
        </div>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="site-building-insight-card__cta w-100 mt-2"
        onClick={goSchedules}
      >
        <FontAwesomeIcon icon={faCalendarAlt} className="me-2" />
        Set schedule
      </Button>
    </>
  );

  const netExpanded = (
    <>
      {net.offline > 0 ? (
        <div className="site-building-insight-card__subhead text-white-50 small mb-1">Offline devices</div>
      ) : (
        <div className="site-building-insight-card__subhead text-white-50 small mb-1">All devices responding</div>
      )}
      <ul className="site-building-insight-card__list" aria-label="Offline equipment">
        {net.offlineRows.slice(0, 6).map((r) => (
          <li key={r.id} className="site-building-insight-card__row">
            <span className="site-building-insight-card__row-label text-truncate" title={r.label}>
              {r.label}
            </span>
            <span className="site-building-insight-card__pill site-building-insight-card__pill--danger">Offline</span>
          </li>
        ))}
      </ul>
      {net.offlineRows.length > 6 ? (
        <div className="site-building-insight-card__more text-white-50 small">
          +{net.offlineRows.length - 6} more offline
        </div>
      ) : null}
      {net.onlineByTypeSorted.length > 0 ? (
        <>
          <div className="site-building-insight-card__subhead text-white-50 small mt-2 mb-1">Online by type</div>
          <ul className="site-building-insight-card__list site-building-insight-card__list--compact">
            {net.onlineByTypeSorted.slice(0, 5).map(([type, n]) => (
              <li key={type} className="site-building-insight-card__row site-building-insight-card__row--compact">
                <span className="text-truncate">{type}</span>
                <span className="text-white-50">{n}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );

  const userExpanded = (
    <>
      <div className="site-building-insight-card__subhead text-white-50 small mb-1">Access by role (active)</div>
      <ul className="site-building-insight-card__list" aria-label="Users by role">
        {userInsight.roleOrder.map((role) => (
          <li key={role} className="site-building-insight-card__row site-building-insight-card__row--compact">
            <span className="text-truncate">{role}</span>
            <span className="fw-semibold">{userInsight.byRole[role]}</span>
          </li>
        ))}
      </ul>
      {userInsight.activeCount === 0 ? (
        <div className="text-white-50 small mt-1">No active users for this site.</div>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline-light"
        className="site-building-insight-card__cta site-building-insight-card__cta--outline w-100 mt-2 border-opacity-25"
        onClick={goUsers}
      >
        Manage users
      </Button>
    </>
  );

  return (
    <div className="site-building-insight-bar">
      <InsightCard icon={faDoorOpen} kicker="Occupancy" expanded={occExpanded}>
        <div className="site-building-insight-card__kicker">Occupancy</div>
        {occ.total === 0 ? (
          <>
            <div className="site-building-insight-card__metric">No zones</div>
            <div className="site-building-insight-card__hint text-white-50">Add equipment to track occupancy</div>
          </>
        ) : (
          <>
            <div className="site-building-insight-card__metric">
              <span className="site-building-insight-card__metric-strong">{occ.occupiedCount}</span>
              <span className="site-building-insight-card__metric-sep"> / </span>
              <span>{occ.total}</span>
              <span className="site-building-insight-card__metric-suffix"> zones occupied</span>
            </div>
            <div
              className="site-building-insight-card__meter"
              role="progressbar"
              aria-valuenow={occ.occupiedCount}
              aria-valuemin={0}
              aria-valuemax={occ.total}
              aria-label={`${occPct} percent of zones occupied`}
            >
              <div
                className="site-building-insight-card__meter-fill"
                style={{ width: `${occPct}%` }}
              />
            </div>
            <div className="site-building-insight-card__hint text-white-50">{occPct}% utilization</div>
          </>
        )}
      </InsightCard>

      <InsightCard icon={faWifi} kicker="Network" expanded={netExpanded}>
        <div className="site-building-insight-card__kicker">Network</div>
        {net.total === 0 ? (
          <>
            <div className="site-building-insight-card__metric">No devices</div>
            <div className="site-building-insight-card__hint text-white-50">Deploy equipment to see comms health</div>
          </>
        ) : (
          <>
            <div className="site-building-insight-card__metric site-building-insight-card__metric--split">
              <span className="site-building-insight-card__metric-strong site-building-insight-card__metric--ok">
                {net.live} online
              </span>
              <span className="site-building-insight-card__metric-sep mx-1">·</span>
              <span
                className={
                  net.offline > 0
                    ? "site-building-insight-card__metric-strong site-building-insight-card__metric--bad"
                    : "text-white-50"
                }
              >
                {net.offline} offline
              </span>
            </div>
            <div className="site-building-insight-card__dual-meter">
              {net.offline === 0 ? (
                <div className="site-building-insight-card__dual-meter-seg site-building-insight-card__dual-meter-seg--ok site-building-insight-card__dual-meter-seg--full" />
              ) : (
                <>
                  <div
                    className="site-building-insight-card__dual-meter-seg site-building-insight-card__dual-meter-seg--ok"
                    style={{ flex: net.live }}
                  />
                  <div
                    className="site-building-insight-card__dual-meter-seg site-building-insight-card__dual-meter-seg--bad"
                    style={{ flex: net.offline }}
                  />
                </>
              )}
            </div>
            <div className="site-building-insight-card__hint text-white-50">
              {net.livePct}% on network
            </div>
          </>
        )}
      </InsightCard>

      <InsightCard icon={faUsers} kicker="Users" expanded={userExpanded}>
        <div className="site-building-insight-card__kicker">User access</div>
        <div className="site-building-insight-card__metric">
          <span className="site-building-insight-card__metric-strong">{userInsight.activeCount}</span>
          <span className="site-building-insight-card__metric-suffix"> active user{userInsight.activeCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="site-building-insight-card__hint text-white-50">
          {userInsight.total} account{userInsight.total !== 1 ? "s" : ""} with access · hover for roles
        </div>
      </InsightCard>
    </div>
  );
}
