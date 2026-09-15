import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Container } from "react-bootstrap";

import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import NetworkDiscoveryPage from "../network-discovery/NetworkDiscoveryPage";
import NetworkConfigurationPage from "../network-configuration/NetworkConfigurationPage";

export default function EngineeringNetworkSection() {
  // v6 nested <Routes> match relative to where this component is mounted (the parent Route's
  // path ends in "/*" — see AppRoutes.js) — no useRouteMatch/path-concatenation needed anymore.
  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <Routes>
        <Route index element={<Navigate to="discovery" replace />} />
        <Route path="discovery" element={<NetworkDiscoveryPage />} />
        <Route path="configuration" element={<NetworkConfigurationPage />} />
      </Routes>
    </Container>
  );
}
