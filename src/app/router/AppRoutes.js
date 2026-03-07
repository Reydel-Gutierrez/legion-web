import React, { useState, useEffect } from "react";
import { Route, Switch, Redirect } from "react-router-dom";
import { Routes } from "../../routes";

// Operator module pages
import LegionDashboard from "../../modules/operator/dashboard/DashboardPage";
import LegionSite from "../../modules/operator/site/SitePage";
import LegionEquipment from "../../modules/operator/equipment/EquipmentPage";
import LegionEquipmentDetail from "../../modules/operator/equipment/EquipmentDetailPage";
import LegionAlarms from "../../modules/operator/alarms/AlarmsPage";
import LegionTrends from "../../modules/operator/trends/TrendsPage";
import LegionSchedules from "../../modules/operator/schedules/SchedulesPage";
import LegionEvents from "../../modules/operator/events/EventsPage";
import LegionUsers from "../../modules/operator/users/UsersPage";
import LegionSettings from "../../modules/operator/settings/SettingsPage";

// Engineering pages
import EngineeringDashboardPage from "../../modules/engineering/lcc-dashboard/EngineeringDashboardPage";
import EngineeringPlaceholderPage from "../../modules/engineering/EngineeringPlaceholderPage";

// shared layout
import Sidebar from "../layout/Sidebar";
import Navbar from "../layout/Navbar";
import Footer from "../layout/Footer";
import Preloader from "../layout/Preloader";

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

export default function AppRoutes() {
  return (
    <Switch>
      <Redirect exact from="/" to={Routes.LegionDashboard.path} />

      <RouteWithSidebar exact path={Routes.LegionDashboard.path} component={LegionDashboard} />
      <RouteWithSidebar exact path={Routes.LegionSite.path} component={LegionSite} />
      <RouteWithSidebar exact path={Routes.LegionEquipment.path} component={LegionEquipment} />
      <RouteWithSidebar exact path={Routes.LegionEquipmentDetail.path} component={LegionEquipmentDetail} />
      <RouteWithSidebar exact path={Routes.LegionAlarms.path} component={LegionAlarms} />
      <RouteWithSidebar exact path={Routes.LegionTrends.path} component={LegionTrends} />
      <RouteWithSidebar exact path={Routes.LegionSchedules.path} component={LegionSchedules} />
      <RouteWithSidebar exact path={Routes.LegionEvents.path} component={LegionEvents} />
      <RouteWithSidebar exact path={Routes.LegionUsers.path} component={LegionUsers} />
      <RouteWithSidebar exact path={Routes.LegionSettings.path} component={LegionSettings} />

      {/* Engineering mode routes */}
      <RouteWithSidebar exact path={Routes.EngineeringDashboard.path} component={EngineeringDashboardPage} />
      <RouteWithSidebar exact path={Routes.EngineeringSiteBuilder.path} render={(props) => <EngineeringPlaceholderPage {...props} title="Site Builder" />} />
      <RouteWithSidebar exact path={Routes.EngineeringEquipmentBuilder.path} render={(props) => <EngineeringPlaceholderPage {...props} title="Equipment Builder" />} />
      <RouteWithSidebar exact path={Routes.EngineeringNetworkDiscovery.path} render={(props) => <EngineeringPlaceholderPage {...props} title="Network Discovery" />} />
      <RouteWithSidebar exact path={Routes.EngineeringPointMapping.path} render={(props) => <EngineeringPlaceholderPage {...props} title="Point Mapping" />} />
      <RouteWithSidebar exact path={Routes.EngineeringGraphicsManager.path} render={(props) => <EngineeringPlaceholderPage {...props} title="Graphics Manager" />} />
      <RouteWithSidebar exact path={Routes.EngineeringValidationCenter.path} render={(props) => <EngineeringPlaceholderPage {...props} title="Validation Center" />} />
      <RouteWithSidebar exact path={Routes.EngineeringDeployment.path} render={(props) => <EngineeringPlaceholderPage {...props} title="Deployment" />} />
      <RouteWithSidebar exact path={Routes.EngineeringLogs.path} render={(props) => <EngineeringPlaceholderPage {...props} title="Logs" />} />

      <Redirect to={Routes.LegionDashboard.path} />
    </Switch>
  );
}
