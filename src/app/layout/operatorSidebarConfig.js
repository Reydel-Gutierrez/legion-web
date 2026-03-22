import {
  faToolbox,
  faBoxOpen,
  faDesktop,
  faInbox,
  faChartPie,
  faCog,
  faCalendarAlt,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

import { Routes } from "../../routes";

export function getOperatorSidebarGroups() {
  return [
    {
      title: "Operations",
      parentIcon: faToolbox,
      parentPath: Routes.LegionEquipment.path,
      sectionPaths: [Routes.LegionEquipment.path],
      children: [
        { path: Routes.LegionEquipment.path, title: "Equipment", icon: faBoxOpen },
      ],
    },
    {
      title: "Monitoring",
      parentIcon: faDesktop,
      parentPath: Routes.LegionAlarms.path,
      sectionPaths: [Routes.LegionAlarms.path, Routes.LegionTrends.path, Routes.LegionEvents.path],
      children: [
        { path: Routes.LegionAlarms.path, title: "Alarms", icon: faInbox },
        { path: Routes.LegionTrends.path, title: "Trends", icon: faChartPie },
        { path: Routes.LegionEvents.path, title: "Events", icon: faCog },
      ],
    },
    {
      title: "Control",
      parentIcon: faCalendarAlt,
      parentPath: Routes.LegionSchedules.path,
      sectionPaths: [Routes.LegionSchedules.path],
      children: [{ path: Routes.LegionSchedules.path, title: "Schedules", icon: faCalendarAlt }],
    },
    {
      title: "Insights",
      parentIcon: faChartPie,
      parentPath: Routes.LegionDashboard.path,
      sectionPaths: [Routes.LegionDashboard.path],
      children: [{ path: Routes.LegionDashboard.path, title: "Insights", icon: faChartPie }],
    },
    {
      title: "Administration",
      parentIcon: faUsers,
      parentPath: Routes.LegionUsers.path,
      sectionPaths: [Routes.LegionUsers.path, Routes.LegionSettings.path],
      children: [
        { path: Routes.LegionUsers.path, title: "Users", icon: faUsers },
        { path: Routes.LegionSettings.path, title: "Settings", icon: faCog },
      ],
    },
  ];
}
