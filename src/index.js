// Legion Web — Building Automation Systems (BAS) frontend.
// Operator and Engineering modes; data layer in src/lib/data.

import React from "react";
import ReactDOM from "react-dom";
import { HashRouter } from "react-router-dom";

import "./bootstrapLeaflet";
// core styles
import "./scss/volt.scss";
// vendor styles
import "react-datetime/css/react-datetime.css";

import AppRoutes from "./app/router/AppRoutes";
import ScrollToTop from "./app/router/ScrollToTop";
import { SiteProvider } from "./app/providers/SiteProvider";
import { EngineeringVersionProvider } from "./app/providers/EngineeringVersionProvider";
import { WorkspaceModeProvider } from "./app/providers/WorkspaceModeProvider";
import { ValidationProvider } from "./app/providers/ValidationProvider";

ReactDOM.render(
  <HashRouter>
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
  </HashRouter>,
  document.getElementById("root")
);
