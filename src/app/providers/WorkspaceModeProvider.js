import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { Routes } from "../../routes";

const MODES = { operator: "operator", engineering: "engineering" };

const WorkspaceModeContext = createContext(null);

/** Engineering routes live under this prefix; everything else is treated as Operator workspace. */
function deriveModeFromPathname(pathname) {
  if (!pathname) return MODES.operator;
  return pathname.startsWith("/legion/engineering") ? MODES.engineering : MODES.operator;
}

/**
 * Mode follows the current route so Operator pages never show Engineering chrome (and vice versa)
 * when navigating via sidebar, logo, links, or history — not only via the footer toggle.
 */
export function WorkspaceModeProvider({ children }) {
  const location = useLocation();
  const history = useHistory();

  const currentMode = useMemo(
    () => deriveModeFromPathname(location.pathname),
    [location.pathname]
  );

  const setCurrentMode = useCallback((mode) => {
    if (mode === MODES.engineering) {
      history.push(Routes.EngineeringSiteBuilder.path);
      return;
    }
    if (mode === MODES.operator) {
      history.push(Routes.LegionSite.path);
    }
  }, [history]);

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
