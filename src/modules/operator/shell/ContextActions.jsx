import React, { useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faCog } from "@fortawesome/free-solid-svg-icons";
import { Routes } from "../../../routes";
import { canCommandPoints, canConfigureAlarms } from "../../../lib/access/operatorPermissions";

export default function ContextActions({ selectedNode, currentUser, onRefresh, onCommandPoints }) {
  const history = useHistory();
  const [open, setOpen] = useState(false);
  const kind = selectedNode?.kind || "site";
  const canCommand = canCommandPoints(currentUser);
  const canAlarm = canConfigureAlarms(currentUser);

  const items = useMemo(() => {
    const list = [];
    if (kind === "equipment") {
      if (canCommand) list.push({ id: "command", label: "Command points" });
      if (canAlarm) list.push({ id: "alarm", label: "Configure alarm" });
      list.push({ id: "trends", label: "View trends" });
      list.push({ id: "schedules", label: "Schedules" });
      list.push({ id: "workspace", label: "Point workspace" });
      list.push({ id: "alarms", label: "Alarms" });
      list.push({ id: "refresh", label: "Refresh" });
    } else if (kind === "floor") {
      list.push({ id: "alarms", label: "Floor alarms" });
      list.push({ id: "trends", label: "Trends" });
      list.push({ id: "schedules", label: "Schedules" });
      list.push({ id: "workspace", label: "Point workspace" });
      list.push({ id: "refresh", label: "Refresh" });
    } else {
      list.push({ id: "alarms", label: "Site alarms" });
      list.push({ id: "schedules", label: "Schedules" });
      list.push({ id: "events", label: "Event log" });
      list.push({ id: "insights", label: "Insights" });
      list.push({ id: "workspace", label: "Point workspace" });
      list.push({ id: "refresh", label: "Refresh" });
    }
    return list;
  }, [kind, canCommand, canAlarm]);

  const run = (id) => {
    setOpen(false);
    if (id === "trends") history.push(Routes.LegionTrends.path);
    else if (id === "schedules") history.push(Routes.LegionSchedules.path);
    else if (id === "alarms") history.push(Routes.LegionAlarms.path);
    else if (id === "events") history.push(Routes.LegionEvents.path);
    else if (id === "insights") history.push(Routes.LegionDashboard.path);
    else if (id === "workspace") history.push(Routes.LegionEquipment.path);
    else if (id === "refresh") {
      if (onRefresh) onRefresh();
    } else if (id === "command" || id === "alarm") {
      if (onCommandPoints) onCommandPoints(id);
    }
  };

  return (
    <div className="sidebar-actions">
      <button
        type="button"
        className="sidebar-actions__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <FontAwesomeIcon icon={faCog} className="sidebar-actions__gear" />
          Actions
        </span>
        <FontAwesomeIcon icon={faChevronRight} className={open ? "is-open" : ""} />
      </button>
      {open ? (
        <ul className="sidebar-actions__menu">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => run(item.id)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
