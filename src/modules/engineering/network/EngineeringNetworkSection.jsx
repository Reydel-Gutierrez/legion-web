import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Container } from "react-bootstrap";

import NetworkDiscoveryPage from "../network-discovery/NetworkDiscoveryPage";
import NetworkConfigurationPage from "../network-configuration/NetworkConfigurationPage";

export default function EngineeringNetworkSection() {
  // v6 nested <Routes> match relative to where this component is mounted (the parent Route's
  // path ends in "/*" — see AppRoutes.js) — no useRouteMatch/path-concatenation needed anymore.
  return (
    <Container fluid className="px-0">
      <Routes>
        <Route index element={<Navigate to="discovery" replace />} />
        <Route path="discovery" element={<NetworkDiscoveryPage />} />
        <Route path="configuration" element={<NetworkConfigurationPage />} />
      </Routes>
    </Container>
  );
}
