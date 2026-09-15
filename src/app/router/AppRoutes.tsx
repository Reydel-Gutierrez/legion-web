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
import EngineeringNetworkSection from "../../modules/engineering/network/EngineeringNetworkSection";
import PointMappingPage from "../../modules/engineering/point-mapping/PointMappingPage";
import GraphicsManagerPage from "../../modules/engineering/graphics-manager/GraphicsManagerPage";
import TemplateLibraryPage from "../../modules/engineering/template-library/TemplateLibraryPage";
import ValidationCenterPage from "../../modules/engineering/validation-center/ValidationCenterPage";
import DeploymentPage from "../../modules/engineering/deployment/DeploymentPage";
import UserManagerPage from "../../modules/engineering/user-manager/UserManagerPage";
import BacnetExplorerPage from "../../modules/engineering/bacnet-explorer/BacnetExplorerPage";

import Sidebar from "../layout/Sidebar";
import Navbar from "../layout/Navbar";
import Footer from "../layout/Footer";
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
 * components used as a Route's `element` (e.g. `element={<RouteWithSidebar><Page /></RouteWithSidebar>}`)
 * instead of wrapping <Route> themselves.
 */
function RouteWithSidebar({ children }: { children?: ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const localStorageIsSettingsVisible = () => {
    return localStorage.getItem("settingsVisible") === "false" ? false : true;
  };

  const [showSettings, setShowSettings] = useState(localStorageIsSettingsVisible);

  const toggleSettings = () => {
    setShowSettings(!showSettings);
    localStorage.setItem("settingsVisible", String(!showSettings));
  };

  return (
    <>
      <Preloader show={!loaded} />
      <Sidebar />
      <main className="content legion-bg">
        <Navbar />
        {children}
        <Footer toggleSettings={toggleSettings} showSettings={showSettings} />
      </main>
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
        path={AppRoutePaths.EngineeringSiteBuilder.path}
        element={
          <RouteWithSidebar>
            <SiteBuilderPage />
          </RouteWithSidebar>
        }
      />
      <Route
        path="/legion/engineering/network-discovery"
        element={
          <RouteWithSidebar>
            <LegacyNetworkDiscoveryRedirect />
          </RouteWithSidebar>
        }
      />
      <Route
        path="/legion/engineering/network-configuration"
        element={
          <RouteWithSidebar>
            <LegacyNetworkConfigurationRedirect />
          </RouteWithSidebar>
        }
      />
      {/* Trailing /* so the nested <Routes> inside EngineeringNetworkSection can match its own sub-paths. */}
      <Route
        path={`${AppRoutePaths.EngineeringNetwork.path}/*`}
        element={
          <RouteWithSidebar>
            <EngineeringNetworkSection />
          </RouteWithSidebar>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringBacnetExplorer.path}
        element={
          <RouteWithSidebar>
            <BacnetExplorerPage />
          </RouteWithSidebar>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringPointMapping.path}
        element={
          <RouteWithSidebar>
            <PointMappingPage />
          </RouteWithSidebar>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringGraphicsManager.path}
        element={
          <RouteWithSidebar>
            <GraphicsManagerPage />
          </RouteWithSidebar>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringTemplateLibrary.path}
        element={
          <RouteWithSidebar>
            <TemplateLibraryPage />
          </RouteWithSidebar>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringValidationCenter.path}
        element={
          <RouteWithSidebar>
            <ValidationCenterPage />
          </RouteWithSidebar>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringDeployment.path}
        element={
          <RouteWithSidebar>
            <DeploymentPage />
          </RouteWithSidebar>
        }
      />
      <Route
        path={AppRoutePaths.EngineeringUserManager.path}
        element={
          <RouteWithSidebar>
            <UserManagerPage />
          </RouteWithSidebar>
        }
      />

      <Route path="*" element={<Navigate to={AppRoutePaths.LegionSite.path} replace />} />
    </Routes>
  );
}
