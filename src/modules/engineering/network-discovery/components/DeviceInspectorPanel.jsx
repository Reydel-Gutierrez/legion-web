import React, { useState, useEffect } from "react";
import { Card, Button, Table, Form } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSearch, faSyncAlt } from "@fortawesome/free-solid-svg-icons";

/** Points discovery status for display */
export const POINTS_STATUS = {
  NOT_DISCOVERED: "Not Discovered",
  DISCOVERED: "Discovered",
  REFRESH_REQUIRED: "Refresh Required",
  DEVICE_OFFLINE: "Device Offline",
};

function PointsStatusBadge({ status, deviceStatus }) {
  const resolved =
    deviceStatus === "Offline"
      ? POINTS_STATUS.DEVICE_OFFLINE
      : status || POINTS_STATUS.NOT_DISCOVERED;
  const variant =
    resolved === POINTS_STATUS.DEVICE_OFFLINE
      ? "danger"
      : resolved === POINTS_STATUS.DISCOVERED
        ? "success"
        : resolved === POINTS_STATUS.REFRESH_REQUIRED
          ? "warning"
          : "secondary";
  return (
    <span className={`badge bg-${variant} text-white`}>
      {resolved}
    </span>
  );
}

export default function DeviceInspectorPanel({
  device,
  assignedEquipmentPath,
  pointDiscovery,
  onClose,
  onDiscoverPoints,
  onRefreshPoints,
  onPatchDevice,
  phase2SiteId,
  persistedEquipmentController,
  onPhase2AssignClick,
  onPhase2MapClick,
  phase2ControllerCode,
}) {
  const [addressDraft, setAddressDraft] = useState("");
  const deviceId = device?.id;
  const deviceAddress = device?.address;
  useEffect(() => {
    setAddressDraft(deviceAddress != null ? String(deviceAddress) : "");
  }, [deviceId, deviceAddress]);

  const commitAddressIfChanged = () => {
    if (!device?.id || !onPatchDevice) return;
    const v = addressDraft.trim();
    const cur = device?.address != null ? String(device.address).trim() : "";
    if (v === cur) return;
    onPatchDevice(device.id, { address: v || null });
  };

  const pointsStatus = pointDiscovery?.pointsStatus ?? null;
  const lastPointDiscoveryTime = pointDiscovery?.lastPointDiscoveryTime ?? null;
  const discoveredObjects = pointDiscovery?.discoveredObjects ?? [];
  const deviceStatus = device?.status ?? "Offline";
  const isOffline = deviceStatus === "Offline";

  return (
    <div className="device-inspector-panel d-flex flex-column h-100">
      <div className="equipment-template-editor-header border-bottom border-light border-opacity-10 px-4 py-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h5 className="text-white fw-bold mb-0">Device Inspector</h5>
            <p className="text-white-50 small mb-0 mt-1">
              Inspect discovered BACnet device and manage point discovery.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTimes} className="me-1" /> Close
            </Button>
          </div>
        </div>
      </div>

      <div className="equipment-template-editor-body flex-grow-1 overflow-auto px-4 py-3">
        {/* SECTION 1 — Device Information */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10">
            <span className="text-white fw-bold small text-uppercase">Device Information</span>
          </Card.Header>
          <Card.Body>
            <div className="row g-3 small">
              <div className="col-md-6">
                <div className="text-white-50">Device Name</div>
                <div className="text-white">{device?.name ?? "—"}</div>
              </div>
              <div className="col-md-6">
                <div className="text-white-50">Vendor</div>
                <div className="text-white">{device?.vendor ?? "—"}</div>
              </div>
              <div className="col-md-6">
                <div className="text-white-50">Device Instance</div>
                <div className="text-white">{device?.deviceInstance ?? "—"}</div>
              </div>
              <div className="col-md-6">
                <div className="text-white-50">Network</div>
                <div className="text-white">{device?.network ?? device?.protocol ?? "—"}</div>
              </div>
              <div className="col-md-6">
                <div className="text-white-50">Device Address</div>
                <div className="text-white">{device?.macOrMstpId ?? "—"}</div>
              </div>
              <div className="col-md-6">
                <div className="text-white-50">Object Count</div>
                <div className="text-white">{device?.objectCount ?? "—"}</div>
              </div>
              <div className="col-md-6">
                <div className="text-white-50">Last Seen</div>
                <div className="text-white">{device?.lastSeen ?? "—"}</div>
              </div>
              <div className="col-md-6">
                <div className="text-white-50">Status</div>
                <div className="text-white">{device?.status ?? "—"}</div>
              </div>
              {assignedEquipmentPath && (
                <div className="col-12">
                  <div className="text-white-50">Assigned Equipment</div>
                  <div className="text-white">{assignedEquipmentPath}</div>
                </div>
              )}
              {phase2SiteId && phase2ControllerCode ? (
                <div className="col-12">
                  <div className="text-white-50 small text-uppercase mb-2">Controller assignment (database)</div>
                  {persistedEquipmentController ? (
                    <div className="text-white small mb-2">
                      <div>
                        Code: <span className="text-white">{persistedEquipmentController.controllerCode}</span> ·{" "}
                        {persistedEquipmentController.protocol || "—"}
                      </div>
                      <div className="text-white-50">Equipment ID: {persistedEquipmentController.equipmentId}</div>
                    </div>
                  ) : (
                    <div className="text-white-50 small mb-2">
                      No persisted assignment for this controller yet.
                    </div>
                  )}
                  <div className="d-flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline-light"
                      className="legion-hero-btn legion-hero-btn--secondary"
                      onClick={onPhase2AssignClick}
                    >
                      Assign to equipment
                    </Button>
                    <Button
                      size="sm"
                      className="legion-hero-btn legion-hero-btn--primary"
                      onClick={onPhase2MapClick}
                      disabled={!persistedEquipmentController?.id}
                    >
                      Map points
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="col-12">
                <Form.Label className="text-white-50 small mb-1">Address # (optional)</Form.Label>
                <Form.Control
                  size="sm"
                  className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
                  value={addressDraft}
                  onChange={(e) => setAddressDraft(e.target.value)}
                  onBlur={commitAddressIfChanged}
                  placeholder="User-defined address # for mapping to equipment"
                  disabled={!device?.id || !onPatchDevice}
                />
                <div className="text-white-50 mt-1" style={{ fontSize: "0.7rem" }}>
                  Saved when you leave this field. Shown when assigning equipment to this controller.
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* SECTION 2 — Point Discovery Controls */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm mb-3">
          <Card.Header className="bg-transparent border-light border-opacity-10 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span className="text-white fw-bold small text-uppercase">Point Discovery Controls</span>
          </Card.Header>
          <Card.Body>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <Button
                size="sm"
                className="legion-hero-btn legion-hero-btn--primary"
                disabled={isOffline}
                onClick={() => onDiscoverPoints && onDiscoverPoints()}
              >
                <FontAwesomeIcon icon={faSearch} className="me-1" /> Discover Points
              </Button>
              <Button
                size="sm"
                variant="outline-light"
                className="legion-hero-btn legion-hero-btn--secondary"
                disabled={isOffline || discoveredObjects.length === 0}
                onClick={() => onRefreshPoints && onRefreshPoints()}
              >
                <FontAwesomeIcon icon={faSyncAlt} className="me-1" /> Refresh Points
              </Button>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-3 small">
              <div className="d-flex align-items-center gap-2">
                <span className="text-white-50">Points Status:</span>
                <PointsStatusBadge status={pointsStatus} deviceStatus={deviceStatus} />
              </div>
              {lastPointDiscoveryTime && (
                <div className="text-white-50">
                  Last Point Discovery: {lastPointDiscoveryTime}
                </div>
              )}
            </div>
            <div className="mt-2 text-white-50 small">
              Optional future: Clear Cached Discovery
            </div>
          </Card.Body>
        </Card>

        {/* SECTION 3 — Discovered Objects Table */}
        <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
          <Card.Header className="bg-transparent border-light border-opacity-10">
            <span className="text-white fw-bold small text-uppercase">Discovered Objects</span>
          </Card.Header>
          <Card.Body className="p-0">
            {discoveredObjects.length === 0 ? (
              <div className="text-center py-5 px-3">
                <p className="text-white-50 mb-2">No points discovered yet for this device.</p>
                <p className="text-white-50 small mb-3">
                  Run point discovery to read BACnet objects from this controller.
                </p>
                <Button
                  size="sm"
                  className="legion-hero-btn legion-hero-btn--primary"
                  disabled={isOffline}
                  onClick={() => onDiscoverPoints && onDiscoverPoints()}
                >
                  <FontAwesomeIcon icon={faSearch} className="me-1" /> Discover Points
                </Button>
              </div>
            ) : (
              <div className="discovery-table-wrap overflow-auto">
                <Table className="discovery-table equipment-template-points-table mb-0" responsive>
                  <thead>
                    <tr>
                      <th className="discovery-table-header">Object Name</th>
                      <th className="discovery-table-header">Object Type</th>
                      <th className="discovery-table-header">Instance</th>
                      <th className="discovery-table-header">Present Value</th>
                      <th className="discovery-table-header">Units</th>
                      <th className="discovery-table-header">Last Read</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discoveredObjects.map((obj, idx) => (
                      <tr key={obj.id || idx} className="discovery-table-row">
                        <td className="discovery-table-cell text-white">
                          {obj.objectName ?? "—"}
                        </td>
                        <td className="discovery-table-cell text-white-50">
                          {obj.objectType ?? "—"}
                        </td>
                        <td className="discovery-table-cell text-white-50">
                          {obj.instance ?? "—"}
                        </td>
                        <td className="discovery-table-cell text-white-50">
                          {obj.presentValue ?? "—"}
                        </td>
                        <td className="discovery-table-cell text-white-50">
                          {obj.units ?? "—"}
                        </td>
                        <td className="discovery-table-cell discovery-table-cell--muted">
                          {obj.lastRead ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
