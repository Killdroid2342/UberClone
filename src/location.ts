import { searchLocations } from "./api.js";
import { setPickupMarker, setDestinationMarker } from "./map.js";
import { SEARCH_DEBOUNCE_MS } from "./config.js";
import type { LocationResult } from "./types.js";

let pickupTimer: number | null = null;
let destTimer: number | null = null;
let selectedPickup: LocationResult | null = null;
let selectedDest: LocationResult | null = null;

export function getSelectedPickup(): LocationResult | null { return selectedPickup; }
export function getSelectedDest(): LocationResult | null { return selectedDest; }



function renderResults(container: HTMLDivElement, results: LocationResult[], onSelect: (r: LocationResult) => void): void {
  container.innerHTML = "";
  if (results.length === 0) {
    container.innerHTML = `<div class="search-result-item no-results">No results found</div>`;
    container.classList.add("visible");
    return;
  }
  for (const r of results) {
    const item = document.createElement("div");
    item.className = "search-result-item";
    const parts = r.name.split(",");
    const main = parts[0];
    const sub = parts.slice(1, 3).join(",").trim();
    item.innerHTML = `<span class="result-icon">📍</span><div><div class="result-main">${main}</div><div class="result-sub">${sub}</div></div>`;
    item.addEventListener("click", () => onSelect(r));
    container.appendChild(item);
  }
  container.classList.add("visible");
}

function updateConfirmButton(): void {
  const btn = document.getElementById("confirm-ride-btn") as HTMLButtonElement;
  if (!btn) return;
  if (selectedPickup && selectedDest) {
    btn.classList.add("visible");
  }
}
