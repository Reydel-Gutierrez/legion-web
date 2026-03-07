import React, { createContext, useState, useContext, useEffect } from "react";

const WORKSPACE_MODE_KEY = "workspaceMode";
const MODES = { operator: "operator", engineering: "engineering" };

const WorkspaceModeContext = createContext(null);

export function WorkspaceModeProvider({ children }) {
  const [currentMode, setCurrentModeState] = useState(() => {
    const stored = localStorage.getItem(WORKSPACE_MODE_KEY);
    return stored === MODES.engineering ? MODES.engineering : MODES.operator;
  });

  useEffect(() => {
    localStorage.setItem(WORKSPACE_MODE_KEY, currentMode);
  }, [currentMode]);

  const setCurrentMode = (mode) => {
    if (mode === MODES.operator || mode === MODES.engineering) {
      setCurrentModeState(mode);
    }
  };

  return (
    <WorkspaceModeContext.Provider value={{ currentMode, setCurrentMode }}>
      {children}
    </WorkspaceModeContext.Provider>
  );
}

export function useWorkspaceMode() {
  const ctx = useContext(WorkspaceModeContext);
  if (!ctx) {
    throw new Error("useWorkspaceMode must be used within a WorkspaceModeProvider");
  }
  return ctx;
}

export { MODES };
