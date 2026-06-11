import React, { useState } from "react";
import {
  Button,
  Collapse,
  Form,
  Nav,
  Spinner,
} from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInfoCircle,
  faStethoscope,
  faWrench,
  faSyncAlt,
  faChevronDown,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

import { formatDisplayValue, formatObjectRef, formatTimestamp } from "../bacnetExplorerUtils";

function DetailRow({ label, value }) {
  return (
    <div className="bacnet-explorer-detail-row">
      <span className="bacnet-explorer-detail-row__label">{label}</span>
      <span className="bacnet-explorer-detail-row__value">{formatDisplayValue(value)}</span>
    </div>
  );
}

function toCachedObjectView(selectedObject, discoveredObject) {
  if (discoveredObject) return discoveredObject;
  if (!selectedObject) return null;

  return {
    objectType: selectedObject.objectType,
    objectInstance: selectedObject.objectInstance,
    objectName: selectedObject.objectName,
    description: selectedObject.description,
    presentValue: selectedObject.presentValue,
    units: selectedObject.units,
    lastReadAt: selectedObject.lastReadAt,
  };
}

function DetailsTab({
  selectedObject,
  objectDetail,
  loading,
  error,
  onLiveRead,
}) {
  const discovered = toCachedObjectView(selectedObject, objectDetail?.discoveredObject);
  const live = objectDetail?.liveProperties;

  if (!discovered) {
    return (
      <div className="bacnet-explorer-details-empty">
        Select an object to inspect cached and live values.
      </div>
    );
  }

  return (
    <div className="bacnet-explorer-details-tab">
      {error ? <div className="bacnet-explorer-error mb-3">{error}</div> : null}

      <div className="bacnet-explorer-detail-section">
        <div className="bacnet-explorer-detail-section__title">Cached Object</div>
        <DetailRow label="Object Type" value={formatObjectRef(discovered.objectType, discovered.objectInstance)} />
        <DetailRow label="Object Name" value={discovered.objectName} />
        <DetailRow label="Description" value={discovered.description} />
        <DetailRow label="Present Value" value={discovered.presentValue} />
        <DetailRow label="Units" value={discovered.units} />
        <DetailRow label="Last Read" value={formatTimestamp(discovered.lastReadAt)} />
      </div>

      <div className="bacnet-explorer-detail-section">
        <div className="bacnet-explorer-detail-section__title d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span>Live Properties</span>
          <Button
            size="sm"
            variant="outline-light"
            className="bacnet-explorer-btn"
            onClick={onLiveRead}
            disabled={loading}
          >
            {loading ? (
              <Spinner animation="border" size="sm" className="me-2" />
            ) : (
              <FontAwesomeIcon icon={faSyncAlt} className="me-2" />
            )}
            Live Read
          </Button>
        </div>

        {loading && !live ? (
          <div className="bacnet-explorer-live-loading">
            <Spinner animation="border" size="sm" />
            Reading live BACnet properties…
          </div>
        ) : null}

        <DetailRow label="Object Name" value={live?.objectName} />
        <DetailRow label="Description" value={live?.description} />
        <DetailRow label="Present Value" value={live?.presentValue} />
        <DetailRow label="Units" value={live?.units} />
        <DetailRow label="Reliability" value={live?.reliability} />
        <DetailRow label="Out of Service" value={live?.outOfService} />
      </div>
    </div>
  );
}

function PropertyErrors({ errors = {} }) {
  const entries = Object.entries(errors);
  if (!entries.length) return null;

  return (
    <div className="bacnet-explorer-errors mt-3">
      <div className="bacnet-explorer-errors__title">Property Errors</div>
      {entries.map(([key, message]) => (
        <div key={key} className="bacnet-explorer-errors__item">
          <span className="bacnet-explorer-errors__key">{key}</span>
          <span className="bacnet-explorer-errors__msg">{message}</span>
        </div>
      ))}
    </div>
  );
}

function DiagnosticsTab({
  device,
  diagnostics,
  loading,
  error,
  onRunDiagnostics,
}) {
  const properties = diagnostics?.properties || {};
  const objectListCount = Array.isArray(properties.objectList) ? properties.objectList.length : null;

  if (!device) {
    return (
      <div className="bacnet-explorer-details-empty">
        Select a device to run BACnet diagnostics.
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="small bacnet-explorer-muted">
          {device.address} · Device {device.deviceInstance}
        </div>
        <Button
          size="sm"
          variant="outline-light"
          className="bacnet-explorer-btn"
          onClick={onRunDiagnostics}
          disabled={loading}
        >
          {loading ? (
            <Spinner animation="border" size="sm" className="me-2" />
          ) : (
            <FontAwesomeIcon icon={faSyncAlt} className="me-2" />
          )}
          Run Diagnostics
        </Button>
      </div>

      {loading && !diagnostics ? (
        <div className="bacnet-explorer-empty">
          <Spinner animation="border" size="sm" className="me-2" />
          Reading device properties…
        </div>
      ) : null}

      {error ? <div className="bacnet-explorer-error">{error}</div> : null}

      {diagnostics ? (
        <>
          <div className="bacnet-explorer-detail-section">
            <div className="bacnet-explorer-detail-section__title">Device Identity</div>
            <DetailRow label="Object Name" value={properties.objectName} />
            <DetailRow label="Description" value={properties.description} />
            <DetailRow label="Vendor Name" value={properties.vendorName} />
            <DetailRow label="Model Name" value={properties.modelName} />
            <DetailRow label="Firmware Revision" value={properties.firmwareRevision} />
            <DetailRow label="Application Software" value={properties.applicationSoftwareVersion} />
            <DetailRow label="Protocol Version" value={properties.protocolVersion} />
            <DetailRow label="Protocol Revision" value={properties.protocolRevision} />
            <DetailRow label="Max APDU Length" value={properties.maxApduLengthAccepted} />
            <DetailRow label="Segmentation" value={properties.segmentationSupported} />
            <DetailRow label="Object List Count" value={objectListCount} />
          </div>

          <div className="bacnet-explorer-detail-section">
            <div className="bacnet-explorer-detail-section__title">Protocol Services Supported</div>
            <pre className="bacnet-explorer-code-block">
              {formatDisplayValue(properties.protocolServicesSupported)}
            </pre>
          </div>

          <div className="bacnet-explorer-detail-section">
            <div className="bacnet-explorer-detail-section__title">Protocol Object Types Supported</div>
            <pre className="bacnet-explorer-code-block">
              {formatDisplayValue(properties.protocolObjectTypesSupported)}
            </pre>
          </div>

          <PropertyErrors errors={diagnostics.errors} />
        </>
      ) : null}
    </div>
  );
}

function ManualReadSection({
  device,
  selectedObject,
  manualRead,
  manualLoading,
  manualError,
  onManualRead,
}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectInstance, setObjectInstance] = useState("");
  const [property, setProperty] = useState("presentValue");

  React.useEffect(() => {
    if (device?.address) setAddress(device.address);
  }, [device?.address]);

  React.useEffect(() => {
    if (selectedObject?.objectType) setObjectType(selectedObject.objectType);
    if (selectedObject?.objectInstance != null) {
      setObjectInstance(String(selectedObject.objectInstance));
    }
  }, [selectedObject?.id, selectedObject?.objectType, selectedObject?.objectInstance]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onManualRead({
      address: address.trim(),
      objectType: objectType.trim(),
      objectInstance: Number(objectInstance),
      property: property.trim(),
    });
  };

  return (
    <div className="bacnet-explorer-manual-read">
      <button
        type="button"
        className="bacnet-explorer-manual-read__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} className="me-2" />
        <FontAwesomeIcon icon={faWrench} className="me-2" />
        Manual Read Property
      </button>

      <Collapse in={open}>
        <div className="bacnet-explorer-manual-read__body">
          <Form onSubmit={handleSubmit}>
            <div className="bacnet-explorer-manual-read__grid">
              <Form.Control
                size="sm"
                className="legion-operator-log-field"
                placeholder="Address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
              <Form.Control
                size="sm"
                className="legion-operator-log-field"
                placeholder="Object Type"
                value={objectType}
                onChange={(event) => setObjectType(event.target.value)}
              />
              <Form.Control
                size="sm"
                className="legion-operator-log-field"
                placeholder="Instance"
                value={objectInstance}
                onChange={(event) => setObjectInstance(event.target.value)}
              />
              <Form.Control
                size="sm"
                className="legion-operator-log-field"
                placeholder="Property"
                value={property}
                onChange={(event) => setProperty(event.target.value)}
              />
            </div>
            <Button
              size="sm"
              type="submit"
              variant="outline-light"
              className="bacnet-explorer-btn mt-2"
              disabled={manualLoading}
            >
              {manualLoading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
              Read Property
            </Button>
          </Form>

          {manualError ? <div className="bacnet-explorer-error mt-2">{manualError}</div> : null}

          {manualRead ? (
            <div className="bacnet-explorer-manual-read__result mt-3">
              <DetailRow label="Property" value={manualRead.property} />
              <DetailRow label="Value" value={manualRead.value} />
              <DetailRow label="Timestamp" value={formatTimestamp(manualRead.timestamp)} />
              <div className="bacnet-explorer-detail-section__title mt-2">Raw Value</div>
              <pre className="bacnet-explorer-code-block">{formatDisplayValue(manualRead.rawValue)}</pre>
            </div>
          ) : null}
        </div>
      </Collapse>
    </div>
  );
}

export default function ObjectDetailsPanel({
  device,
  selectedObject,
  objectDetail,
  objectLoading,
  objectError,
  onLiveRead,
  diagnostics,
  diagnosticsLoading,
  diagnosticsError,
  onRunDiagnostics,
  manualRead,
  manualLoading,
  manualError,
  onManualRead,
}) {
  const [activeTab, setActiveTab] = useState("details");

  return (
    <div className="bacnet-explorer-panel bacnet-explorer-panel--details">
      <div className="bacnet-explorer-panel__header legion-operator-log-card-header">
        <div className="bacnet-explorer-panel__title text-white fw-bold text-uppercase">
          <FontAwesomeIcon icon={faInfoCircle} className="me-2 opacity-75" />
          Details
        </div>
      </div>

      <div className="bacnet-explorer-panel__main">
        <Nav variant="tabs" className="bacnet-explorer-tabs">
          <Nav.Item>
            <Nav.Link
              active={activeTab === "details"}
              onClick={() => setActiveTab("details")}
            >
              Object
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeTab === "diagnostics"}
              onClick={() => setActiveTab("diagnostics")}
            >
              <FontAwesomeIcon icon={faStethoscope} className="me-1" />
              Diagnostics
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <div className="bacnet-explorer-panel__body bacnet-explorer-panel__body--details">
          {activeTab === "details" ? (
            <DetailsTab
              selectedObject={selectedObject}
              objectDetail={objectDetail}
              loading={objectLoading}
              error={objectError}
              onLiveRead={onLiveRead}
            />
          ) : (
            <DiagnosticsTab
              device={device}
              diagnostics={diagnostics}
              loading={diagnosticsLoading}
              error={diagnosticsError}
              onRunDiagnostics={onRunDiagnostics}
            />
          )}
        </div>
      </div>

      <div className="bacnet-explorer-panel__footer">
        <ManualReadSection
          device={device}
          selectedObject={selectedObject}
          manualRead={manualRead}
          manualLoading={manualLoading}
          manualError={manualError}
          onManualRead={onManualRead}
        />
      </div>
    </div>
  );
}
