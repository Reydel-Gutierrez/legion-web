import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

export default function OperatorAlarmBell({ active = true }) {
  return (
    <FontAwesomeIcon
      icon={faBell}
      className={`operator-alarm-bell${active ? " operator-alarm-bell--active" : ""}`}
      title={active ? "Active alarm" : "Alarm Center"}
    />
  );
}
