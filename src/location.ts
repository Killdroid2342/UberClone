import { getRouteEstimate, searchLocations } from "./api.js";
import { clearRoute, setPickupMarker, setDestinationMarker, setRoute } from "./map.js";
import { SEARCH_DEBOUNCE_MS } from "./config.js";
import type { LocationResult, RouteEstimate } from "./types.js";

let pickupTimer: number | null = null;
let destTimer: number | null = null;
let selectedPickup: LocationResult | null = null;
let selectedDest: LocationResult | null = null;
let estimateRequestId = 0;

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
    selectedPickup = null;
    updateTripEstimate();
    if (q.length < 2) { pickupResults.innerHTML = ""; pickupResults.classList.remove("visible"); return; }
    pickupTimer = window.setTimeout(async () => {
      const results = await searchLocations(q);
      renderResults(pickupResults, results, (r) => {
        selectedPickup = r;
        pickupInput.value = r.name.split(",")[0];
        pickupResults.innerHTML = "";
        pickupResults.classList.remove("visible");
        setPickupMarker(r.lat, r.lng);
        updateTripEstimate();
      });
    }, SEARCH_DEBOUNCE_MS);
  });

  destInput.addEventListener("input", () => {
    if (destTimer) clearTimeout(destTimer);
    const q = destInput.value.trim();
    selectedDest = null;
    updateTripEstimate();
    if (q.length < 2) { destResults.innerHTML = ""; destResults.classList.remove("visible"); return; }
    destTimer = window.setTimeout(async () => {
      const results = await searchLocations(q);
      renderResults(destResults, results, (r) => {
        selectedDest = r;
        destInput.value = r.name.split(",")[0];
        destResults.innerHTML = "";
        destResults.classList.remove("visible");
        setDestinationMarker(r.lat, r.lng);
        updateTripEstimate();
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
    const empty = document.createElement("div");
    empty.className = "search-result-item no-results";
    empty.textContent = "No results found";
    container.appendChild(empty);
    container.classList.add("visible");
    return;
  }
  for (const r of results) {
    const item = document.createElement("div");
    item.className = "search-result-item";
    const parts = r.name.split(",");
    const main = parts[0];
    const sub = parts.slice(1, 3).join(",").trim();

    const icon = document.createElement("span");
    icon.className = "result-pin";

    const text = document.createElement("div");
    const mainEl = document.createElement("div");
    mainEl.className = "result-main";
    mainEl.textContent = main;

    const subEl = document.createElement("div");
    subEl.className = "result-sub";
    subEl.textContent = sub;

    text.append(mainEl, subEl);
    item.append(icon, text);
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
    btn.disabled = false;
  } else {
    btn.classList.remove("visible");
    btn.disabled = true;
  }
}

async function updateTripEstimate(): Promise<void> {
  updateConfirmButton();
  const currentRequestId = ++estimateRequestId;

  if (!selectedPickup || !selectedDest) {
    clearRoute();
    setEstimateIdle();
    return;
  }

  setEstimateLoading();

  try {
    const estimate = await getRouteEstimate(
      { lat: selectedPickup.lat, lng: selectedPickup.lng },
      { lat: selectedDest.lat, lng: selectedDest.lng }
    );
    if (currentRequestId !== estimateRequestId) return;

    setRoute(estimate.route);
    setEstimateValues(estimate);
  } catch {
    if (currentRequestId !== estimateRequestId) return;
    setEstimateError();
  }
}

function setEstimateIdle(): void {
  setText("ride-eta", "Choose route");
  setText("ride-distance", "--");
  setText("ride-fare", "--");
}

function setEstimateLoading(): void {
  setText("ride-eta", "Estimating...");
  setText("ride-distance", "--");
  setText("ride-fare", "--");
}

function setEstimateError(): void {
  clearRoute();
  setText("ride-eta", "Unavailable");
  setText("ride-distance", "--");
  setText("ride-fare", "--");
}

function setEstimateValues(estimate: RouteEstimate): void {
  setText("ride-eta", formatDuration(estimate.duration_min));
  setText("ride-distance", formatDistance(estimate.distance_km));
  setText("ride-fare", formatFare(estimate.fare));
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatDuration(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
}

function formatDistance(distanceKm: number): string {
  const miles = distanceKm * 0.621371;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

function formatFare(fare: number): string {
  return `$${fare.toFixed(2)}`;
}
