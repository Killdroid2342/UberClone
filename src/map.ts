import type { Map, Marker, Polyline, DivIcon } from "leaflet";
declare const L: any;
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./config.js";

let map: Map | null = null;
let pickupMarker: Marker | null = null;
let destinationMarker: Marker | null = null;
let routeLine: Polyline | null = null;

function createIcon(color: string, emoji: string): DivIcon {
  return L.divIcon({
    html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 12px ${color}88;border:3px solid white">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    className: "custom-marker",
  });
}

const pickupIcon = createIcon("#00d2a0", "📍");
const destinationIcon = createIcon("#6c5ce7", "🏁");

export function initMap(containerId: string): Map {
  if (map) map.remove();
  map = L.map(containerId, { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OSM &copy; CARTO',
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => { map!.setView([pos.coords.latitude, pos.coords.longitude], 15); },
      () => {}
    );
  }
  return map!;
}

