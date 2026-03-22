import React, { useState } from "react";
import { useSite } from "../../../app/providers/SiteProvider";
import { Container, Row, Col, Card, Alert, Button } from "@themesberg/react-bootstrap";
import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import { useTrendWorkspace } from "./useTrendWorkspace";
import TrendToolbar from "./components/TrendToolbar";
import TrendConfigPanel from "./components/TrendConfigPanel";
import TrendChartPanel from "./components/TrendChartPanel";
import TrendSummaryCard from "./components/TrendSummaryCard";
import TrendTemplateModal from "./components/TrendTemplateModal";
import TrendManageTemplatesModal from "./components/TrendManageTemplatesModal";
import TrendAssignModal from "./components/TrendAssignModal";

export default function TrendsPage() {
  const { site } = useSite();
  const ws = useTrendWorkspace(site);

  const {
    trendSessionActive,
    trendCollecting,
    historyLoggingActive,
    filteredEquipment,
    equipSearch,
    setEquipSearch,
    selectedEquipmentId,
    setSelectedEquipmentId,
    selectedEquipment,
    catalog,
    definition,
    assignedTrendChips,
    selectedAssignmentId,
    selectAssignment,
    templateDefinitions,
    range,
    setRange,
    trendBundle,
    timeLabels,
    series,
    showPoints,
    setPointIds,
    latestByPoint,
    modal,
    setModal,
    showAssign,
    setShowAssign,
    assignTemplateId,
    setAssignTemplateId,
    openNewTrendModal,
    saveChanges,
    hasUnsavedDefinitionChanges,
    openSaveAsTemplateModal,
    openEditTemplateModal,
    confirmModal,
    duplicateTrend,
    openAssignTemplateModal,
    renameTemplate,
    deleteTemplate,
    enterTemplateEditorView,
    exitTemplateEditorView,
    isTemplateEditorMode,
    applyTemplateToEquipment,
    assignmentSummary,
    workspaceState,
    updateBands,
    patchOverlay,
    setChartStyle,
    recordingActive,
    recordingDurationDays,
    startTrendRecording,
    stopRecording,
    equipmentList,
    groups,
  } = ws;

  const events = trendBundle?.events || [];

  const [manageTemplatesOpen, setManageTemplatesOpen] = useState(false);

  const stateBanner =
    workspaceState === "no_equipment" ? (
      <Alert variant="warning" className="bg-dark border border-warning border-opacity-25 text-white mb-0 py-2">
        Search and select an asset to load assigned trends and chart data.
      </Alert>
    ) : workspaceState === "no_assignments" ? (
      <Alert variant="secondary" className="bg-dark border border-light border-opacity-25 text-white mb-0 py-2">
        No trends assigned to this asset yet. Create a new trend for this equipment or apply a saved template — assignments persist when you leave and return.
      </Alert>
    ) : workspaceState === "recording_not_started" ? (
      <Alert variant="warning" className="bg-dark border border-warning border-opacity-25 text-white mb-0 py-2">
        Points are selected, but recording has not started. In the panel below, click <strong>Start recording</strong>, choose how long the session should run, then confirm with <strong>Start trend</strong>.
      </Alert>
    ) : workspaceState === "collecting_history" ? (
      <Alert variant="info" className="bg-dark border border-info border-opacity-25 text-white mb-0 py-2">
        Collecting history for this assignment — the chart will fill as samples arrive (mock). Live point values still update below.
      </Alert>
    ) : workspaceState === "no_data" ? (
      <Alert variant="secondary" className="bg-dark border border-light border-opacity-25 text-white mb-0 py-2">
        No historical samples for this range (mock). Try the 14D range or wait for more samples after starting the trend.
      </Alert>
    ) : workspaceState === "no_points" ? (
      <Alert variant="info" className="bg-dark border border-info border-opacity-25 text-white mb-0 py-2">
        No points in this trend yet. Click <strong>Add points to trend</strong> to choose BACnet points for the open equipment.
      </Alert>
    ) : workspaceState === "template_editor" ? (
      <Alert variant="info" className="bg-dark border border-info border-opacity-25 text-white mb-0 py-2">
        You are editing <strong>template settings</strong> without an asset. Charts and recording are available after you select equipment or assign this template. Use <strong>Back to asset trends</strong> in the toolbar to return.
      </Alert>
    ) : null;

  const showEmptyActions = selectedEquipmentId && workspaceState === "no_assignments";

  return (
    <Container fluid className="px-0 trends-page">
      <div className="px-2 px-xl-3 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <div className="px-2 px-xl-3 pb-4 mt-2">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h6 className="text-white fw-bold mb-1">Trends</h6>
            <div className="text-white small">
              Trends are saved definitions linked to equipment through assignments. Open an asset to see its assigned trends; configure once and they load automatically next time (mock persistence per site).
            </div>
            <div className="text-white small opacity-75 mt-1">
              {isTemplateEditorMode ? (
                <>
                  <span className="text-white fw-semibold">Template settings (no asset)</span>
                  {" · "}
                  <span className="text-white">{definition.name}</span>
                  <span className="badge bg-info bg-opacity-25 border border-info border-opacity-50 ms-2">Reusable template</span>
                </>
              ) : trendSessionActive && selectedEquipment ? (
                <>
                  <span className="text-white fw-semibold">{selectedEquipment.label}</span>
                  {" · "}
                  <span className="text-white">{definition.name}</span>
                  {definition.isTemplate ? (
                    <span className="badge bg-info bg-opacity-25 border border-info border-opacity-50 ms-2">Template definition</span>
                  ) : null}
                  {recordingActive ? (
                    <span className="badge bg-success bg-opacity-25 border border-success border-opacity-50 ms-2">14-day recording active</span>
                  ) : trendSessionActive && definition.pointIds?.length ? (
                    <span className="badge bg-warning bg-opacity-25 border border-warning border-opacity-50 ms-2">Recording not started</span>
                  ) : (
                    <span className="badge bg-secondary bg-opacity-25 border border-light border-opacity-25 ms-2">No recording</span>
                  )}
                  {historyLoggingActive ? (
                    <span className="badge bg-info bg-opacity-25 border border-info border-opacity-50 ms-2">History samples</span>
                  ) : null}
                </>
              ) : selectedEquipmentId ? (
                <span className="text-white">Asset selected — add a trend or apply a template.</span>
              ) : (
                <span className="text-white">Select an asset to begin, or use Template editor / Manage templates → Edit settings.</span>
              )}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {trendSessionActive || isTemplateEditorMode ? (
              <span className="badge bg-primary border border-light border-opacity-25 text-white">Range: {range}</span>
            ) : null}
            <Button
              size="sm"
              variant="outline-light"
              className="border-opacity-10"
              onClick={() => setManageTemplatesOpen(true)}
              disabled={!templateDefinitions.length}
              title={!templateDefinitions.length ? "Save a template first" : "Rename, delete, or open template settings"}
            >
              Manage templates
            </Button>
            <Button
              size="sm"
              variant="light"
              className="text-primary fw-semibold"
              disabled={!templateDefinitions.length}
              title={!templateDefinitions.length ? "Save a template first" : "Edit a template without selecting an asset"}
              onClick={() => {
                const first = templateDefinitions[0];
                if (first) enterTemplateEditorView(first.id);
              }}
            >
              Template editor
            </Button>
            <Button
              size="sm"
              variant="outline-light"
              className="border-opacity-10"
              onClick={() => setManageTemplatesOpen(true)}
              disabled={!templateDefinitions.length}
              title={!templateDefinitions.length ? "Save a template first" : "Rename or delete saved templates"}
            >
              Manage templates
            </Button>
          </div>
        </div>

        {stateBanner ? <div className="mb-2">{stateBanner}</div> : null}

        {showEmptyActions ? (
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Button size="sm" variant="light" className="text-primary fw-semibold" onClick={openNewTrendModal}>
              New Trend
            </Button>
            <Button
              size="sm"
              variant="outline-light"
              className="border-opacity-10"
              onClick={openAssignTemplateModal}
              disabled={!templateDefinitions.length}
            >
              Apply Template
            </Button>
          </div>
        ) : null}

        <Row className="g-2">
          <Col xs={12}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm">
              <Card.Body className="py-3 px-3">
                <div className="text-white fw-semibold small mb-2">Trend workspace</div>
                <TrendToolbar
                  equipSearch={equipSearch}
                  onEquipSearchChange={setEquipSearch}
                  equipmentOptions={filteredEquipment}
                  selectedEquipmentId={selectedEquipmentId}
                  onEquipmentChange={setSelectedEquipmentId}
                  assignedTrends={assignedTrendChips}
                  selectedAssignmentId={selectedAssignmentId}
                  onAssignmentSelect={selectAssignment}
                  onNewTrend={openNewTrendModal}
                  onSaveChanges={saveChanges}
                  hasUnsavedDefinitionChanges={hasUnsavedDefinitionChanges}
                  definitionIsTemplate={definition.isTemplate}
                  onSaveAsTemplate={openSaveAsTemplateModal}
                  onAssignTemplate={openAssignTemplateModal}
                  assignTemplateDisabled={!templateDefinitions.length || !selectedEquipmentId}
                  assignTemplateTitle={
                    !selectedEquipmentId
                      ? "Select an asset first — assignment applies to the open equipment"
                      : !templateDefinitions.length
                      ? "Save a template first (Save as Template)"
                      : undefined
                  }
                  onDuplicateTrend={duplicateTrend}
                  onEditTrend={openEditTemplateModal}
                  range={range}
                  onRangeChange={setRange}
                  sessionActive={trendSessionActive}
                  templateEditorMode={isTemplateEditorMode}
                  templateName={definition.name}
                  onExitTemplateEditor={exitTemplateEditorView}
                />
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} lg={8}>
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm h-100">
              <Card.Body className="py-3 px-3">
                <TrendConfigPanel
                  equipmentLabel={selectedEquipment?.label || ""}
                  equipmentDisplayName={selectedEquipment?.name || selectedEquipment?.label?.split("·")[0]?.trim() || ""}
                  catalog={catalog}
                  pointIds={definition.pointIds || []}
                  onPointIdsChange={setPointIds}
                  latestByPoint={latestByPoint}
                  referenceBands={definition.referenceBands || []}
                  onBandsChange={updateBands}
                  overlaySettings={definition.overlaySettings}
                  onOverlayChange={patchOverlay}
                  chartStyle={definition.chartStyle || "line"}
                  onChartStyleChange={setChartStyle}
                  assignmentSummary={assignmentSummary}
                  sessionActive={trendSessionActive}
                  recordingActive={recordingActive}
                  recordingDurationDays={recordingDurationDays}
                  onStartRecording={startTrendRecording}
                  onStopRecording={stopRecording}
                />
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} lg={4}>
            <TrendSummaryCard
              series={series}
              showPoints={showPoints}
              referenceBands={definition.referenceBands || []}
              events={events}
              sessionActive={trendSessionActive}
            />
            <Card className="bg-primary border border-light border-opacity-10 shadow-sm mt-3">
              <Card.Body className="py-2 px-3">
                <div className="text-white fw-semibold small mb-1">Templates &amp; bulk assignment</div>
                <div className="text-white small opacity-90 mb-0">
                  Save as template, then use <strong>Assign Template</strong> to attach the same definition to many assets. Use <strong>Manage templates</strong> in the header to rename or remove saved templates. Each asset keeps its own assignment and logging context.
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Full-bleed chart: outside horizontal padding so the plot uses the full trends workspace width */}
      <div className="px-0 pb-4 mt-2">
        <TrendChartPanel
          timeLabels={timeLabels}
          series={series}
          showPoints={showPoints}
          range={range}
          chartTimestamps={trendBundle?.timestamps}
          referenceBands={definition.referenceBands || []}
          events={events}
          overlaySettings={definition.overlaySettings}
          sessionActive={trendSessionActive}
          collecting={trendCollecting}
          templateSettingsMode={isTemplateEditorMode}
          title={
            isTemplateEditorMode
              ? `Template · ${definition.name}`
              : trendSessionActive
                ? `${selectedEquipment?.name || selectedEquipment?.id || "Asset"} · ${definition.name}`
                : `${selectedEquipment?.name || selectedEquipment?.id || "Asset"} — no trend selected`
          }
        />
      </div>

      <TrendManageTemplatesModal
        show={manageTemplatesOpen}
        onHide={() => setManageTemplatesOpen(false)}
        templates={templateDefinitions.map((t) => ({ id: t.id, name: t.name }))}
        onRename={renameTemplate}
        onDelete={deleteTemplate}
        onEditTemplate={enterTemplateEditorView}
      />

      <TrendTemplateModal
        show={!!modal}
        mode={modal?.mode || "new"}
        highlightUnsaved={hasUnsavedDefinitionChanges && !!modal && modal.mode !== "new"}
        initialName={modal?.name || definition.name}
        initialAsTemplate={
          modal?.mode === "edit" ? modal?.asTemplate ?? definition.isTemplate : modal?.asTemplate ?? false
        }
        initialAssignToAsset={modal?.assignToAsset ?? false}
        showAssignToAsset={modal?.mode === "saveTemplate" && !!selectedEquipmentId}
        onHide={() => setModal(null)}
        onConfirm={confirmModal}
      />

      <TrendAssignModal
        show={showAssign}
        onHide={() => setShowAssign(false)}
        equipmentList={equipmentList}
        groups={groups}
        currentEquipmentId={selectedEquipmentId}
        currentEquipmentLabel={selectedEquipment?.label || ""}
        sameTemplateKey={selectedEquipment?.templateKey}
        templates={templateDefinitions.map((t) => ({ id: t.id, name: t.name }))}
        selectedTemplateId={assignTemplateId}
        onTemplateChange={setAssignTemplateId}
        onApply={(payload) => applyTemplateToEquipment(payload.trendDefinitionId, payload.equipmentIds)}
      />
    </Container>
  );
}
