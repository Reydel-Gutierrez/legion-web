import React, { createContext, useState, useContext, useCallback } from "react";

const ValidationContext = createContext(null);

/**
 * Stores validation summary (errors, warnings, readiness) so Header and Deployment page
 * can react to validation state. ValidationCenterPage updates this when validation runs.
 */
export function ValidationProvider({ children }) {
  const [validationSnapshot, setValidationSnapshot] = useState({
    lastRunAt: null,
    summary: { errors: 0, warnings: 0 },
    readiness: null,
  });

  const setValidationState = useCallback(({ summary, readiness, lastRunAt }) => {
    setValidationSnapshot({
      lastRunAt: lastRunAt ?? null,
      summary: summary ? { errors: summary.errors ?? 0, warnings: summary.warnings ?? 0 } : { errors: 0, warnings: 0 },
      readiness: readiness ?? null,
    });
  }, []);

  const hasBlockingErrors = validationSnapshot.summary.errors > 0;

  return (
    <ValidationContext.Provider
      value={{
        validationSnapshot,
        setValidationState,
        hasBlockingErrors,
      }}
    >
      {children}
    </ValidationContext.Provider>
  );
}

export function useValidation() {
  const ctx = useContext(ValidationContext);
  if (!ctx) {
    throw new Error("useValidation must be used within a ValidationProvider");
  }
  return ctx;
}
