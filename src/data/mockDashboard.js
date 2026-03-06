/**
 * Mock dashboard data. Replace with API calls later (e.g. dashboardService.js).
 */

export const getDashboardSummary = () => ({
  activeAlarms: 5,
  unackedAlarms: 2,
  devicesOffline: 1,
  openTasks: 3,
  energyRuntime: null,
});

export const getRecentEvents = () => {
  return [
    { id: "EVT-20031", time: "2/22/26 14:10", type: "Command", equipment: "VAV-2", message: "Damper Cmd = 65%", severity: "Info" },
    { id: "EVT-20027", time: "2/22/26 13:42", type: "Comm", equipment: "AHU-1", message: "Device went OFFLINE", severity: "Warn" },
    { id: "EVT-20021", time: "2/22/26 11:08", type: "Device", equipment: "OAU-1", message: "Point discovered and added", severity: "Info" },
    { id: "EVT-20018", time: "2/22/26 10:55", type: "Alarm", equipment: "AHU-1", message: "High SAT - above limit", severity: "Major" },
    { id: "EVT-20015", time: "2/22/26 08:01", type: "User", equipment: "Site", message: "User logged in", severity: "Info" },
    { id: "EVT-20002", time: "2/21/26 22:17", type: "System", equipment: "Engine-01", message: "Engine restarted successfully", severity: "Info" },
    { id: "EVT-19991", time: "2/21/26 06:00", type: "Schedule", equipment: "AHU-1", message: "Occupied Mode = ON", severity: "Info" },
    { id: "EVT-19972", time: "2/20/26 19:33", type: "Comm", equipment: "CHW-P-1", message: "Device back ONLINE", severity: "Info" },
    { id: "EVT-19965", time: "2/20/26 16:10", type: "Alarm", equipment: "OAU-1", message: "Filter dirty - DP high", severity: "Major" },
    { id: "EVT-19950", time: "2/20/26 14:00", type: "Command", equipment: "FCU-3", message: "Space Temp SP = 72 deg F", severity: "Info" },
  ];
};

export const getDashboardAlarms = () => {
  return [
    { id: "ALM-10021", time: "2/22/26 14:11", severity: "Major", equipment: "AHU-1", message: "High SAT - above limit", ack: false },
    { id: "ALM-10018", time: "2/22/26 12:42", severity: "Minor", equipment: "VAV-2", message: "Stuck damper suspected", ack: true },
    { id: "ALM-10015", time: "2/22/26 11:20", severity: "Critical", equipment: "CHW-P-1", message: "Fail to start", ack: false },
    { id: "ALM-09987", time: "2/21/26 09:05", severity: "Critical", equipment: "CHW-P-1", message: "Fail to start", ack: true },
    { id: "ALM-09955", time: "2/20/26 16:10", severity: "Major", equipment: "OAU-1", message: "Filter dirty - DP high", ack: false },
    { id: "ALM-09902", time: "2/18/26 07:54", severity: "Minor", equipment: "FCU-3", message: "High condensate level", ack: true },
    { id: "ALM-09890", time: "2/17/26 15:30", severity: "Minor", equipment: "VAV-7", message: "Low airflow", ack: true },
    { id: "ALM-09875", time: "2/16/26 08:00", severity: "Major", equipment: "AHU-2", message: "Supply fan fault", ack: true },
    { id: "ALM-09860", time: "2/15/26 14:22", severity: "Critical", equipment: "OAU-1", message: "Freezestat trip", ack: true },
    { id: "ALM-09845", time: "2/14/26 09:15", severity: "Minor", equipment: "FCU-3", message: "Filter replacement due", ack: true },
  ];
};

export const getEquipmentHealth = () => {
  return [
    { id: "ahu1", name: "AHU-1", status: "Alarm", comm: "Online", lastUpdate: "2/22/26 14:11" },
    { id: "ahu2", name: "AHU-2", status: "OK", comm: "Online", lastUpdate: "2/22/26 14:05" },
    { id: "vav2", name: "VAV-2", status: "Warn", comm: "Online", lastUpdate: "2/22/26 14:04" },
    { id: "vav7", name: "VAV-7", status: "OK", comm: "Online", lastUpdate: "2/22/26 14:03" },
    { id: "fcu3", name: "FCU-3", status: "OK", comm: "Online", lastUpdate: "2/22/26 14:02" },
    { id: "oau1", name: "OAU-1", status: "Warn", comm: "Online", lastUpdate: "2/22/26 13:58" },
    { id: "chwp1", name: "CHW-P-1", status: "Offline", comm: "Offline", lastUpdate: "2/22/26 13:42" },
  ];
};

/**
 * Weather / Outside Air. Swap this for a real API later (e.g. getWeather() => fetch(...)).
 */
export function getWeather() {
  return Promise.resolve({
    oat: 72,
    humidity: 58,
    condition: "Partly cloudy",
    outlook: [
      { label: "Now", temp: 72, condition: "Partly cloudy" },
      { label: "+2h", temp: 74, condition: "Sunny" },
      { label: "+4h", temp: 76, condition: "Sunny" },
      { label: "+6h", temp: 75, condition: "Partly cloudy" },
      { label: "Tomorrow", temp: 78, condition: "Clear" },
      { label: "+2 days", temp: 80, condition: "Sunny" },
    ],
  });
}
