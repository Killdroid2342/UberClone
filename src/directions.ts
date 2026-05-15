import type { RouteStep } from "./types.js";

type DirectionPanel = "rider" | "driver";

const panels: Record<DirectionPanel, {
  panelId: string;
  labelId: string;
  metaId: string;
  listId: string;
}> = {
  rider: {
    panelId: "rider-directions",
    labelId: "rider-directions-label",
    metaId: "rider-directions-meta",
    listId: "rider-directions-list",
  },
  driver: {
    panelId: "driver-directions",
    labelId: "driver-directions-label",
    metaId: "driver-directions-meta",
    listId: "driver-directions-list",
  },
};

export function renderDirections(
  panel: DirectionPanel,
  steps: RouteStep[] | null | undefined,
  label = "Directions",
  meta = ""
): void {
  const config = panels[panel];
  const panelEl = document.getElementById(config.panelId);
  const labelEl = document.getElementById(config.labelId);
  const metaEl = document.getElementById(config.metaId);
  const listEl = document.getElementById(config.listId);

  if (!panelEl || !labelEl || !metaEl || !listEl) return;

  const usableSteps = (steps || []).filter((step) => step.instruction);
  if (usableSteps.length === 0) {
    clearDirections(panel);
    return;
  }

  labelEl.textContent = label;
  metaEl.textContent = meta;
  listEl.innerHTML = "";

  for (const step of usableSteps) {
    const item = document.createElement("li");

    const text = document.createElement("span");
    text.textContent = step.instruction;

    const distance = document.createElement("strong");
    distance.textContent = formatStepDistance(step.distance_km);

    item.append(text, distance);
    listEl.appendChild(item);
  }

  panelEl.classList.remove("is-hidden");
}

export function clearDirections(panel: DirectionPanel): void {
  const config = panels[panel];
  const panelEl = document.getElementById(config.panelId);
  const listEl = document.getElementById(config.listId);
  const metaEl = document.getElementById(config.metaId);

  if (listEl) listEl.innerHTML = "";
  if (metaEl) metaEl.textContent = "";
  if (panelEl) panelEl.classList.add("is-hidden");
}

export function formatRouteMeta(distanceKm: number, durationMin: number): string {
  return `${formatDuration(durationMin)} - ${formatDistance(distanceKm)}`;
}

function formatStepDistance(distanceKm: number): string {
  if (distanceKm < 0.01) return "Now";
  if (distanceKm < 0.16) return `${Math.max(30, Math.round(distanceKm * 1000 / 10) * 10)} m`;
  return formatDistance(distanceKm);
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
