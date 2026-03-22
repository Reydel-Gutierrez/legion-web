import React, { useCallback } from "react";
import { Card, Row, Col, Form, Button, Table } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEthernet, faPlus, faTrashAlt } from "@fortawesome/free-solid-svg-icons";

import { useSite } from "../../../app/providers/SiteProvider";
import { useEngineeringDraft, selectNetworkConfig } from "../../../hooks/useEngineeringDraft";
import { SCAN_MODES } from "../network/networkConfigModel";
import NoSiteSelectedState from "../network-discovery/components/NoSiteSelectedState";
import { engineeringRepository } from "../../../lib/data";

function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export default function NetworkConfigurationPage() {
  const { site } = useSite();
  const { draft, actions } = useEngineeringDraft();
  const networkConfig = selectNetworkConfig(draft);
  const hasNoSite = engineeringRepository.isNewEngineeringBuildingFlow(site) && !draft?.site;

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

  if (hasNoSite) {
    return (
      <div className="px-3 px-md-4 pb-4">
        <div className="mb-3">
          <h5 className="text-white fw-bold mb-1">Network Configuration</h5>
          <div className="text-white-50 small">Define BACnet/IP and MS/TP paths used by the discovery engine for this site.</div>
        </div>
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Body className="p-0">
            <NoSiteSelectedState />
          </Card.Body>
        </Card>
      </div>
    );
  }

  const ipCount = networkConfig.bacnetIpNetworks.filter((n) => n.enabled).length;
  const mstpCount = networkConfig.mstpTrunks.filter((t) => t.enabled).length;

  return (
    <div className="px-3 px-md-4 pb-4">
        <div className="mb-3">
          <h5 className="text-white fw-bold mb-1">
            <FontAwesomeIcon icon={faEthernet} className="me-2" />
            Network Configuration
          </h5>
          <div className="text-white-50 small">
            Site-scoped paths for the Legion supervisory discovery engine. Network Discovery reads this configuration to decide what
            to scan.
          </div>
        </div>

        <Row className="g-3 mb-3">
          <Col md={6} lg={4}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body>
                <div className="text-white-50 small text-uppercase mb-1">Configured networks</div>
                <div className="text-white fw-bold">{networkConfig.bacnetIpNetworks.length + networkConfig.mstpTrunks.length} rows</div>
                <div className="text-white-50 small mt-2 mb-0">
                  {ipCount} BACnet/IP enabled · {mstpCount} MS/TP enabled
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} lg={4}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body>
                <div className="text-white-50 small text-uppercase mb-1">Interfaces</div>
                <div className="text-white fw-bold">{networkConfig.networkInterfaces.filter((i) => i.enabled).length} active</div>
                <div className="text-white-50 small mt-2 mb-0">Supervisory binding / listen ports for BACnet/IP</div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={12} lg={4}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body>
                <div className="text-white-50 small text-uppercase mb-1">Default scan</div>
                <div className="text-white fw-bold">
                  {networkConfig.scanDefaults.defaultScanMode === SCAN_MODES.ALL
                    ? "Scan All"
                    : networkConfig.scanDefaults.defaultScanMode === SCAN_MODES.BACNET_IP
                    ? "BACnet/IP"
                    : "BACnet MS/TP"}
                </div>
                <div className="text-white-50 small mt-2 mb-0">
                  Timeout {networkConfig.scanDefaults.scanTimeoutSec}s · retries {networkConfig.scanDefaults.retries}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span className="text-white fw-bold">BACnet/IP settings</span>
            <Button size="sm" variant="outline-light" className="border-light border-opacity-25" onClick={addBacnetIp}>
              <FontAwesomeIcon icon={faPlus} className="me-1" /> Add network
            </Button>
          </Card.Header>
          <Card.Body className="p-0">
            {networkConfig.bacnetIpNetworks.length === 0 ? (
              <p className="text-white-50 small mb-0 p-3">No BACnet/IP networks yet. Add one to scan the building LAN or VLAN.</p>
            ) : (
              <div className="table-responsive">
                <Table borderless hover variant="dark" className="mb-0 text-white-50 small align-middle">
                  <thead className="text-white-50">
                    <tr>
                      <th>On</th>
                      <th>Name</th>
                      <th>Adapter</th>
                      <th>Subnet / IP</th>
                      <th>UDP</th>
                      <th>BBMD / FD</th>
                      <th>Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {networkConfig.bacnetIpNetworks.map((row) => (
                      <tr key={row.id}>
                        <td style={{ width: 48 }}>
                          <Form.Check
                            type="switch"
                            checked={row.enabled}
                            onChange={(e) => updateBacnetIp(row.id, { enabled: e.target.checked })}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.name}
                            onChange={(e) => updateBacnetIp(row.id, { name: e.target.value })}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.interfaceName}
                            onChange={(e) => updateBacnetIp(row.id, { interfaceName: e.target.value })}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.localIpSubnet}
                            onChange={(e) => updateBacnetIp(row.id, { localIpSubnet: e.target.value })}
                            placeholder="10.0.0.0/24"
                          />
                        </td>
                        <td style={{ maxWidth: 90 }}>
                          <Form.Control
                            size="sm"
                            type="number"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.udpPort}
                            onChange={(e) => updateBacnetIp(row.id, { udpPort: Number(e.target.value) || 47808 })}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.bbmdOrForeignDevice}
                            onChange={(e) => updateBacnetIp(row.id, { bbmdOrForeignDevice: e.target.value })}
                            placeholder="Optional"
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.notes}
                            onChange={(e) => updateBacnetIp(row.id, { notes: e.target.value })}
                          />
                        </td>
                        <td className="text-end">
                          <Button size="sm" variant="link" className="text-danger text-decoration-none p-0" onClick={() => removeBacnetIp(row.id)}>
                            <FontAwesomeIcon icon={faTrashAlt} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span className="text-white fw-bold">BACnet MS/TP trunks</span>
            <Button size="sm" variant="outline-light" className="border-light border-opacity-25" onClick={addMstp}>
              <FontAwesomeIcon icon={faPlus} className="me-1" /> Add trunk
            </Button>
          </Card.Header>
          <Card.Body className="p-0">
            {networkConfig.mstpTrunks.length === 0 ? (
              <p className="text-white-50 small mb-0 p-3">No MSTP trunks yet. Add serial segments for field controllers behind routers.</p>
            ) : (
              <div className="table-responsive">
                <Table borderless hover variant="dark" className="mb-0 text-white-50 small align-middle">
                  <thead className="text-white-50">
                    <tr>
                      <th>On</th>
                      <th>Trunk</th>
                      <th>COM</th>
                      <th>Baud</th>
                      <th>MAC / scan range</th>
                      <th>Max master</th>
                      <th>Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {networkConfig.mstpTrunks.map((row) => (
                      <tr key={row.id}>
                        <td style={{ width: 48 }}>
                          <Form.Check
                            type="switch"
                            checked={row.enabled}
                            onChange={(e) => updateMstp(row.id, { enabled: e.target.checked })}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.name}
                            onChange={(e) => updateMstp(row.id, { name: e.target.value })}
                          />
                        </td>
                        <td style={{ maxWidth: 88 }}>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.comPort}
                            onChange={(e) => updateMstp(row.id, { comPort: e.target.value })}
                          />
                        </td>
                        <td style={{ maxWidth: 100 }}>
                          <Form.Select
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.baudRate}
                            onChange={(e) => updateMstp(row.id, { baudRate: e.target.value })}
                          >
                            {["9600", "19200", "38400", "57600", "76800", "115200"].map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </Form.Select>
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.macRange}
                            onChange={(e) => updateMstp(row.id, { macRange: e.target.value })}
                          />
                        </td>
                        <td style={{ maxWidth: 96 }}>
                          <Form.Control
                            size="sm"
                            type="number"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.maxMaster}
                            onChange={(e) => updateMstp(row.id, { maxMaster: Number(e.target.value) || 127 })}
                          />
                        </td>
                        <td>
                          <Form.Control
                            size="sm"
                            className="bg-dark border-light border-opacity-25 text-white"
                            value={row.notes}
                            onChange={(e) => updateMstp(row.id, { notes: e.target.value })}
                          />
                        </td>
                        <td className="text-end">
                          <Button size="sm" variant="link" className="text-danger text-decoration-none p-0" onClick={() => removeMstp(row.id)}>
                            <FontAwesomeIcon icon={faTrashAlt} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10">
            <span className="text-white fw-bold">Scan defaults</span>
          </Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col md={6} lg={4}>
                <Form.Group>
                  <Form.Label className="text-white-50 small">Default scan mode</Form.Label>
                  <Form.Select
                    className="bg-dark border-light border-opacity-25 text-white"
                    value={networkConfig.scanDefaults.defaultScanMode}
                    onChange={(e) => updateScanDefaults({ defaultScanMode: e.target.value })}
                  >
                    <option value={SCAN_MODES.ALL}>Scan All</option>
                    <option value={SCAN_MODES.BACNET_IP}>BACnet/IP</option>
                    <option value={SCAN_MODES.BACNET_MSTP}>BACnet MS/TP</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6} lg={4}>
                <Form.Group>
                  <Form.Label className="text-white-50 small">Scan timeout (seconds)</Form.Label>
                  <Form.Control
                    type="number"
                    className="bg-dark border-light border-opacity-25 text-white"
                    value={networkConfig.scanDefaults.scanTimeoutSec}
                    onChange={(e) => updateScanDefaults({ scanTimeoutSec: Math.max(1, Number(e.target.value) || 15) })}
                  />
                </Form.Group>
              </Col>
              <Col md={6} lg={4}>
                <Form.Group>
                  <Form.Label className="text-white-50 small">Retries</Form.Label>
                  <Form.Control
                    type="number"
                    className="bg-dark border-light border-opacity-25 text-white"
                    value={networkConfig.scanDefaults.retries}
                    onChange={(e) => updateScanDefaults({ retries: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </Form.Group>
              </Col>
              <Col md={6} lg={6}>
                <Form.Check
                  id="include-unconfigured"
                  type="checkbox"
                  className="text-white small"
                  label="Include unconfigured protocols (commissioning: scan all mock protocol families even if no rows are enabled)"
                  checked={networkConfig.scanDefaults.includeUnconfiguredProtocols}
                  onChange={(e) => updateScanDefaults({ includeUnconfiguredProtocols: e.target.checked })}
                />
              </Col>
              <Col md={6} lg={6}>
                <Form.Check
                  id="autoscan-open"
                  type="checkbox"
                  className="text-white small"
                  label="Auto-scan when opening Network Discovery (requires supervisory service)"
                  checked={networkConfig.scanDefaults.autoScanOnOpen}
                  onChange={(e) => updateScanDefaults({ autoScanOnOpen: e.target.checked })}
                  disabled
                />
                <div className="text-white-50 small mt-1">Placeholder — enable when backend job orchestration exists.</div>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span className="text-white fw-bold">Network interfaces / ports</span>
            <Button size="sm" variant="outline-light" className="border-light border-opacity-25" onClick={addInterface}>
              <FontAwesomeIcon icon={faPlus} className="me-1" /> Add interface
            </Button>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table borderless hover variant="dark" className="mb-0 text-white-50 small align-middle">
                <thead className="text-white-50">
                  <tr>
                    <th>On</th>
                    <th>Label</th>
                    <th>Bind address</th>
                    <th>UDP listen</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {networkConfig.networkInterfaces.map((row) => (
                    <tr key={row.id}>
                      <td style={{ width: 48 }}>
                        <Form.Check
                          type="switch"
                          checked={row.enabled}
                          onChange={(e) => updateInterface(row.id, { enabled: e.target.checked })}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          className="bg-dark border-light border-opacity-25 text-white"
                          value={row.label}
                          onChange={(e) => updateInterface(row.id, { label: e.target.value })}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          className="bg-dark border-light border-opacity-25 text-white"
                          value={row.bindAddress}
                          onChange={(e) => updateInterface(row.id, { bindAddress: e.target.value })}
                          placeholder="0.0.0.0"
                        />
                      </td>
                      <td style={{ maxWidth: 110 }}>
                        <Form.Control
                          size="sm"
                          type="number"
                          className="bg-dark border-light border-opacity-25 text-white"
                          value={row.listenUdp ?? ""}
                          onChange={(e) =>
                            updateInterface(row.id, {
                              listenUdp: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder="47808"
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          className="bg-dark border-light border-opacity-25 text-white"
                          value={row.notes}
                          onChange={(e) => updateInterface(row.id, { notes: e.target.value })}
                        />
                      </td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="link"
                          className="text-danger text-decoration-none p-0"
                          onClick={() => removeInterface(row.id)}
                        >
                          <FontAwesomeIcon icon={faTrashAlt} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>

        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10">
            <span className="text-white fw-bold">Routing / notes</span>
          </Card.Header>
          <Card.Body>
            <Form.Control
              as="textarea"
              rows={3}
              className="bg-dark border-light border-opacity-25 text-white small"
              placeholder="Document VLANs, routers, JACE placement, MSTP topology…"
              value={networkConfig.routingNotes}
              onChange={(e) => updateRoutingNotes(e.target.value)}
            />
          </Card.Body>
        </Card>
    </div>
  );
}
