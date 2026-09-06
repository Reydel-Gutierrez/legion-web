import React, { useState, useEffect } from "react";
import { Route, Switch, Redirect } from "react-router-dom";
import { Routes } from "../../routes";

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

function LegacyNetworkDiscoveryRedirect() {
  return <Redirect to={Routes.EngineeringNetworkDiscovery.path} />;
}
function LegacyNetworkConfigurationRedirect() {
  return <Redirect to={Routes.EngineeringNetworkConfiguration.path} />;
}

const RouteWithSidebar = ({ component: Component, ...rest }) => {
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
    localStorage.setItem("settingsVisible", !showSettings);
  };

  return (
    <Route
      {...rest}
      render={(props) => (
        <>
          <Preloader show={!loaded} />
          <Sidebar />
          <main className="content legion-bg">
            <Navbar />
            <Component {...props} />
            <Footer toggleSettings={toggleSettings} showSettings={showSettings} />
          </main>
        </>
      )}
    />
  );
};

const RouteWithOperatorShell = ({ component: Component, ...rest }) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Route
      {...rest}
      render={(props) => (
        <>
          <Preloader show={!loaded} />
          <OperatorShell>{Component ? <Component {...props} /> : null}</OperatorShell>
        </>
      )}
    />
  );
};

export default function AppRoutes() {
  return (
    <Switch>
      <Redirect exact from="/" to={Routes.LegionSite.path} />

      <RouteWithOperatorShell exact path={Routes.LegionDashboard.path} component={LegionDashboard} />
      <RouteWithOperatorShell exact path={Routes.LegionSite.path} />
      <RouteWithOperatorShell exact path={Routes.LegionEquipment.path} component={LegionEquipment} />
      <RouteWithOperatorShell exact path={Routes.LegionEquipmentDetail.path} />
      <RouteWithOperatorShell exact path={Routes.LegionAlarms.path} component={LegionAlarms} />
      <RouteWithOperatorShell exact path={Routes.LegionTrends.path} component={LegionTrends} />
      <RouteWithOperatorShell exact path={Routes.LegionSchedules.path} component={LegionSchedules} />
      <RouteWithOperatorShell exact path={Routes.LegionEvents.path} component={LegionEvents} />
      <RouteWithOperatorShell exact path={Routes.LegionUsers.path} component={LegionUsers} />
      <RouteWithOperatorShell exact path={Routes.LegionSettings.path} component={LegionSettings} />

      <RouteWithSidebar exact path={Routes.EngineeringSiteBuilder.path} component={SiteBuilderPage} />
      <RouteWithSidebar
        exact
        path="/legion/engineering/network-discovery"
        component={LegacyNetworkDiscoveryRedirect}
      />
      <RouteWithSidebar
        exact
        path="/legion/engineering/network-configuration"
        component={LegacyNetworkConfigurationRedirect}
      />
      <RouteWithSidebar path={Routes.EngineeringNetwork.path} component={EngineeringNetworkSection} />
      <RouteWithSidebar exact path={Routes.EngineeringBacnetExplorer.path} component={BacnetExplorerPage} />
      <RouteWithSidebar exact path={Routes.EngineeringPointMapping.path} component={PointMappingPage} />
      <RouteWithSidebar exact path={Routes.EngineeringGraphicsManager.path} component={GraphicsManagerPage} />
      <RouteWithSidebar exact path={Routes.EngineeringTemplateLibrary.path} component={TemplateLibraryPage} />
      <RouteWithSidebar exact path={Routes.EngineeringValidationCenter.path} component={ValidationCenterPage} />
      <RouteWithSidebar exact path={Routes.EngineeringDeployment.path} component={DeploymentPage} />
      <RouteWithSidebar exact path={Routes.EngineeringUserManager.path} component={UserManagerPage} />

      <Redirect to={Routes.LegionSite.path} />
    </Switch>
  );
}
