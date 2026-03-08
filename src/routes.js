export const Routes = {
  // LEGION WEB
  LegionDashboard: { path: "/legion/dashboard" },

  LegionSite: { path: "/legion/site" },

  LegionEquipment: { path: "/legion/equipment" },
  LegionEquipmentDetail: { path: "/legion/equipment/:equipmentId" },

  LegionAlarms: { path: "/legion/alarms" },

  LegionTrends: { path: "/legion/trends" },

  LegionSchedules: { path: "/legion/schedules" },

  LegionEvents: { path: "/legion/events" },

  LegionUsers: { path: "/legion/users" },

  LegionSettings: { path: "/legion/settings" },


  // Engineering mode routes
  EngineeringDashboard: { path: "/legion/engineering/dashboard" },
  EngineeringSiteBuilder: { path: "/legion/engineering/site-builder" },
  EngineeringNetworkDiscovery: { path: "/legion/engineering/network-discovery" },
  EngineeringPointMapping: { path: "/legion/engineering/point-mapping" },
  EngineeringGraphicsManager: { path: "/legion/engineering/graphics-manager" },
  EngineeringValidationCenter: { path: "/legion/engineering/validation-center" },
  EngineeringDeployment: { path: "/legion/engineering/deployment" },
  EngineeringLogs: { path: "/legion/engineering/logs" }

};