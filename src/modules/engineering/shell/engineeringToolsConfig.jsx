/**
 * Engineering top-bar menu bar (Archive / Templates / Graphics / Network / Tools / Deployment /
 * Admin) — a toolbar of icon-labeled tabs. Templates and Graphics are single destinations, so they
 * render as direct links (no dropdown); the rest are grouped dropdowns. Admin only appears for users
 * who can manage other users. Site Builder is not listed here — it's the default home view driven
 * by the shared tree, not a separate routed tool. Help lives in a plain icon button next to Logs
 * (see EngineeringTopBar). Items are either navigation (`path`) or actions (`action`, handled by
 * EngineeringTopBar).
 */

import {
  faArchive,
  faBook,
  faBoxOpen,
  faCheckCircle,
  faClipboardCheck,
  faFileExport,
  faFileImport,
  faFolderOpen,
  faFolderPlus,
  faMagic,
  faMapMarkerAlt,
  faNetworkWired,
  faObjectGroup,
  faProjectDiagram,
  faRocket,
  faSave,
  faSlidersH,
  faTimesCircle,
  faUserCog,
  faUserPlus,
  faUsersCog,
} from "@fortawesome/free-solid-svg-icons";

import { Routes } from "../../../routes";

export function getEngineeringMenuBar({ includeAdministration }) {
  const menus = [
    {
      title: "Archive",
      icon: faArchive,
      items: [
        { action: "newArchive", title: "New Archive", icon: faFolderPlus },
        { action: "save", title: "Save Archive", icon: faSave },
        { action: "closeArchive", title: "Close Archive", icon: faTimesCircle },
        { divider: true },
        { action: "importArchive", title: "Import Archive", icon: faFileImport },
        { action: "exportArchive", title: "Export Archive", icon: faFileExport },
        { divider: true },
        { path: Routes.EngineeringArchiveManager.path, title: "Manage Archives", icon: faFolderOpen },
      ],
    },
    {
      title: "Templates",
      icon: faBook,
      path: Routes.EngineeringTemplateLibrary.path,
    },
    {
      title: "Graphics",
      icon: faObjectGroup,
      path: Routes.EngineeringGraphicsManager.path,
    },
    {
      title: "Network",
      icon: faNetworkWired,
      items: [
        { path: Routes.EngineeringNetworkDiscovery.path, title: "Network Discovery", icon: faNetworkWired },
        { path: Routes.EngineeringNetworkConfiguration.path, title: "Network Configuration", icon: faSlidersH },
        { path: Routes.EngineeringBacnetExplorer.path, title: "BACnet Explorer", icon: faProjectDiagram },
      ],
    },
    {
      title: "Tools",
      icon: faBoxOpen,
      items: [
        { action: "validateStructure", title: "Validate Structure", icon: faClipboardCheck },
        { action: "generateInstanceNumbers", title: "Generate Instance Numbers", icon: faMagic },
        { action: "generateAddressNumbers", title: "Generate Address Numbers", icon: faMagic },
        { path: Routes.EngineeringPointMapping.path, title: "Points Mapped", icon: faMapMarkerAlt },
      ],
    },
    {
      title: "Deployment",
      icon: faRocket,
      items: [
        { path: Routes.EngineeringValidationCenter.path, title: "Validation", icon: faCheckCircle },
        { path: Routes.EngineeringDeployment.path, title: "Deploy", icon: faRocket },
      ],
    },
  ];

  if (includeAdministration) {
    menus.push({
      title: "Admin",
      icon: faUsersCog,
      items: [
        { path: `${Routes.EngineeringUserManager.path}?new=1`, title: "Create User", icon: faUserPlus },
        { path: Routes.EngineeringUserManager.path, title: "Manage Users", icon: faUserCog },
      ],
    });
  }

  return menus;
}
