import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Container } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faProjectDiagram } from "@fortawesome/free-solid-svg-icons";

import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import {
  fetchExplorerDevices,
  fetchDeviceTree,
  fetchExplorerObject,
  readDeviceProperties,
  readBacnetProperty,
  importBacnetDiscovery,
  checkDevicesHealth,
} from "../../../lib/data/adapters/api/bacnetApiAdapter";
import { appNotify } from "../../../lib/app-activity/appNotify";
import DeviceListPanel from "./components/DeviceListPanel";
import ObjectTreePanel from "./components/ObjectTreePanel";
import ObjectDetailsPanel from "./components/ObjectDetailsPanel";
import DiscoverDevicesModal from "./components/DiscoverDevicesModal";
import { flattenTreeGroups } from "./bacnetExplorerUtils";

const DEFAULT_IMPORT_LIMIT = 200;

export default function BacnetExplorerPage() {
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [deviceTree, setDeviceTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState(null);

  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [objectDetail, setObjectDetail] = useState(null);
  const [objectLoading, setObjectLoading] = useState(false);
  const [objectError, setObjectError] = useState(null);

  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState(null);

  const [manualRead, setManualRead] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState(null);

  const [importing, setImporting] = useState(false);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [deviceHealthById, setDeviceHealthById] = useState({});
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) || deviceTree?.device || null,
    [devices, selectedDeviceId, deviceTree?.device]
  );

  const flatObjects = useMemo(
    () => flattenTreeGroups(deviceTree?.groups || {}),
    [deviceTree?.groups]
  );

  const selectedObject = useMemo(
    () => flatObjects.find((object) => object.id === selectedObjectId) || objectDetail?.discoveredObject || null,
    [flatObjects, selectedObjectId, objectDetail?.discoveredObject]
  );

  const loadDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const list = await fetchExplorerDevices();
      setDevices(list);
    } catch {
      // Device list errors are not shown inline in the panel.
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const handleCheckDevicesHealth = useCallback(async () => {
    setHealthCheckLoading(true);
    try {
      const result = await checkDevicesHealth();
      const nextHealth = {};
      for (const entry of result.devices || []) {
        nextHealth[entry.deviceId] = {
          online: entry.online,
          status: entry.status,
          checkedAt: entry.checkedAt,
          responseMs: entry.responseMs,
          detail: entry.detail,
        };
      }
      setDeviceHealthById(nextHealth);

      const list = await fetchExplorerDevices();
      setDevices(list);
    } catch {
      // Health results are shown on device dots only — no inline error block.
    } finally {
      setHealthCheckLoading(false);
    }
  }, []);

  const loadDeviceTree = useCallback(async (deviceId) => {
    if (!deviceId) {
      setDeviceTree(null);
      return;
    }

    setTreeLoading(true);
    setTreeError(null);
    try {
      const tree = await fetchDeviceTree(deviceId);
      setDeviceTree(tree);
    } catch (err) {
      setDeviceTree(null);
      setTreeError(err?.message || "Failed to load device object tree");
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const loadObjectDetail = useCallback(async (objectId) => {
    if (!objectId) {
      setObjectDetail(null);
      return;
    }

    setObjectLoading(true);
    setObjectError(null);
    try {
      const detail = await fetchExplorerObject(objectId);
      setObjectDetail(detail);
    } catch (err) {
      setObjectDetail(null);
      setObjectError(err?.message || "Failed to read object properties");
    } finally {
      setObjectLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!selectedDeviceId) {
      setDeviceTree(null);
      setSelectedObjectId(null);
      setObjectDetail(null);
      setDiagnostics(null);
      return;
    }
    loadDeviceTree(selectedDeviceId);
    setSelectedObjectId(null);
    setObjectDetail(null);
    setDiagnostics(null);
    setDiagnosticsError(null);
  }, [selectedDeviceId, loadDeviceTree]);

  useEffect(() => {
    if (!selectedObjectId) {
      setObjectDetail(null);
      setObjectError(null);
      return;
    }
    loadObjectDetail(selectedObjectId);
  }, [selectedObjectId, loadObjectDetail]);

  const handleSelectDevice = (deviceId) => {
    setSelectedDeviceId(deviceId);
  };

  const handleSelectObject = (objectId) => {
    setSelectedObjectId(objectId);
  };

  const handleImportSelected = async () => {
    if (!selectedDevice) return;

    setImporting(true);
    try {
      const result = await importBacnetDiscovery({
        address: selectedDevice.address,
        deviceInstance: selectedDevice.deviceInstance,
        limit: DEFAULT_IMPORT_LIMIT,
      });
      appNotify.success(
        `Imported ${result.objectsUpserted ?? 0} objects from device ${selectedDevice.deviceInstance}`,
        { log: false }
      );
      await loadDevices();
      if (result.device?.id) {
        setSelectedDeviceId(result.device.id);
        await loadDeviceTree(result.device.id);
      } else if (selectedDeviceId) {
        await loadDeviceTree(selectedDeviceId);
      }
    } catch (err) {
      appNotify.error(err?.message || "Import discovery failed");
    } finally {
      setImporting(false);
    }
  };

  const handleImportedFromModal = async (result) => {
    appNotify.success(
      `Imported ${result.objectsUpserted ?? 0} objects from device ${result.device?.deviceInstance ?? ""}`,
      { log: false }
    );
    await loadDevices();
    if (result.device?.id) {
      setSelectedDeviceId(result.device.id);
      await loadDeviceTree(result.device.id);
    }
  };

  const handleRunDiagnostics = async () => {
    if (!selectedDevice) return;

    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      const result = await readDeviceProperties({
        address: selectedDevice.address,
        deviceInstance: selectedDevice.deviceInstance,
      });
      setDiagnostics(result);
    } catch (err) {
      setDiagnostics(null);
      setDiagnosticsError(err?.message || "Device diagnostics read failed");
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const handleManualRead = async (payload) => {
    setManualLoading(true);
    setManualError(null);
    try {
      const result = await readBacnetProperty(payload);
      setManualRead(result);
    } catch (err) {
      setManualRead(null);
      setManualError(err?.message || "Manual property read failed");
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <Container fluid className="px-0 bacnet-explorer-page">
      <div className="bacnet-explorer-page__shell">
        <div className="bacnet-explorer-page__hero px-3 px-md-4 pt-3">
          <LegionHeroHeader />
          <hr className="border-light border-opacity-25 my-3" />
        </div>

        <div className="bacnet-explorer-page__workspace px-3 px-md-4 pb-3">
          <Card className="legion-operator-log-card bg-primary border border-light border-opacity-10 shadow-sm bacnet-explorer-card">
            <Card.Header className="legion-operator-log-card-header">
              <span className="text-white fw-bold text-uppercase">
                <FontAwesomeIcon icon={faProjectDiagram} className="me-2" />
                BACnet Explorer
              </span>
            </Card.Header>
            <Card.Body className="bacnet-explorer-card__body">
              <div className="bacnet-explorer-layout">
          <DeviceListPanel
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            loading={devicesLoading}
            healthCheckLoading={healthCheckLoading}
            importing={importing}
            onRefresh={handleCheckDevicesHealth}
            onDiscover={() => setShowDiscoverModal(true)}
            onImportSelected={handleImportSelected}
            onSelectDevice={handleSelectDevice}
            deviceHealthById={deviceHealthById}
          />

          <ObjectTreePanel
            device={selectedDevice}
            groups={deviceTree?.groups || {}}
            loading={treeLoading}
            error={treeError}
            selectedObjectId={selectedObjectId}
            onSelectObject={handleSelectObject}
          />

          <ObjectDetailsPanel
            device={selectedDevice}
            selectedObject={selectedObject}
            objectDetail={objectDetail}
            objectLoading={objectLoading}
            objectError={objectError}
            onLiveRead={() => selectedObjectId && loadObjectDetail(selectedObjectId)}
            diagnostics={diagnostics}
            diagnosticsLoading={diagnosticsLoading}
            diagnosticsError={diagnosticsError}
            onRunDiagnostics={handleRunDiagnostics}
            manualRead={manualRead}
            manualLoading={manualLoading}
            manualError={manualError}
            onManualRead={handleManualRead}
          />
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <DiscoverDevicesModal
        show={showDiscoverModal}
        onHide={() => setShowDiscoverModal(false)}
        onImported={handleImportedFromModal}
      />
    </Container>
  );
}
