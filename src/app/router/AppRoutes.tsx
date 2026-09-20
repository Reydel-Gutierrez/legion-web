import React, { useState, useEffect, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Routes as AppRoutePaths } from "../../routes";

import LegionDashboard from "../../modules/operator/dashboard/DashboardPage";
import LegionEquipment from "../../modules/operator/equipment/EquipmentPage";
import LegionAlarms from "../../modules/operator/alarms/AlarmsPage";
import LegionTrends from "../../modules/operator/trends/TrendsPage";
import LegionSchedules from "../../modules/operator/schedules/SchedulesPage";
import LegionEvents from "../../modules/operator/events/EventsPage";
import LegionUsers from "../../modules/operator/users/UsersPage";
import LegionSettings from "../../modules/operator/settings/SettingsPage";
import OperatorShell from "../../modules/operator/shell/OperatorShell";

import SiteBuilderPage from "../../modules/engineering/site-builder/SiteBuilderPage";
import ArchiveManagerPage from "../../modules/engineering/archive-manager/ArchiveManagerPage";
import EngineeringNetworkSection from "../../modules/engineering/network/EngineeringNetworkSection";
import PointMappingPage from "../../modules/engineering/point-mapping/PointMappingPage";
import GraphicsManagerPage from "../../modules/engineering/graphics-manager/GraphicsManagerPage";
import TemplateLibraryPage from "../../modules/engineering/template-library/TemplateLibraryPage";
import ValidationCenterPage from "../../modules/engineering/validation-center/ValidationCenterPage";
import DeploymentPage from "../../modules/engineering/deployment/DeploymentPage";
import UserManagerPage from "../../modules/engineering/user-manager/UserManagerPage";
import BacnetExplorerPage from "../../modules/engineering/bacnet-explorer/BacnetExplorerPage";
import EngineeringShell from "../../modules/engineering/shell/EngineeringShell";

import Preloader from "../layout/Preloader";

/** react-router-dom v6 has no <Redirect> — replaced by <Navigate>, used as a Route's element. */
function LegacyNetworkDiscoveryRedirect() {
  return <Navigate to={AppRoutePaths.EngineeringNetworkDiscovery.path} replace />;
}
function LegacyNetworkConfigurationRedirect() {
  return <Navigate to={AppRoutePaths.EngineeringNetworkConfiguration.path} replace />;
}

/**
 * v6 layout wrappers: Route no longer takes a `render`/`component` prop, so these are now plain
 * components used as a Route's `element` (e.g. `element={<RouteWithEngineeringShell><Page /></RouteWithEngineeringShell>}`)
 * instead of wrapping <Route> themselves.
 */
function RouteWithEngineeringShell({ children }: { children?: ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Preloader show={!loaded} />
      <EngineeringShell>{children ?? null}</EngineeringShell>
    </>
  );
}

function RouteWithOperatorShell({ children }: { children?: ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Preloader show={!loaded} />
      <OperatorShell>{children ?? null}</OperatorShell>
    </>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={AppRoutePaths.LegionSite.path} replace />} />

      <Route
        path={AppRoutePaths.LegionDashboard.path}
        element={
          <RouteWithOperatorShell>
            <LegionDashboard />
          </RouteWithOperatorShell>
        }
      />
      <Route path={AppRoutePaths.LegionSite.path} element={<RouteWithOperatorShell />} />
      <Route
        path={AppRoutePaths.LegionEquipment.path}
        element={
          <RouteWithOperatorShell>
            <LegionEquipment />
          </RouteWithOperatorShell>
        }
      />
      <Route path={AppRoutePaths.LegionEquipmentDetail.path} element={<RouteWithOperatorShell />} />
      <Route
        path={AppRoutePaths.LegionAlarms.path}
        element={
          <RouteWithOperatorShell>
            <LegionAlarms />
          </RouteWithOperatorShell>
        }
      />
      <Route
        path={AppRoutePaths.LegionTrends.path}
        element={
          <RouteWithOperatorShell>
            <LegionTrends />
          </RouteWithOperatorShell>
        }
      />
      <Route
        path={AppRoutePaths.LegionSchedules.path}
        element={
          <RouteWithOperatorShell>
            <LegionSchedules />
          </RouteWithOperatorShell>
        }
      />
      <Route
        path={AppRoutePaths.LegionEvents.path}
        element={
          <RouteWithOperatorShell>
            <LegionEvents />
          </RouteWithOperatorShell>
        }
      />
      <Route
        path={AppRoutePaths.LegionUsers.path}
        element={
          <RouteWithOperatorShell>
            <LegionUsers />
          </RouteWithOperatorShell>
        }
      />
      <Route
        path={AppRoutePaths.LegionSettings.path}
        element={
          <RouteWithOperatorShell>
            <LegionSettings />
          </RouteWithOperatorShell>
        }
      />

      <Route
        path={AppRoutePaths.EngineeringHome.path}
        element={
          <RouteWithEngineeringShell>
            <SiteBuilderPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringSiteBuilder.path}
        element={
          <RouteWithEngineeringShell>
            <SiteBuilderPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringArchiveManager.path}
        element={
          <RouteWithEngineeringShell>
            <ArchiveManagerPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path="/legion/engineering/network-discovery"
        element={
          <RouteWithEngineeringShell>
            <LegacyNetworkDiscoveryRedirect />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path="/legion/engineering/network-configuration"
        element={
          <RouteWithEngineeringShell>
            <LegacyNetworkConfigurationRedirect />
          </RouteWithEngineeringShell>
        }
      />
      {/* Trailing /* so the nested <Routes> inside EngineeringNetworkSection can match its own sub-paths. */}
      <Route
        path={`${AppRoutePaths.EngineeringNetwork.path}/*`}
        element={
          <RouteWithEngineeringShell>
            <EngineeringNetworkSection />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringBacnetExplorer.path}
        element={
          <RouteWithEngineeringShell>
            <BacnetExplorerPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringPointMapping.path}
        element={
          <RouteWithEngineeringShell>
            <PointMappingPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringGraphicsManager.path}
        element={
          <RouteWithEngineeringShell>
            <GraphicsManagerPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringTemplateLibrary.path}
        element={
          <RouteWithEngineeringShell>
            <TemplateLibraryPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringValidationCenter.path}
        element={
          <RouteWithEngineeringShell>
            <ValidationCenterPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringDeployment.path}
        element={
          <RouteWithEngineeringShell>
            <DeploymentPage />
          </RouteWithEngineeringShell>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringUserManager.path}
        element={
          <RouteWithEngineeringShell>
            <UserManagerPage />
          </RouteWithEngineeringShell>
        }
      />

      <Route path="*" element={<Navigate to={AppRoutePaths.LegionSite.path} replace />} />
    </Routes>
  );
}
