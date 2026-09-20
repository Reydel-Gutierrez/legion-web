import React from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "points", label: "Points" },
  { id: "logic", label: "Logic" },
  { id: "graphics", label: "Graphics" },
  { id: "network", label: "Network" },
  { id: "alarms", label: "Alarms" },
  { id: "trends", label: "Trends" },
  { id: "schedule", label: "Schedule" },
  { id: "files", label: "Files" },
];

export default function EquipmentWorkspaceTabs({ activeTab, onChange }) {
  return (
    <nav className="operator-workspace-tabs equipment-workspace-tabs" aria-label="Equipment sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? "is-active" : ""}
          aria-current={activeTab === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
