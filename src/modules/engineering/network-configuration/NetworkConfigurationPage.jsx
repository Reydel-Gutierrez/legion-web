import React, { useCallback, useMemo, useState } from "react";
import { Card, Row, Col } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEthernet, faCheckCircle, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import { useWorkingVersion, selectNetworkConfig } from "../../../hooks/useWorkingVersion";
import { SCAN_MODES } from "../network/networkConfigModel";
import NoSiteSelectedState from "../network-discovery/components/NoSiteSelectedState";
import { engineeringRepository } from "../../../lib/data";
import NetworkConfigSectionNav from "./components/NetworkConfigSectionNav";
import BacnetIpNetworksSection from "./components/BacnetIpNetworksSection";
import MstpTrunksSection from "./components/MstpTrunksSection";
import ScanDefaultsSection from "./components/ScanDefaultsSection";
import NetworkInterfacesSection from "./components/NetworkInterfacesSection";
import RoutingNotesSection from "./components/RoutingNotesSection";

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getScanModeLabel(mode) {
  if (mode === SCAN_MODES.BACNET_IP) return "BACnet/IP";
  if (mode === SCAN_MODES.BACNET_MSTP) return "BACnet MS/TP";
  return "All protocols";
}

function getReadiness(networkConfig) {
  const ipEnabled = networkConfig.bacnetIpNetworks.some((row) => row.enabled);
  const mstpEnabled = networkConfig.mstpTrunks.some((row) => row.enabled);
  const interfaceEnabled = networkConfig.networkInterfaces.some((row) => row.enabled);

  if (ipEnabled || mstpEnabled) {
    return {
      ok: true,
      title: "Ready for Network Discovery",
      detail: "At least one scan path is enabled. Save, then run a scan from Network Discovery or BACnet Explorer.",
    };
  }

  if (interfaceEnabled) {
    return {
      ok: false,
      title: "Add a scan path",
      detail: "Legion has a server interface configured, but no BACnet/IP network or MS/TP trunk is enabled yet.",
    };
  }

  return {
    ok: false,
    title: "Configuration incomplete",
    detail: "Enable a BACnet/IP network or MS/TP trunk, and confirm the Legion server bind address.",
  };
}

export default function NetworkConfigurationPage() {
  const { site } = useSite();
  const { workingVersion, actions } = useWorkingVersion();
  const networkConfig = selectNetworkConfig(workingVersion);
  const hasNoSite = engineeringRepository.isNewEngineeringBuildingFlow(site) && !workingVersion?.data?.site;
  const [activeSection, setActiveSection] = useState("bacnet-ip");

  const pushConfig = useCallback(
    (next) => {
      actions.setNetworkConfig(next);
    },
    [actions]
  );

  const updateScanDefaults = useCallback(
    (patch) => {
      pushConfig({
        ...networkConfig,
        scanDefaults: { ...networkConfig.scanDefaults, ...patch },
      });
    },
    [networkConfig, pushConfig]
  );

  const updateRoutingNotes = useCallback(
    (routingNotes) => {
      pushConfig({ ...networkConfig, routingNotes });
    },
    [networkConfig, pushConfig]
  );

  const addBacnetIp = useCallback(() => {
    pushConfig({
      ...networkConfig,
      bacnetIpNetworks: [
        ...networkConfig.bacnetIpNetworks,
        {
          id: nextId("ip"),
          name: "New BACnet/IP network",
          enabled: true,
          interfaceName: "",
          localIpSubnet: "",
          udpPort: 47808,
          bbmdOrForeignDevice: "",
          notes: "",
        },
      ],
    });
    setActiveSection("bacnet-ip");
  }, [networkConfig, pushConfig]);

  const updateBacnetIp = useCallback(
    (id, patch) => {
      pushConfig({
        ...networkConfig,
        bacnetIpNetworks: networkConfig.bacnetIpNetworks.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      });
    },
    [networkConfig, pushConfig]
  );

  const removeBacnetIp = useCallback(
    (id) => {
      pushConfig({
        ...networkConfig,
        bacnetIpNetworks: networkConfig.bacnetIpNetworks.filter((row) => row.id !== id),
      });
    },
    [networkConfig, pushConfig]
  );

  const addMstp = useCallback(() => {
    pushConfig({
      ...networkConfig,
      mstpTrunks: [
        ...networkConfig.mstpTrunks,
        {
          id: nextId("mstp"),
          name: "New MSTP trunk",
          enabled: true,
          comPort: "COM1",
          baudRate: "38400",
          macRange: "0–127",
          maxMaster: 127,
          notes: "",
        },
      ],
    });
    setActiveSection("mstp");
  }, [networkConfig, pushConfig]);

  const updateMstp = useCallback(
    (id, patch) => {
      pushConfig({
        ...networkConfig,
        mstpTrunks: networkConfig.mstpTrunks.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      });
    },
    [networkConfig, pushConfig]
  );

  const removeMstp = useCallback(
    (id) => {
      pushConfig({
        ...networkConfig,
        mstpTrunks: networkConfig.mstpTrunks.filter((row) => row.id !== id),
      });
    },
    [networkConfig, pushConfig]
  );

  const addInterface = useCallback(() => {
    pushConfig({
      ...networkConfig,
      networkInterfaces: [
        ...networkConfig.networkInterfaces,
        {
          id: nextId("if"),
          label: "Interface",
          bindAddress: "",
          listenUdp: 47808,
          enabled: true,
          notes: "",
        },
      ],
    });
    setActiveSection("interface");
  }, [networkConfig, pushConfig]);

  const updateInterface = useCallback(
    (id, patch) => {
      pushConfig({
        ...networkConfig,
        networkInterfaces: networkConfig.networkInterfaces.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      });
    },
    [networkConfig, pushConfig]
  );

  const removeInterface = useCallback(
    (id) => {
      pushConfig({
        ...networkConfig,
        networkInterfaces: networkConfig.networkInterfaces.filter((row) => row.id !== id),
      });
    },
    [networkConfig, pushConfig]
  );

  const sectionCounts = useMemo(
    () => ({
      "bacnet-ip": networkConfig.bacnetIpNetworks.filter((row) => row.enabled).length,
      mstp: networkConfig.mstpTrunks.filter((row) => row.enabled).length,
      scan: null,
      interface: networkConfig.networkInterfaces.filter((row) => row.enabled).length,
      notes: networkConfig.routingNotes?.trim() ? 1 : null,
    }),
    [networkConfig]
  );

  const readiness = useMemo(() => getReadiness(networkConfig), [networkConfig]);
  const ipCount = networkConfig.bacnetIpNetworks.filter((row) => row.enabled).length;
  const mstpCount = networkConfig.mstpTrunks.filter((row) => row.enabled).length;

  if (hasNoSite) {
    return (
      <div className="px-3 px-md-4 pb-4">
        <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Header className="legion-operator-log-card-header">
            <span className="text-white fw-bold text-uppercase">Network Configuration</span>
          </Card.Header>
          <Card.Body className="p-0">
            <NoSiteSelectedState />
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-3 px-md-4 pb-4 network-config-page">
      <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm">
        <Card.Header className="legion-operator-log-card-header">
          <span className="text-white fw-bold text-uppercase">
            <FontAwesomeIcon icon={faEthernet} className="me-2" />
            Network Configuration
          </span>
        </Card.Header>
        <Card.Body>
          <p className="text-white-50 small mb-3">
            Configure how Legion reaches BACnet devices on this site. Pick a section below, fill in the fields, then
            save and run Network Discovery or BACnet Explorer.
          </p>

          <div className={`network-config-readiness ${readiness.ok ? "is-ready" : "is-pending"}`}>
            <FontAwesomeIcon
              icon={readiness.ok ? faCheckCircle : faExclamationTriangle}
              className="network-config-readiness__icon"
            />
            <div>
              <div className="network-config-readiness__title">{readiness.title}</div>
              <div className="network-config-readiness__detail">{readiness.detail}</div>
            </div>
          </div>

          <Row className="g-2 mb-3 network-config-summary">
            <Col sm={4}>
              <div className="network-config-summary__tile">
                <span className="network-config-summary__label">BACnet/IP</span>
                <span className="network-config-summary__value">{ipCount} enabled</span>
              </div>
            </Col>
            <Col sm={4}>
              <div className="network-config-summary__tile">
                <span className="network-config-summary__label">MS/TP trunks</span>
                <span className="network-config-summary__value">{mstpCount} enabled</span>
              </div>
            </Col>
            <Col sm={4}>
              <div className="network-config-summary__tile">
                <span className="network-config-summary__label">Default scan</span>
                <span className="network-config-summary__value">
                  {getScanModeLabel(networkConfig.scanDefaults.defaultScanMode)} ·{" "}
                  {networkConfig.scanDefaults.scanTimeoutSec}s
                </span>
              </div>
            </Col>
          </Row>

          <div className="network-config-workspace">
            <NetworkConfigSectionNav
              activeSection={activeSection}
              onSelect={setActiveSection}
              counts={sectionCounts}
            />

            <div className="network-config-workspace__panel">
              {activeSection === "bacnet-ip" ? (
                <BacnetIpNetworksSection
                  networks={networkConfig.bacnetIpNetworks}
                  onAdd={addBacnetIp}
                  onUpdate={updateBacnetIp}
                  onRemove={removeBacnetIp}
                />
              ) : null}

              {activeSection === "mstp" ? (
                <MstpTrunksSection
                  trunks={networkConfig.mstpTrunks}
                  onAdd={addMstp}
                  onUpdate={updateMstp}
                  onRemove={removeMstp}
                />
              ) : null}

              {activeSection === "scan" ? (
                <ScanDefaultsSection scanDefaults={networkConfig.scanDefaults} onUpdate={updateScanDefaults} />
              ) : null}

              {activeSection === "interface" ? (
                <NetworkInterfacesSection
                  interfaces={networkConfig.networkInterfaces}
                  onAdd={addInterface}
                  onUpdate={updateInterface}
                  onRemove={removeInterface}
                />
              ) : null}

              {activeSection === "notes" ? (
                <RoutingNotesSection routingNotes={networkConfig.routingNotes} onUpdate={updateRoutingNotes} />
              ) : null}
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
