import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import { Form, InputGroup } from "@themesberg/react-bootstrap";

import { ReactComponent as LCILogo } from "../../assets/svgs/LCI-logo.svg";
import { ReactComponent as LCCLogo } from "../../assets/svgs/LCC-logo.svg";
import { useWorkspaceMode } from "../../app/providers/WorkspaceModeProvider";

export default function LegionHeroHeader() {
  const { currentMode } = useWorkspaceMode();
  const BrandLogo = currentMode === "engineering" ? LCCLogo : LCILogo;

  const handleSaveDraft = () => console.log("Save Draft clicked");
  const handleValidateConfiguration = () => console.log("Validate Configuration clicked");
  const handleDeployToLive = () => console.log("Deploy to Live clicked");

  return (
    <div className="d-flex w-100 justify-content-between mt-2">

      {/* LEFT */}
      <div className="legion-hero-left">

        <BrandLogo className="legion-brand-logo" />

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
        {currentMode === "engineering" ? (
          <div className="d-flex align-items-center gap-2 legion-hero-actions">
            <button
              type="button"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={handleSaveDraft}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="legion-hero-btn legion-hero-btn--secondary"
              onClick={handleValidateConfiguration}
            >
              Validate Configuration
            </button>
            <button
              type="button"
              className="legion-hero-btn legion-hero-btn--primary"
              onClick={handleDeployToLive}
            >
              Deploy to Live
            </button>
          </div>
        ) : (
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
        )}
      </div>

    </div>
  );
}