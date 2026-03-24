import React from "react";
import { Breadcrumb } from "@themesberg/react-bootstrap";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHome } from "@fortawesome/free-solid-svg-icons";
import { useSite } from "../../app/providers/SiteProvider";
import { useSiteDisplayLabel } from "../../hooks/useSiteDisplayLabel";

export default function PageBreadcrumbs() {
  const { site } = useSite();
  const siteLabel = useSiteDisplayLabel();
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <Breadcrumb
      className="mb-0 bg-transparent p-0"
      style={{ backgroundColor: "transparent" }}
      listProps={{
        className: "mb-0 bg-transparent p-0",
        style: { backgroundColor: "transparent" }
      }}
    >
      <Breadcrumb.Item
        linkAs={Link}
        linkProps={{ to: "/" }}
        className="text-white-50"
        style={{ textDecoration: "none" }}
      >
        <FontAwesomeIcon icon={faHome} />
      </Breadcrumb.Item>

      {segments.map((seg, idx) => {
        const label =
          seg === "legion" && site
            ? siteLabel
            : seg
                .replace(/[-_]/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());

        const isLast = idx === segments.length - 1;
        const path = "/" + segments.slice(0, idx + 1).join("/");

        return isLast ? (
          <Breadcrumb.Item
            key={path}
            active
            style={{ color: "#fff", fontWeight: 600 }}
          >
            {label}
          </Breadcrumb.Item>
        ) : (
          <Breadcrumb.Item
            key={path}
            linkAs={Link}
            linkProps={{ to: path }}
            className="text-white-50"
            style={{ textDecoration: "none" }}
          >
            {label}
          </Breadcrumb.Item>
        );
      })}
    </Breadcrumb>
  );
}
