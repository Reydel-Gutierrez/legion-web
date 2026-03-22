import React from "react";
import { Table, Dropdown } from "@themesberg/react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEdit,
  faCopy,
  faTrashAlt,
  faCog,
  faLink,
} from "@fortawesome/free-solid-svg-icons";
import { engineeringRepository } from "../../../../lib/data";

export default function GraphicTemplatesTable({
  templates,
  onView,
  onEdit,
  onDuplicate,
  onBindEquipmentTemplate,
  onRemoveFromSite,
}) {
  if (!templates || templates.length === 0) {
    return (
      <div className="p-4 text-center text-white-50 small">
        No graphic templates in this site. Import from Global Library or create one from Graphics Manager.
      </div>
    );
  }

  return (
    <div className="template-library-table-wrap">
      <Table className="template-library-table discovery-table mb-0" responsive>
        <thead>
          <tr>
            <th>Template Name</th>
            <th>Applies To</th>
            <th>Bound Point Count</th>
            <th>Source</th>
            <th>Last Updated</th>
            <th className="text-end" style={{ width: 120 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((row) => (
            <tr key={row.id} className="discovery-table-row">
              <td className="fw-semibold text-white">{row.name}</td>
              <td className="text-white-50">{row.appliesTo || "—"}</td>
              <td className="text-white-50">{row.boundPointCount}</td>
              <td>
                <span
                  className={`template-library-source-badge ${
                    row.source === engineeringRepository.SOURCE.SITE_CUSTOM ||
                    row.source === engineeringRepository.SOURCE.SITE_CREATED
                      ? "template-library-source-badge--site"
                      : "template-library-source-badge--global"
                  }`}
                >
                  {row.source}
                </span>
              </td>
              <td className="text-white-50">{row.lastUpdated}</td>
              <td className="text-end">
                <Dropdown align="end" className="d-inline-block">
                  <Dropdown.Toggle
                    variant="link"
                    size="sm"
                    className="text-white-50 p-0 border-0 text-decoration-none dropdown-toggle-no-caret"
                    id={`gfx-actions-${row.id}`}
                  >
                    <FontAwesomeIcon icon={faCog} />
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="legion-dropdown-menu">
                    <Dropdown.Item
                      className="text-white"
                      onClick={() => typeof onView === "function" && onView(row)}
                    >
                      <FontAwesomeIcon icon={faEye} className="me-2" /> View
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="text-white"
                      onClick={() => typeof onEdit === "function" && onEdit(row)}
                    >
                      <FontAwesomeIcon icon={faEdit} className="me-2" /> Edit
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="text-white"
                      onClick={() => typeof onDuplicate === "function" && onDuplicate(row)}
                    >
                      <FontAwesomeIcon icon={faCopy} className="me-2" /> Duplicate
                    </Dropdown.Item>
                    {row._origin === "template" && (
                      <Dropdown.Item
                        className="text-white"
                        onClick={() =>
                          typeof onBindEquipmentTemplate === "function" && onBindEquipmentTemplate(row)
                        }
                      >
                        <FontAwesomeIcon icon={faLink} className="me-2" /> Bind to equipment template
                      </Dropdown.Item>
                    )}
                    <Dropdown.Divider className="border-light border-opacity-10" />
                    <Dropdown.Item
                      className="text-danger"
                      onClick={() => typeof onRemoveFromSite === "function" && onRemoveFromSite(row)}
                    >
                      <FontAwesomeIcon icon={faTrashAlt} className="me-2" /> Remove from Site
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
