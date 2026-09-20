import React, { createContext, useContext } from "react";

const OperatorChromeContext = createContext({ hideHero: false, variant: "legacy" });

export function OperatorChromeProvider({ children, hideHero = true, variant = "shell" }) {
  return (
    <OperatorChromeContext.Provider value={{ hideHero, variant }}>
      {children}
    </OperatorChromeContext.Provider>
  );
}

export function useOperatorChrome() {
  return useContext(OperatorChromeContext);
}
