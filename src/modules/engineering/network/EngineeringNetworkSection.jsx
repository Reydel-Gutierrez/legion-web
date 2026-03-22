import React from "react";
import { Switch, Route, Redirect, useRouteMatch } from "react-router-dom";
import { Container } from "@themesberg/react-bootstrap";

import LegionHeroHeader from "../../../components/legion/LegionHeroHeader";
import NetworkDiscoveryPage from "../network-discovery/NetworkDiscoveryPage";
import NetworkConfigurationPage from "../network-configuration/NetworkConfigurationPage";

export default function EngineeringNetworkSection() {
  const { path } = useRouteMatch();

  return (
    <Container fluid className="px-0">
      <div className="px-3 px-md-4 pt-3">
        <LegionHeroHeader />
        <hr className="border-light border-opacity-25 my-3" />
      </div>

      <Switch>
        <Route exact path={path}>
          <Redirect to={`${path}/discovery`} />
        </Route>
        <Route path={`${path}/discovery`} component={NetworkDiscoveryPage} />
        <Route path={`${path}/configuration`} component={NetworkConfigurationPage} />
      </Switch>
    </Container>
  );
}
