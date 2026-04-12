/**
 * Engineering mode sidebar groups (workflow domains). Paths from Routes; icons from Font Awesome solid.
 */

import {
  faLayerGroup,
  faSitemap,
  faBook,
  faMapMarkerAlt,
  faPalette,
  faObjectGroup,
  faEthernet,
  faNetworkWired,
  faSlidersH,
  faClipboardList,
  faCheckCircle,
  faRocket,
  faToolbox,
  faUserCog,
} from "@fortawesome/free-solid-svg-icons";

import { Routes } from "../../routes";

export function getEngineeringSidebarGroups({ includeAdministration }) {
  const groups = [
    {
      title: "Design",
      parentIcon: faLayerGroup,
      parentPath: Routes.EngineeringSiteBuilder.path,
      sectionPaths: [
        Routes.EngineeringSiteBuilder.path,
        Routes.EngineeringTemplateLibrary.path,
        Routes.EngineeringPointMapping.path,
      ],
      children: [
        { path: Routes.EngineeringSiteBuilder.path, title: "Site Builder", icon: faSitemap },
        { path: Routes.EngineeringTemplateLibrary.path, title: "Template Library", icon: faBook },
        { path: Routes.EngineeringPointMapping.path, title: "Points mapped", icon: faMapMarkerAlt },
      ],
    },
    {
      title: "Graphics",
      parentIcon: faPalette,
      parentPath: Routes.EngineeringGraphicsManager.path,
      sectionPaths: [Routes.EngineeringGraphicsManager.path],
      children: [{ path: Routes.EngineeringGraphicsManager.path, title: "Graphics Manager", icon: faObjectGroup }],
    },
    {
      title: "Network",
      parentIcon: faEthernet,
      parentPath: Routes.EngineeringNetwork.path,
      sectionPaths: [
        Routes.EngineeringNetwork.path,
        Routes.EngineeringNetworkDiscovery.path,
        Routes.EngineeringNetworkConfiguration.path,
      ],
      children: [
        { path: Routes.EngineeringNetworkDiscovery.path, title: "Network Discovery", icon: faNetworkWired },
        { path: Routes.EngineeringNetworkConfiguration.path, title: "Network Configuration", icon: faSlidersH },
      ],
    },
    {
      title: "Deployment",
      parentIcon: faClipboardList,
      parentPath: Routes.EngineeringValidationCenter.path,
      sectionPaths: [Routes.EngineeringValidationCenter.path, Routes.EngineeringDeployment.path],
      children: [
        { path: Routes.EngineeringValidationCenter.path, title: "Validation Center", icon: faCheckCircle },
        { path: Routes.EngineeringDeployment.path, title: "Deployment", icon: faRocket },
      ],
    },
  ];

  if (includeAdministration) {
    groups.push({
      title: "Administration",
      parentIcon: faToolbox,
      parentPath: Routes.EngineeringUserManager.path,
      sectionPaths: [Routes.EngineeringUserManager.path],
      children: [{ path: Routes.EngineeringUserManager.path, title: "User Manager", icon: faUserCog }],
    });
  }

  return groups;
}
