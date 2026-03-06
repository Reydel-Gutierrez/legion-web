import React, { useState, useEffect } from "react";
import { Route, Switch, Redirect } from "react-router-dom";
import { Routes } from "../routes";

// Legion pages
import LegionDashboard from "./Legion/Dashboard";
import LegionSite from "./Legion/Site";
import LegionEquipment from "./Legion/Equipment";
import LegionEquipmentDetail from "./Legion/EquipmentDetail";
import LegionAlarms from "./Legion/Alarms";
import LegionTrends from "./Legion/Trends";
import LegionSchedules from "./Legion/Schedules";
import LegionEvents from "./Legion/Events";
import LegionSettings from "./Legion/Settings";
import LegionUsers from "./Legion/Users";

// shared layout
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Preloader from "../components/Preloader";

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

export default function HomePage() {
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

      <Redirect to={Routes.LegionDashboard.path} />
    </Switch>
  );
}