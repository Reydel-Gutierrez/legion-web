import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faFileAlt } from "@fortawesome/free-solid-svg-icons";
import { Routes } from "../../../routes";
import { accessRepository } from "../../../lib/data";
import NOTIFICATIONS_DATA from "../../../lib/data/notifications";
import { useSiteRuntimeStatus } from "../../../hooks/useSiteRuntimeStatus";
import StatusIndicator from "../../../components/legion/StatusIndicator";
import OperatorAlarmBell from "../../../components/legion/OperatorAlarmBell";
import DashboardModeSelector from "./DashboardModeSelector";
import OperatorGlobalSearch from "./OperatorGlobalSearch";

function initialsFromName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "LC";
}

export default function OperatorTopBar({
  currentUser,
  dashboardMode,
  onDashboardModeChange,
  tree,
  releaseData,
  hasActiveAlarms = false,
}) {
  const navigate = useNavigate();
  const { siteStatus, siteStatusLabel, lastSyncLabel } = useSiteRuntimeStatus();
  const [notifications, setNotifications] = useState(NOTIFICATIONS_DATA);
  const [userOpen, setUserOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const user = currentUser || (() => {
    try {
      return accessRepository.getCurrentUserForAccess();
    } catch {
      return { fullName: "Operator", roleName: "Operator" };
    }
  })();

  return (
    <header className="operator-topbar">
      <DashboardModeSelector
        currentUser={user}
        value={dashboardMode}
        onChange={onDashboardModeChange}
      />

      <OperatorGlobalSearch tree={tree} releaseData={releaseData} />

      <div className="operator-topbar__right">
        <StatusIndicator status={siteStatus} label={siteStatusLabel} />
        <span className="operator-topbar__sep" aria-hidden="true" />
        <span className="operator-topbar__sync">
          Last Sync: {lastSyncLabel || "—"}
        </span>
        <span className="operator-topbar__sep" aria-hidden="true" />
        <button
          type="button"
          className="operator-topbar__text-btn"
          onClick={() => navigate(Routes.LegionEvents.path)}
        >
          <FontAwesomeIcon icon={faFileAlt} />
          Logs
        </button>
        <div className="operator-topbar__menu-wrap">
          <button
            type="button"
            className="operator-topbar__icon-btn"
            aria-label="Notifications"
            onClick={() => {
              setBellOpen((v) => !v);
              setUserOpen(false);
            }}
          >
            <OperatorAlarmBell active={hasActiveAlarms} />
          </button>
          {bellOpen ? (
            <div className="operator-menu operator-menu--notifications">
              <div className="operator-menu__header">
                <strong>Notifications</strong>
                <button
                  type="button"
                  className="operator-menu__linkish"
                  onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                >
                  Mark all read
                </button>
              </div>
              {notifications.slice(0, 6).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`operator-menu__item${n.read ? "" : " is-unread"}`}
                  onClick={() => navigate(Routes.LegionAlarms.path)}
                >
                  <span className="operator-menu__item-title">{n.sender}</span>
                  <span className="operator-menu__item-body">{n.message}</span>
                </button>
              ))}
              <button
                type="button"
                className="operator-menu__footer"
                onClick={() => {
                  setBellOpen(false);
                  navigate(Routes.LegionAlarms.path);
                }}
              >
                View alarms
              </button>
            </div>
          ) : null}
        </div>

        <div className="operator-topbar__menu-wrap">
          <button
            type="button"
            className="operator-user"
            onClick={() => {
              setUserOpen((v) => !v);
              setBellOpen(false);
            }}
          >
            <span className="operator-user__avatar">{initialsFromName(user.fullName)}</span>
            <span className="operator-user__meta">
              <span className="operator-user__name">{user.fullName || "Operator"}</span>
              <span className="operator-user__role">{user.roleName || "Operator"}</span>
            </span>
            <FontAwesomeIcon icon={faChevronDown} className="operator-user__chevron" />
          </button>
          {userOpen ? (
            <div className="operator-menu">
              <Link className="operator-menu__item" to={Routes.LegionUsers.path} onClick={() => setUserOpen(false)}>
                My Profile
              </Link>
              <Link className="operator-menu__item" to={Routes.LegionSettings.path} onClick={() => setUserOpen(false)}>
                Settings
              </Link>
              <button
                type="button"
                className="operator-menu__item operator-menu__item--danger"
                onClick={() => navigate("/login")}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
