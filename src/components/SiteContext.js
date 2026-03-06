import React, { createContext, useState, useContext, useEffect } from "react";

const SiteContext = createContext(null);

export function SiteProvider({ children }) {
  const [site, setSite] = useState(
    () => localStorage.getItem("legionSite") || "Miami HQ"
  );

  useEffect(() => {
    localStorage.setItem("legionSite", site);
  }, [site]);

  return (
    <SiteContext.Provider value={{ site, setSite }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return ctx;
}
