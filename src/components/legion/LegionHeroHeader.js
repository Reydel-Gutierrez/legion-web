import React, { useCallback } from "react";
import { useHistory } from "react-router-dom";
import { ReactComponent as LCILogo } from "../../assets/svgs/LCI-logo.svg";
import { ReactComponent as LCCLogo } from "../../assets/svgs/LCC-logo.svg";
import { useWorkspaceMode } from "../../app/providers/WorkspaceModeProvider";
import { useValidation } from "../../app/providers/ValidationProvider";
import { useSite } from "../../app/providers/SiteProvider";
import { useEngineeringVersionContext } from "../../app/providers/EngineeringVersionProvider";
import { Routes } from "../../routes";
import LegionOperatorGlobalSearch from "./LegionOperatorGlobalSearch";
import { USE_HIERARCHY_API } from "../../lib/data/config";
import { saveWorkingVersion, notifyEngineeringHierarchyChanged } from "../../lib/data/repositories/engineeringRepository";
import { isBackendSiteId } from "../../lib/data/siteIdUtils";
import { coerceSiteKeyToApiId } from "../../lib/data/siteApiResolution";
import { saveWorkingVersionForSite } from "../../lib/data/persistence/engineeringVersionPersistence";
import { appNotify, appLogger, withEngineeringAction } from "../../lib/app-activity";

export default function LegionHeroHeader() {
  const { currentMode } = useWorkspaceMode();
  const history = useHistory();
  const { validationSnapshot, hasBlockingErrors } = useValidation();
  const { site, apiSites } = useSite();
  const { workingState } = useEngineeringVersionContext();
  const BrandLogo = currentMode === "engineering" ? LCCLogo : LCILogo;

  const siteKeyForApi = coerceSiteKeyToApiId(site, apiSites) || (isBackendSiteId(site) ? site : null);

  const handleSaveWorkingVersion = useCallback(async () => {
    if (USE_HIERARCHY_API && siteKeyForApi) {
      try {
        await withEngineeringAction({
          area: "Engineering",
          action: "Save working version",
          infoMessage: "Saving site...",
          successMessage: "Site saved successfully",
          errorMessage: "Failed to save site",
          run: async () => {
            await saveWorkingVersion(siteKeyForApi, workingState, undefined, { activity: { silent: true } });
            notifyEngineeringHierarchyChanged(siteKeyForApi);
          },
        });
      } catch {
        /* surfaced via withEngineeringAction */
      }
      return;
    }
    saveWorkingVersionForSite(site, workingState);
    if (workingState?.site?.name && workingState.site.name !== site) {
      saveWorkingVersionForSite(workingState.site.name, workingState);
    }
    appNotify.success("Site saved successfully");
    appLogger.success("Site saved successfully", { area: "Engineering", action: "Save working version" });
  }, [site, siteKeyForApi, workingState]);

  const handleValidateConfiguration = () => {
    history.push(Routes.EngineeringValidationCenter.path);
  };
  const handleDeployToLive = () => {
    if (hasBlockingErrors) {
      history.push(Routes.EngineeringValidationCenter.path, { fromDeploy: true });
    } else {
      history.push(Routes.EngineeringDeployment.path);
    }
  };

  return (
    <div
      className={`d-flex w-100 justify-content-between mt-2 legion-hero-header${
        currentMode !== "engineering" ? " legion-hero-header--operator" : ""
      }`}
    >

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
              onClick={handleSaveWorkingVersion}
            >
              Save
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
            <LegionOperatorGlobalSearch />
          </div>
        )}
      </div>

    </div>
  );
}
