// Legion Web — Building Automation Systems (BAS) frontend.
// Operator and Engineering modes; data layer in src/lib/data.

import "./setupProcessEnv";
import React from "react";
// Default import, not `{ createRoot }`: react-dom/client's CJS shape defeats esbuild's static
// named-export detection for its dependency pre-bundle (createRoot ends up reachable only via
// `.default`, not hoisted to the top level) — the default-import + destructure form below is the
// standard, version-independent way to avoid that Vite/esbuild interop quirk.
import ReactDOMClient from "react-dom/client";
import { HashRouter } from "react-router-dom";

const { createRoot } = ReactDOMClient;

import "./bootstrapLeaflet";
// core styles
import "./scss/volt.scss";

import AppRoutes from "./app/router/AppRoutes";
import ScrollToTop from "./app/router/ScrollToTop";
import { SiteProvider } from "./app/providers/SiteProvider";
import { EngineeringVersionProvider } from "./app/providers/EngineeringVersionProvider";
import { WorkspaceModeProvider } from "./app/providers/WorkspaceModeProvider";
import { ValidationProvider } from "./app/providers/ValidationProvider";
import { AppActivityProvider } from "./app/providers/AppActivityProvider";

// Deliberately no <React.StrictMode> here: it double-invokes effects/renders in dev, which would
// surface pre-existing non-idempotent-effect assumptions across ~140 components as NEW behavior
// changes — out of scope for a "look the same, work the same" tooling migration.
const root = createRoot(document.getElementById("root"));
root.render(
  <HashRouter>
    <AppActivityProvider>
      <SiteProvider>
        <EngineeringVersionProvider>
          <WorkspaceModeProvider>
            <ValidationProvider>
              <ScrollToTop />
              <AppRoutes />
            </ValidationProvider>
          </WorkspaceModeProvider>
        </EngineeringVersionProvider>
      </SiteProvider>
    </AppActivityProvider>
  </HashRouter>
);
