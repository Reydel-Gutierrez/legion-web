import React, { useState } from "react";
import SimpleBar from 'simplebar-react';
import { useLocation } from "react-router-dom";
import { CSSTransition } from 'react-transition-group';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faBoxOpen, faCog, faSignOutAlt, faTimes, faCalendarAlt, faMapPin, faInbox } from "@fortawesome/free-solid-svg-icons";
import { Nav, Badge, Image, Button, Dropdown, Navbar } from '@themesberg/react-bootstrap';
import { Link } from 'react-router-dom';

import { Routes } from "../../routes";
import { accessRepository } from "../../lib/data";
import { canViewUserManager } from "../../lib/access/currentUserAccess";
import ReactHero from "../../assets/img/technologies/react-hero-logo.svg";
import LegionLogo from "../../assets/img/legionlogo.png";
import { useSite } from "../providers/SiteProvider";
import { useWorkspaceMode } from "../providers/WorkspaceModeProvider";
import { useEngineeringVersionContext } from "../providers/EngineeringVersionProvider";
import { SITE_IDS } from "../../lib/sites";
import { USE_HIERARCHY_API } from "../../lib/data/config";
import { useSiteDisplayLabel } from "../../hooks/useSiteDisplayLabel";
import { getPersistedWorkingVersionSiteNames } from "../../lib/data/persistence/engineeringVersionPersistence";
import EngineeringSidebarTreeGroup from "./EngineeringSidebarTreeGroup";
import { getEngineeringSidebarGroups } from "./engineeringSidebarConfig";
import { getOperatorSidebarGroups } from "./operatorSidebarConfig";

export default function Sidebar() {
  const { setSite, apiSites, sitesLoading, sitesError } = useSite();
  const displaySiteName = useSiteDisplayLabel();
  const { currentMode } = useWorkspaceMode();
  const { workingVersion, activeReleaseBySite } = useEngineeringVersionContext();
  const workingSiteName = workingVersion?.data?.site?.name;
  const apiModeWithSites = USE_HIERARCHY_API && apiSites.length > 0;
  const persistedWorkingSites = getPersistedWorkingVersionSiteNames();
  const deployedSiteNames = Object.keys(activeReleaseBySite || {}).filter((k) => activeReleaseBySite[k] != null);
  const location = useLocation();
  const { pathname } = location;
  const [show, setShow] = useState(false);
  const showClass = show ? "show" : "";

  const onCollapse = () => setShow(!show);

  const NavItem = (props) => {
    const {
      title,
      link,
      external,
      target,
      icon,
      image,
      badgeText,
      badgeBg = "secondary",
      badgeColor = "light",
      activePrefix,
      linkClassName = "",
    } = props;
    const classNames = [
      badgeText ? "d-flex justify-content-start align-items-center justify-content-between" : "",
      linkClassName,
    ]
      .filter(Boolean)
      .join(" ");
    const isActive = activePrefix != null ? pathname.startsWith(activePrefix) : link === pathname;
    const navItemClassName = isActive ? "active" : "";
    const linkProps = external ? { href: link } : { as: Link, to: link };

    return (
      <Nav.Item className={navItemClassName} onClick={() => setShow(false)}>
        <Nav.Link {...linkProps} target={target} className={classNames}>
          <span>
            {icon ? <span className="sidebar-icon"><FontAwesomeIcon icon={icon} /> </span> : null}
            {image ? <Image src={image} width={20} height={20} className="sidebar-icon svg-icon" /> : null}

            <span className="sidebar-text">{title}</span>
          </span>
          {badgeText ? (
            <Badge pill bg={badgeBg} text={badgeColor} className="badge-md notification-count ms-2">{badgeText}</Badge>
          ) : null}
        </Nav.Link>
      </Nav.Item>
    );
  };

  return (
    <>
      <Navbar expand={false} collapseOnSelect variant="dark" className="navbar-theme-primary px-4 d-md-none">
        <Navbar.Brand className="me-lg-5" as={Link} to={currentMode === "engineering" ? Routes.EngineeringSiteBuilder.path : Routes.LegionSite.path}>
          <Image src={ReactHero} className="navbar-brand-light" />
        </Navbar.Brand>
        <Navbar.Toggle as={Button} aria-controls="main-navbar" onClick={onCollapse}>
          <span className="navbar-toggler-icon" />
        </Navbar.Toggle>
      </Navbar>
      <CSSTransition timeout={300} in={show} classNames="sidebar-transition">
        <div className={`legion-sidebar-wrapper collapse ${showClass} d-md-block ${currentMode === "engineering" ? "legion-sidebar--engineering" : ""}`}>
          <SimpleBar className="sidebar legion-sidebar text-white">
            <div className="sidebar-inner px-4 pt-3">
            <div className="user-card d-flex d-md-none align-items-center justify-content-between justify-content-md-center pb-4">
              <div className="d-flex align-items-center">
                <div className="user-avatar lg-avatar me-4">
                  <Image src={LegionLogo} className="card-img-top rounded-circle border-white" alt="" />
                </div>
                <div className="d-block">
                  <h6>Hi, Jane</h6>
                  <Button as={Link} variant="secondary" size="xs" to={Routes.LegionSite.path} className="text-dark">
                    <FontAwesomeIcon icon={faSignOutAlt} className="me-2" /> Sign Out
                  </Button>
                </div>
              </div>
              <Nav.Link className="collapse-close d-md-none" onClick={onCollapse}>
                <FontAwesomeIcon icon={faTimes} />
              </Nav.Link>
            </div>
            <Nav className="flex-column pt-3 pt-md-0">
              <div className="mb-3">
              <Dropdown>
                <Dropdown.Toggle
                  variant="link"
                  size="sm"
                  className="w-100 d-flex align-items-center justify-content-between legion-sidebar-site text-decoration-none"
                >
                  <span className="d-flex align-items-center">
                    <FontAwesomeIcon icon={faMapPin} className="me-2" />
                    <span className="fw-semibold">{displaySiteName}</span>
                  </span>
                  <span className="ms-2">▾</span>
                </Dropdown.Toggle>

                <Dropdown.Menu className="w-100 legion-dropdown-menu">
                  {currentMode === "engineering" ? (
                    <>
                      {USE_HIERARCHY_API && sitesLoading && apiSites.length === 0 ? (
                        <div className="px-3 py-2 small text-white-50">Loading sites…</div>
                      ) : null}
                      {USE_HIERARCHY_API && sitesError ? (
                        <div className="px-3 py-2 small text-warning">{sitesError}</div>
                      ) : null}
                      {USE_HIERARCHY_API && !sitesLoading && !sitesError && apiSites.length === 0 ? (
                        <div className="px-3 py-2 small text-white-50">No sites from API.</div>
                      ) : null}
                      {apiSites.length > 0 && (
                        <>
                          {apiSites.map((s) => (
                            <Dropdown.Item key={s.id} onClick={() => setSite(s.id)}>
                              {s.name}
                              {!(activeReleaseBySite && activeReleaseBySite[s.id]) && (
                                <span className="text-white-50 small ms-1">(no release)</span>
                              )}
                            </Dropdown.Item>
                          ))}
                        </>
                      )}
                      {apiModeWithSites ? (
                        <>
                          <Dropdown.Divider className="border-light border-opacity-10" />
                          <div className="px-3 py-1 small text-white-50 text-uppercase" style={{ fontSize: 10, letterSpacing: "0.06em" }}>
                            Local demos
                          </div>
                        </>
                      ) : null}
                      <Dropdown.Item onClick={() => setSite(SITE_IDS.MIAMI_HQ)}>
                        {SITE_IDS.MIAMI_HQ}
                        {!(activeReleaseBySite && activeReleaseBySite[SITE_IDS.MIAMI_HQ]) && (
                          <span className="text-white-50 small ms-1">(no release)</span>
                        )}
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => setSite(SITE_IDS.BRIGHTLINE)}>
                        {SITE_IDS.BRIGHTLINE}
                        {!(activeReleaseBySite && activeReleaseBySite[SITE_IDS.BRIGHTLINE]) && (
                          <span className="text-white-50 small ms-1">(no release)</span>
                        )}
                      </Dropdown.Item>
                      {[
                        ...new Set([
                          ...persistedWorkingSites.filter(
                            (n) => n !== SITE_IDS.MIAMI_HQ && n !== SITE_IDS.NEW_SITE && n !== "New Building"
                          ),
                          ...(workingSiteName && workingSiteName !== SITE_IDS.MIAMI_HQ && workingSiteName !== SITE_IDS.NEW_SITE
                            ? [workingSiteName]
                            : []),
                        ]),
                      ]
                        .sort((a, b) => a.localeCompare(b))
                        .map((name) => (
                          <Dropdown.Item key={name} onClick={() => setSite(name)}>
                            {name}
                            {!(activeReleaseBySite && activeReleaseBySite[name]) && (
                              <span className="text-white-50 small ms-1">(no release)</span>
                            )}
                          </Dropdown.Item>
                        ))}
                      <Dropdown.Divider className="border-light border-opacity-10" />
                      <Dropdown.Item onClick={() => setSite(SITE_IDS.NEW_SITE)} className="legion-dropdown-new-site">
                        <span className="text-white-50">+ New Site</span>
                      </Dropdown.Item>
                    </>
                  ) : (
                    <>
                      {USE_HIERARCHY_API && sitesLoading && apiSites.length === 0 ? (
                        <div className="px-3 py-2 small text-white-50">Loading sites…</div>
                      ) : null}
                      {USE_HIERARCHY_API && sitesError ? (
                        <div className="px-3 py-2 small text-warning">{sitesError}</div>
                      ) : null}
                      {USE_HIERARCHY_API && !sitesLoading && !sitesError && apiSites.length === 0 ? (
                        <div className="px-3 py-2 small text-white-50">No sites from API.</div>
                      ) : null}
                      {apiSites.length > 0 && (
                        <>
                          {apiSites.map((s) => (
                            <Dropdown.Item key={s.id} onClick={() => setSite(s.id)}>
                              {s.name}
                            </Dropdown.Item>
                          ))}
                          <Dropdown.Divider className="border-light border-opacity-10" />
                        </>
                      )}
                      {!apiModeWithSites && deployedSiteNames.length > 0
                        ? deployedSiteNames.map((name) => (
                            <Dropdown.Item key={name} onClick={() => setSite(name)}>
                              {name}
                            </Dropdown.Item>
                          ))
                        : null}
                      {!apiModeWithSites && deployedSiteNames.length === 0 ? (
                        <>
                          <Dropdown.Item onClick={() => setSite("Miami HQ")}>Miami HQ</Dropdown.Item>
                          <Dropdown.Item onClick={() => setSite("New Site")}>New Site</Dropdown.Item>
                        </>
                      ) : null}
                    </>
                  )}
                </Dropdown.Menu>
              </Dropdown>
            </div>

              {/* LEGION BAS */}
              <Dropdown.Divider className="my-3 border-indigo" />

              {currentMode === "operator" ? (
                <>
                  <NavItem
                    title="Site Layout"
                    link={Routes.LegionSite.path}
                    icon={faMapPin}
                    linkClassName="legion-sidebar-parent-tone-link"
                  />
                  {getOperatorSidebarGroups().map((group) => (
                    <EngineeringSidebarTreeGroup
                      key={group.title}
                      title={group.title}
                      parentIcon={group.parentIcon}
                      parentPath={group.parentPath}
                      sectionPaths={group.sectionPaths}
                      children={group.children}
                      onNavigate={() => setShow(false)}
                    />
                  ))}
                </>
              ) : (
                <>
                  {getEngineeringSidebarGroups({
                    includeAdministration: canViewUserManager(accessRepository.getCurrentUserForAccess()),
                  }).map((group) => (
                    <EngineeringSidebarTreeGroup
                      key={group.title}
                      title={group.title}
                      parentIcon={group.parentIcon}
                      parentPath={group.parentPath}
                      sectionPaths={group.sectionPaths}
                      children={group.children}
                      onNavigate={() => setShow(false)}
                    />
                  ))}
                </>
              )}
            </Nav>
          </div>
          </SimpleBar>
        </div>
      </CSSTransition>
    </>
  );
}
