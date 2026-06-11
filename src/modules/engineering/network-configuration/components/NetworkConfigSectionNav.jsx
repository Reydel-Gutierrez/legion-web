import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faNetworkWired,
  faPlug,
  faSearch,
  faServer,
  faStickyNote,
} from "@fortawesome/free-solid-svg-icons";

export const NETWORK_CONFIG_SECTIONS = [
  {
    id: "bacnet-ip",
    title: "BACnet/IP",
    description: "IP networks and subnets to scan",
    icon: faNetworkWired,
  },
  {
    id: "mstp",
    title: "BACnet MS/TP",
    description: "Serial trunks on routers or USB adapters",
    icon: faPlug,
  },
  {
    id: "scan",
    title: "Discovery Scan",
    description: "Timeouts and default scan behavior",
    icon: faSearch,
  },
  {
    id: "interface",
    title: "Legion Server",
    description: "Bind address and UDP listen port",
    icon: faServer,
  },
  {
    id: "notes",
    title: "Topology Notes",
    description: "VLANs, routers, and field notes",
    icon: faStickyNote,
  },
];

export default function NetworkConfigSectionNav({ activeSection, onSelect, counts = {} }) {
  return (
    <div className="network-config-section-nav">
      {NETWORK_CONFIG_SECTIONS.map((section) => {
        const count = counts[section.id];
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            className={`network-config-section-nav__item ${isActive ? "is-active" : ""}`}
            onClick={() => onSelect(section.id)}
          >
            <FontAwesomeIcon icon={section.icon} className="network-config-section-nav__icon" />
            <span className="network-config-section-nav__title">{section.title}</span>
            <span className="network-config-section-nav__desc">{section.description}</span>
            {count != null && count > 0 ? (
              <span className="network-config-section-nav__badge">{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
