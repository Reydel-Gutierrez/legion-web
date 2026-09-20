import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Form } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSlidersH,
  faNetworkWired,
  faServer,
  faEthernet,
  faProjectDiagram,
  faCog,
  faRoute,
  faChevronRight,
  faCopy,
  faArchive,
  faRocket,
} from "@fortawesome/free-solid-svg-icons";
import ExpandableWorkspaceCard from "../../../components/legion/ExpandableWorkspaceCard";
import { useEngineeringSiteTree } from "./EngineeringSiteTreeContext";
import { useEngineeringArchive } from "../../../app/providers/EngineeringArchiveProvider";
import { useSite } from "../../../app/providers/SiteProvider";
import { useWorkingVersion, selectNetworkConfig } from "../../../hooks/useWorkingVersion";
import { getSiteLocation, setSiteLocation } from "../../../lib/data/persistence/siteLocationStore";
import { appNotify } from "../../../lib/app-activity";
import { Routes } from "../../../routes";

const SECTION_META = {
  general: { label: "General", icon: faSlidersH },
  network: { label: "Network", icon: faNetworkWired },
  system: { label: "System", icon: faServer },
};

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function Field({ label, value }) {
  return (
    <div className="site-settings-field">
      <span className="site-settings-field__label">{label}</span>
      <span className="site-settings-field__value">{value || "—"}</span>
    </div>
  );
}

function GeneralSection({ siteTree, handleSaveNode }) {
  const { site } = useSite();
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(false);

  const buildForm = () => {
    const loc = getSiteLocation(site);
    return {
      name: siteTree?.name || "",
      description: siteTree?.description || "",
      timezone: siteTree?.timezone || "America/New_York",
      location: loc?.address || "",
    };
  };

  const [form, setForm] = useState(buildForm);
  const location = getSiteLocation(site);

  useEffect(() => {
    if (!editing) setForm(buildForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteTree?.id, editing]);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleCancel = () => {
    setForm(buildForm());
    setEditing(false);
  };

  const handleConfirm = () => {
    if (!form.name.trim()) return;
    handleSaveNode(siteTree.id, {
      name: form.name.trim(),
      description: form.description,
      timezone: form.timezone,
      // Preserve fields this simplified card doesn't expose — handleSaveNode overwrites the whole
      // record in hierarchy-API mode, so anything left out here would be silently cleared.
      siteType: siteTree?.siteType,
      displayLabel: siteTree?.displayLabel,
      engineeringNotes: siteTree?.engineeringNotes,
      icon: siteTree?.icon,
    });
    setSiteLocation(site, form.location.trim() ? { address: form.location.trim() } : null);
    setEditing(false);
  };

  return (
    <ExpandableWorkspaceCard
      title="General"
      cardId="general"
      expandedId={expandedId}
      onToggleExpand={setExpandedId}
      headerExtra={
        <button type="button" className="operator-text-link" onClick={() => (editing ? handleCancel() : setEditing(true))}>
          {editing ? "Cancel" : "Edit"}
        </button>
      }
    >
      {editing ? (
        <div className="engineering-light-form">
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Site Name *</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label className="text-white small">Timezone *</Form.Label>
            <Form.Select
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              value={form.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
            >
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Denver">America/Denver</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="UTC">UTC</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="mb-0">
            <Form.Label className="text-white small">Location (optional)</Form.Label>
            <Form.Control
              size="sm"
              className="bg-dark border border-light border-opacity-10 text-white"
              placeholder="e.g. 123 Main St, Miami, FL"
              value={form.location}
              onChange={(e) => handleChange("location", e.target.value)}
            />
          </Form.Group>
          <div className="d-flex justify-content-end mt-3">
            <Button size="sm" className="legion-hero-btn legion-hero-btn--primary" disabled={!form.name.trim()} onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      ) : (
        <div className="site-settings-fields">
          <Field label="Name" value={siteTree?.name} />
          <Field label="Description" value={siteTree?.description} />
          <Field label="Location" value={location?.address} />
          <Field label="Timezone" value={siteTree?.timezone} />
        </div>
      )}
    </ExpandableWorkspaceCard>
  );
}

function NetworkSection() {
  const { workingVersion } = useWorkingVersion();
  const networkConfig = selectNetworkConfig(workingVersion) || {};
  const [expandedId, setExpandedId] = useState(null);

  // Working versions fetched from the backend can carry a partial networkConfig (predates a field,
  // or was never fully seeded) — ensureNetworkConfig only fills in a full default when the field is
  // missing entirely, so guard each array/object here rather than assuming a complete shape.
  const networkInterfaces = networkConfig.networkInterfaces || [];
  const bacnetIpNetworks = networkConfig.bacnetIpNetworks || [];
  const mstpTrunks = networkConfig.mstpTrunks || [];
  const scanDefaults = networkConfig.scanDefaults || {};

  const bbmdCount = bacnetIpNetworks.filter((n) => String(n.bbmdOrForeignDevice || "").trim()).length;

  const rows = [
    {
      icon: faEthernet,
      label: "Network Interfaces",
      detail: `${networkInterfaces.filter((r) => r.enabled).length} enabled`,
    },
    {
      icon: faProjectDiagram,
      label: "BACnet/IP Networks",
      detail: `${bacnetIpNetworks.filter((r) => r.enabled).length} enabled`,
    },
    {
      icon: faCog,
      label: "BACnet Settings",
      detail: scanDefaults.scanTimeoutSec != null ? `Default scan · ${scanDefaults.scanTimeoutSec}s timeout` : "Not configured",
    },
    {
      icon: faRoute,
      label: "BBMD / Foreign Device",
      detail: `${bbmdCount} configured`,
    },
    {
      icon: faServer,
      label: "Gateways",
      detail: `${mstpTrunks.filter((r) => r.enabled).length} MS/TP trunks enabled`,
    },
  ];

  return (
    <ExpandableWorkspaceCard title="Network" cardId="network" expandedId={expandedId} onToggleExpand={setExpandedId}>
      <p className="text-muted small mb-3">
        Managed in Network Configuration — pick a row to open it there.
      </p>
      <table className="site-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="site-table__row">
              <td style={{ width: 28 }}>
                <FontAwesomeIcon icon={row.icon} className="text-muted" />
              </td>
              <td>
                <Link to={Routes.EngineeringNetworkConfiguration.path} className="site-table__link">
                  {row.label}
                </Link>
              </td>
              <td className="text-muted">{row.detail}</td>
              <td style={{ width: 28 }}>
                <Link to={Routes.EngineeringNetworkConfiguration.path} className="site-table__go" aria-label={`Configure ${row.label}`}>
                  <FontAwesomeIcon icon={faChevronRight} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ExpandableWorkspaceCard>
  );
}

function SystemSection({ siteTree }) {
  const { site } = useSite();
  const { workingState } = useEngineeringSiteTree();
  const { activeArchive } = useEngineeringArchive();
  const [expandedId, setExpandedId] = useState(null);
  const deployment = workingState?.activeDeploymentSnapshot;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(site);
      appNotify.success("Site ID copied");
    } catch {
      appNotify.error("Couldn't copy — copy it manually from the field.");
    }
  };

  return (
    <ExpandableWorkspaceCard title="System" cardId="system" expandedId={expandedId} onToggleExpand={setExpandedId}>
      <div className="site-settings-fields">
        <div className="site-settings-field">
          <span className="site-settings-field__label">Site ID</span>
          <span className="site-settings-field__value d-flex align-items-center gap-2">
            <code className="site-settings-field__code">{site}</code>
            <button type="button" className="site-settings-field__copy" aria-label="Copy Site ID" onClick={copyId}>
              <FontAwesomeIcon icon={faCopy} />
            </button>
          </span>
        </div>
        <div className="site-settings-field">
          <span className="site-settings-field__label">
            <FontAwesomeIcon icon={faArchive} className="me-2 text-muted" />
            Archive
          </span>
          <span className="site-settings-field__value">
            {activeArchive
              ? `${activeArchive.name} · created ${formatDateTime(activeArchive.createdAt)} · updated ${formatDateTime(activeArchive.updatedAt)}`
              : "Not saved as an archive yet."}
          </span>
        </div>
        <div className="site-settings-field">
          <span className="site-settings-field__label">
            <FontAwesomeIcon icon={faRocket} className="me-2 text-muted" />
            Deployment
          </span>
          <span className="site-settings-field__value">
            {deployment
              ? `${deployment.version || "—"} · ${deployment.systemStatus || "—"} · deployed ${formatDateTime(deployment.lastDeployedAt)}`
              : "Not deployed yet."}
          </span>
        </div>
      </div>
    </ExpandableWorkspaceCard>
  );
}

export default function SiteSettingsWorkspace({ section }) {
  const { siteTree, handleSaveNode } = useEngineeringSiteTree();
  const meta = SECTION_META[section] || SECTION_META.general;

  return (
    <div className="site-workspace">
      <header className="equipment-header">
        <nav className="operator-breadcrumb" aria-label="Breadcrumb">
          <span className="operator-breadcrumb__item">
            <span className="operator-breadcrumb__current">{siteTree?.name || "Site"}</span>
          </span>
          <span className="operator-breadcrumb__item">
            <span className="operator-breadcrumb__sep">›</span>
            <span className="operator-breadcrumb__current">{meta.label}</span>
          </span>
        </nav>
        <div className="equipment-header__top">
          <div className="equipment-header__row">
            <span className="equipment-header__icon" aria-hidden="true">
              <FontAwesomeIcon icon={meta.icon} />
            </span>
            <div>
              <div className="equipment-header__title-row">
                <h1 className="workspace-header__title">{meta.label}</h1>
              </div>
              <p className="workspace-header__meta">
                <span>{siteTree?.name || "Site"}</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      {section === "general" ? <GeneralSection siteTree={siteTree} handleSaveNode={handleSaveNode} /> : null}
      {section === "network" ? <NetworkSection /> : null}
      {section === "system" ? <SystemSection siteTree={siteTree} /> : null}
    </div>
  );
}
