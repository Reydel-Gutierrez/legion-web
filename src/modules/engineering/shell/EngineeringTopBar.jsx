import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faFileAlt, faPen, faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
import { Routes } from "../../../routes";
import { accessRepository } from "../../../lib/data";
import { useWorkspaceMode } from "../../../app/providers/WorkspaceModeProvider";
import { useAppActivity } from "../../../app/providers/AppActivityProvider";
import { useEngineeringArchive } from "../../../app/providers/EngineeringArchiveProvider";
import { useEngineeringSiteTree } from "./EngineeringSiteTreeContext";
import EngineeringGlobalSearch from "./EngineeringGlobalSearch";
import EngineeringToolsMenu from "./EngineeringToolsMenu";
import DashboardModeSelector from "../../operator/shell/DashboardModeSelector";
import OperatorHelpModal from "../../operator/shell/OperatorHelpModal";
import NameArchiveModal from "./components/NameArchiveModal";
import UnsavedArchiveChangesModal from "./components/UnsavedArchiveChangesModal";

/** Keeps rendering the last non-null value while a Bootstrap modal's exit transition plays, so its
 * body doesn't flash blank the instant the provider clears the state that closes it. */
function useLatchedValue(value) {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return ref.current;
}

function initialsFromName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "LC";
}

export default function EngineeringTopBar() {
  const navigate = useNavigate();
  const { setCurrentMode } = useWorkspaceMode();
  const { openLogs } = useAppActivity();
  const { handleValidate, setGenerateModalField, setGenerateStartInput } = useEngineeringSiteTree();
  const {
    activeArchive,
    hasArchiveOpen,
    startNewArchive,
    closeActiveArchive,
    saveActiveArchive,
    renameActiveArchive,
    importArchiveFile,
    exportActiveArchive,
    nameModal,
    unsavedGuard,
  } = useEngineeringArchive();
  const latchedNameModal = useLatchedValue(nameModal);
  const latchedUnsavedGuard = useLatchedValue(unsavedGuard);
  const [userOpen, setUserOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const importInputRef = useRef(null);

  const currentUser = (() => {
    try {
      return accessRepository.getCurrentUserForAccess();
    } catch {
      return { fullName: "Engineer", roleName: "Engineer" };
    }
  })();

  const handleModeChange = useCallback(
    (mode) => {
      if (mode === "engineering") return;
      setCurrentMode("operator");
    },
    [setCurrentMode]
  );

  const handleAction = useCallback(
    (action) => {
      if (action === "save") {
        saveActiveArchive();
      } else if (action === "newArchive") {
        startNewArchive();
      } else if (action === "closeArchive") {
        closeActiveArchive();
      } else if (action === "importArchive") {
        importInputRef.current?.click();
      } else if (action === "exportArchive") {
        exportActiveArchive();
      } else if (action === "validateStructure") {
        handleValidate();
      } else if (action === "generateInstanceNumbers") {
        setGenerateModalField("instanceNumber");
        setGenerateStartInput("");
      } else if (action === "generateAddressNumbers") {
        setGenerateModalField("address");
        setGenerateStartInput("");
      }
    },
    [
      saveActiveArchive,
      startNewArchive,
      closeActiveArchive,
      exportActiveArchive,
      handleValidate,
      setGenerateModalField,
      setGenerateStartInput,
    ]
  );

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) importArchiveFile(file);
  };

  return (
    <header className="operator-topbar">
      <DashboardModeSelector currentUser={currentUser} value="engineering" onChange={handleModeChange} />

      <EngineeringToolsMenu onAction={handleAction} />

      <EngineeringGlobalSearch />

      <div className="operator-topbar__right">
        {hasArchiveOpen && activeArchive ? (
          <button
            type="button"
            className="engineering-archive-name"
            onClick={renameActiveArchive}
            title="Click to rename this archive"
          >
            <span className="engineering-archive-name__label">{activeArchive.name}</span>
            <FontAwesomeIcon icon={faPen} className="engineering-archive-name__icon" />
          </button>
        ) : null}
        <button type="button" className="operator-topbar__text-btn" onClick={openLogs}>
          <FontAwesomeIcon icon={faFileAlt} />
          <span>Logs</span>
        </button>
        <button type="button" className="operator-topbar__icon-btn" aria-label="Help" onClick={() => setHelpOpen(true)}>
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>

        <div className="operator-topbar__menu-wrap">
          <button type="button" className="operator-user" onClick={() => setUserOpen((v) => !v)}>
            <span className="operator-user__avatar">{initialsFromName(currentUser.fullName)}</span>
            <span className="operator-user__meta">
              <span className="operator-user__name">{currentUser.fullName || "Engineer"}</span>
              <span className="operator-user__role">{currentUser.roleName || "Engineering"}</span>
            </span>
            <FontAwesomeIcon icon={faChevronDown} className="operator-user__chevron" />
          </button>
          {userOpen ? (
            <div className="operator-menu">
              <button
                type="button"
                className="operator-menu__item"
                onClick={() => {
                  setUserOpen(false);
                  navigate(Routes.LegionSettings.path);
                }}
              >
                Settings
              </button>
              <button
                type="button"
                className="operator-menu__item"
                onClick={() => {
                  setUserOpen(false);
                  setCurrentMode("operator");
                }}
              >
                Switch to Operator Dashboard
              </button>
              <button
                type="button"
                className="operator-menu__item operator-menu__item--danger"
                onClick={() => navigate("/login")}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />

      <OperatorHelpModal show={helpOpen} onHide={() => setHelpOpen(false)} />

      <NameArchiveModal
        show={Boolean(nameModal)}
        title={latchedNameModal?.title}
        confirmLabel={latchedNameModal?.confirmLabel}
        defaultName={latchedNameModal?.defaultName}
        excludeId={latchedNameModal?.excludeId}
        onConfirm={(name) => latchedNameModal?.onConfirm(name)}
        onCancel={() => latchedNameModal?.onCancel()}
      />

      <UnsavedArchiveChangesModal
        show={Boolean(unsavedGuard)}
        label={latchedUnsavedGuard?.label}
        onSave={() => latchedUnsavedGuard?.onSave()}
        onDiscard={() => latchedUnsavedGuard?.onDiscard()}
        onCancel={() => latchedUnsavedGuard?.onCancel()}
      />
    </header>
  );
}
