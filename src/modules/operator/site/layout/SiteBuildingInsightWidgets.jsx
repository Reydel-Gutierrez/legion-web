import React, { useMemo } from "react";
import { useHistory } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faWifi,
  faDoorOpen,
  faChevronRight,
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

function MetricCell({ icon, label, children, footer, action }) {
  return (
    <div className="site-building-metric" role="region" aria-label={label}>
      <div className="site-building-metric__head">
        <FontAwesomeIcon icon={icon} className="site-building-metric__icon" fixedWidth aria-hidden />
        <span className="site-building-metric__label">{label}</span>
      </div>
      <div className="site-building-metric__body">{children}</div>
      {footer ? <div className="site-building-metric__footer">{footer}</div> : null}
      {action ? <div className="site-building-metric__action">{action}</div> : null}
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

  return (
    <footer className="site-building-view__footer" aria-label="Building insights">
      <div className="site-building-metrics">
        <MetricCell
          icon={faDoorOpen}
          label="Occupancy"
          footer={
            occ.total > 0 ? (
              <span className="site-building-metric__hint">{occPct}% utilization</span>
            ) : null
          }
          action={
            <Button
              type="button"
              size="sm"
              variant="link"
              className="site-building-metric__link p-0"
              onClick={goSchedules}
            >
              Set schedule
              <FontAwesomeIcon icon={faChevronRight} className="ms-1" />
            </Button>
          }
        >
          {occ.total === 0 ? (
            <>
              <div className="site-building-metric__value">No zones</div>
              <div className="site-building-metric__hint">Add equipment to track occupancy</div>
            </>
          ) : (
            <>
              <div className="site-building-metric__value">
                <span className="site-building-metric__value-strong">{occ.occupiedCount}</span>
                <span className="site-building-metric__value-sep"> / </span>
                <span>{occ.total}</span>
                <span className="site-building-metric__value-suffix"> zones occupied</span>
              </div>
              <div
                className="site-building-metric__meter"
                role="progressbar"
                aria-valuenow={occ.occupiedCount}
                aria-valuemin={0}
                aria-valuemax={occ.total}
                aria-label={`${occPct} percent of zones occupied`}
              >
                <div className="site-building-metric__meter-fill" style={{ width: `${occPct}%` }} />
              </div>
            </>
          )}
        </MetricCell>

        <MetricCell
          icon={faWifi}
          label="Network"
          footer={net.total > 0 ? <span className="site-building-metric__hint">{net.livePct}% on network</span> : null}
        >
          {net.total === 0 ? (
            <>
              <div className="site-building-metric__value">No devices</div>
              <div className="site-building-metric__hint">Deploy equipment to see comms health</div>
            </>
          ) : (
            <>
              <div className="site-building-metric__value site-building-metric__value--split">
                <span className="site-building-metric__value-strong site-building-metric__value--ok">
                  {net.live} online
                </span>
                <span className="site-building-metric__value-sep mx-1">·</span>
                <span
                  className={
                    net.offline > 0
                      ? "site-building-metric__value-strong site-building-metric__value--bad"
                      : "site-building-metric__hint"
                  }
                >
                  {net.offline} offline
                </span>
              </div>
              <div className="site-building-metric__dual-meter">
                {net.offline === 0 ? (
                  <div className="site-building-metric__dual-meter-seg site-building-metric__dual-meter-seg--ok site-building-metric__dual-meter-seg--full" />
                ) : (
                  <>
                    <div
                      className="site-building-metric__dual-meter-seg site-building-metric__dual-meter-seg--ok"
                      style={{ flex: net.live }}
                    />
                    <div
                      className="site-building-metric__dual-meter-seg site-building-metric__dual-meter-seg--bad"
                      style={{ flex: net.offline }}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </MetricCell>

        <MetricCell
          icon={faUsers}
          label="User access"
          footer={
            <span className="site-building-metric__hint">
              {userInsight.total} account{userInsight.total !== 1 ? "s" : ""} with access
            </span>
          }
          action={
            <Button
              type="button"
              size="sm"
              variant="link"
              className="site-building-metric__link p-0"
              onClick={goUsers}
            >
              Manage users
              <FontAwesomeIcon icon={faChevronRight} className="ms-1" />
            </Button>
          }
        >
          <div className="site-building-metric__value">
            <span className="site-building-metric__value-strong">{userInsight.activeCount}</span>
            <span className="site-building-metric__value-suffix">
              {" "}
              active user{userInsight.activeCount !== 1 ? "s" : ""}
            </span>
          </div>
        </MetricCell>
      </div>
    </footer>
  );
}
