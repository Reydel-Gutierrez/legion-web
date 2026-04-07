import React, { useState, useEffect, useRef, useCallback } from "react";
import { Form, Spinner } from "@themesberg/react-bootstrap";
import { ApiError } from "../../../../lib/api/apiClient";
import { fetchAddressSuggestions } from "../../../../lib/data/repositories/geocodeRepository";

const DEBOUNCE_MS = 450;

/**
 * Street address field with server-backed suggestions; choosing a result fills city/state/lat/lng for the map.
 */
export default function BuildingAddressSearchField({
  readOnly,
  /** When false, suggestions are hidden (no API). */
  apiEnabled,
  address,
  onAddressChange,
  onPick,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);
  const skipSearchRef = useRef(false);

  const runSearch = useCallback(
    async (q) => {
      if (!apiEnabled || readOnly) {
        setSuggestions([]);
        return;
      }
      const query = String(q || "").trim();
      if (query.length < 3) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchAddressSuggestions(query);
        setSuggestions(rows);
        setOpen(rows.length > 0);
      } catch (e) {
        setSuggestions([]);
        const status = e instanceof ApiError ? e.status : e?.status;
        const hint404 =
          status === 404
            ? " The API on your server does not expose /api/geocode/suggest yet — stop and restart the backend from this repo (backend: npm run dev)."
            : "";
        setError((e?.message || "Address search failed") + hint404);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [apiEnabled, readOnly]
  );

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (!apiEnabled || readOnly) return undefined;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      runSearch(address);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [address, apiEnabled, readOnly, runSearch]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handlePick = (row) => {
    skipSearchRef.current = true;
    setOpen(false);
    setSuggestions([]);
    if (typeof onPick === "function") {
      onPick(row);
    }
  };

  return (
    <div className="mb-3 position-relative" ref={wrapRef}>
      <Form.Group className="mb-0">
        <Form.Label className="text-white small">Street address</Form.Label>
      </Form.Group>
      <div className="position-relative">
        <Form.Control
          size="sm"
          className="bg-dark bg-opacity-25 border border-light border-opacity-10 text-white"
          value={address}
          onChange={(e) => {
            onAddressChange(e.target.value);
            if (apiEnabled && !readOnly) setOpen(true);
          }}
          onFocus={() => {
            if (apiEnabled && !readOnly && suggestions.length > 0) setOpen(true);
          }}
          readOnly={readOnly}
          placeholder={
            apiEnabled && !readOnly
              ? "Type to search, then pick an address from the list"
              : "Optional — shown on map list"
          }
          autoComplete="off"
        />
        {loading && (
          <div
            className="position-absolute top-50 end-0 translate-middle-y pe-2 text-white-50"
            aria-hidden
          >
            <Spinner animation="border" size="sm" />
          </div>
        )}
      </div>
      {error && <Form.Text className="text-warning small d-block mt-1">{error}</Form.Text>}
      {open && suggestions.length > 0 && !readOnly && (
        <div
          className="building-address-suggest-menu border border-light border-opacity-10 rounded shadow-sm mt-1"
          role="listbox"
        >
          {suggestions.map((row) => (
            <button
              key={row.id}
              type="button"
              role="option"
              className="building-address-suggest-item w-100 text-start"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(row)}
            >
              <span className="d-block text-white small">{row.label}</span>
            </button>
          ))}
        </div>
      )}
      {apiEnabled && !readOnly && (
        <Form.Text className="text-white-50 small d-block mt-1">
          Results from OpenStreetMap (pick one to set the map pin and coordinates).
        </Form.Text>
      )}
    </div>
  );
}
