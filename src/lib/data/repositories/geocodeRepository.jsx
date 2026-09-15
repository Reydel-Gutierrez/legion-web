import { apiFetch } from "../../api/apiClient";
import { getApiBaseUrl } from "../../api/apiConfig";

/**
 * @param {string} q
 * @returns {Promise<Array<{ id: string, label: string, addressLine: string, city: string, state: string, lat: number|null, lng: number|null }>>}
 */
export async function fetchAddressSuggestions(q) {
  const base = getApiBaseUrl();
  const query = String(q || "").trim();
  if (!base || query.length < 3) return [];
  const data = await apiFetch(
    `/api/geocode/suggest?q=${encodeURIComponent(query)}&limit=8`
  );
  return Array.isArray(data?.results) ? data.results : [];
}
