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

export function initLocationSearch(): void {
  const pickupInput = document.getElementById("pickup-input") as HTMLInputElement;
  const destInput = document.getElementById("dest-input") as HTMLInputElement;
  const pickupResults = document.getElementById("pickup-results") as HTMLDivElement;
  const destResults = document.getElementById("dest-results") as HTMLDivElement;

  if (!pickupInput || !destInput) return;

  pickupInput.addEventListener("input", () => {
    if (pickupTimer) clearTimeout(pickupTimer);
    const q = pickupInput.value.trim();
    if (q.length < 2) { pickupResults.innerHTML = ""; pickupResults.classList.remove("visible"); return; }
    pickupTimer = window.setTimeout(async () => {
      const results = await searchLocations(q);
      renderResults(pickupResults, results, (r) => {
        selectedPickup = r;
        pickupInput.value = r.name.split(",")[0];
        pickupResults.innerHTML = "";
        pickupResults.classList.remove("visible");
        setPickupMarker(r.lat, r.lng);
        updateConfirmButton();
      });
    }, SEARCH_DEBOUNCE_MS);
  });

  destInput.addEventListener("input", () => {
    if (destTimer) clearTimeout(destTimer);
    const q = destInput.value.trim();
    if (q.length < 2) { destResults.innerHTML = ""; destResults.classList.remove("visible"); return; }
    destTimer = window.setTimeout(async () => {
      const results = await searchLocations(q);
      renderResults(destResults, results, (r) => {
        selectedDest = r;
        destInput.value = r.name.split(",")[0];
        destResults.innerHTML = "";
        destResults.classList.remove("visible");
        setDestinationMarker(r.lat, r.lng);
        updateConfirmButton();
      });
    }, SEARCH_DEBOUNCE_MS);
  });
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".search-field")) {
      pickupResults.innerHTML = "";
      pickupResults.classList.remove("visible");
      destResults.innerHTML = "";
      destResults.classList.remove("visible");
    }
  });
}

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
