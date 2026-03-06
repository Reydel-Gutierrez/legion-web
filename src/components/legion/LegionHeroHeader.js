import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { Form, InputGroup } from "@themesberg/react-bootstrap";

import { ReactComponent as LegionShield } from "../../assets/svgs/legion-logo11.svg";

export default function LegionHeroHeader() {
  return (
    <div className="d-flex w-100 justify-content-between mt-2">

      {/* LEFT */}
      <div className="legion-hero-left">

        <LegionShield className="legion-brand-logo" />

        <div className="legion-hero-brand">
          <div className="legion-brand-title">
            <span className="legion-brand-legion">LEGION</span>
            <span className="legion-brand-controls">CONTROLS</span>
          </div>

          <div className="legion-brand-subtitle">
            Next-Generation Building Automation
          </div>
        </div>

      </div>

      {/* RIGHT */}
      <div className="d-flex flex-column align-items-end h-100 legion-hero-right">
        <div className="mt-auto">
          <Form className="navbar-search">
            <Form.Group id="topbarSearch">
              <InputGroup className="input-group-merge legion-search-bar">
                <InputGroup.Text className="legion-search-bar-addon">
                  <FontAwesomeIcon icon={faSearch} />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search Equipment, Rooms, etc..."
                  className="legion-search-bar-input"
                />
              </InputGroup>
            </Form.Group>
          </Form>
        </div>
      </div>

    </div>
  );
}