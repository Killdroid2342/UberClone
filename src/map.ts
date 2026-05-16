import type { Map, Marker, Polyline, DivIcon } from "leaflet";
declare const L: any;
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./config.js";
import type { AdminDriverSummary, AdminRideSummary, LatLng } from "./types.js";

let map: Map | null = null;
let pickupMarker: Marker | null = null;
let destinationMarker: Marker | null = null;
let driverMarker: Marker | null = null;
let riderMarker: Marker | null = null;
let routeLine: Polyline | null = null;
let adminLayers: any[] = [];

function createIcon(color: string, label: string): DivIcon {
  return L.divIcon({
    html: `<div class="map-marker" style="--marker-color:${color}"><span>${label}</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    className: "custom-marker",
  });
}

const pickupIcon = createIcon("#1f9d61", "P");
const destinationIcon = createIcon("#f1a51d", "D");
const driverIcon = createIcon("#2f67f6", "C");
const riderIcon = createIcon("#111511", "R");
const adminPickupIcon = createIcon("#1f9d61", "P");
const adminDestinationIcon = createIcon("#f1a51d", "D");
const adminDriverIcon = createIcon("#2f67f6", "D");
const adminRiderIcon = createIcon("#111511", "R");
const adminAvailableDriverIcon = createIcon("#1f9d61", "V");

function resetMapState(): void {
  if (map) map.remove();
  map = null;
  pickupMarker = null;
  destinationMarker = null;
  driverMarker = null;
  riderMarker = null;
  routeLine = null;
  adminLayers = [];
}

export function initMap(containerId: string): Map {
  resetMapState();
  map = L.map(containerId, { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
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

export function initAdminMap(containerId: string): Map {
  resetMapState();
  map = L.map(containerId, { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OSM &copy; CARTO',
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  window.setTimeout(() => map?.invalidateSize(), 0);
  return map!;
}

export function setPickupMarker(lat: number, lng: number): void {
  if (!map) return;
  if (pickupMarker) pickupMarker.setLatLng([lat, lng]);
  else pickupMarker = L.marker([lat, lng], { icon: pickupIcon }).addTo(map);
  pickupMarker!.bindPopup("Pickup").openPopup();
  fitBounds();
}

export function setDestinationMarker(lat: number, lng: number): void {
  if (!map) return;
  if (destinationMarker) destinationMarker.setLatLng([lat, lng]);
  else destinationMarker = L.marker([lat, lng], { icon: destinationIcon }).addTo(map);
  destinationMarker!.bindPopup("Destination").openPopup();
  fitBounds();
}

export function setDriverMarker(location: LatLng): void {
  if (!map) return;
  const latLng: [number, number] = [location.lat, location.lng];
  if (driverMarker) driverMarker.setLatLng(latLng);
  else driverMarker = L.marker(latLng, { icon: driverIcon }).addTo(map);
  driverMarker!.bindPopup("Driver");
  fitTrackingBounds();
}

export function setRiderMarker(location: LatLng): void {
  if (!map) return;
  const latLng: [number, number] = [location.lat, location.lng];
  if (riderMarker) riderMarker.setLatLng(latLng);
  else riderMarker = L.marker(latLng, { icon: riderIcon }).addTo(map);
  riderMarker!.bindPopup("You");
}

function fitBounds(): void {
  if (!map) return;
  if (pickupMarker && destinationMarker) {
    if (routeLine) map.removeLayer(routeLine);
    const p = pickupMarker.getLatLng();
    const d = destinationMarker.getLatLng();
    routeLine = L.polyline([p, d], { color: "#111511", weight: 5, opacity: 0.76, dashArray: "8, 10" }).addTo(map);
    map.fitBounds(L.latLngBounds([p, d]), { padding: [80, 80] });
  } else if (pickupMarker) {
    map.setView(pickupMarker.getLatLng(), 15);
  } else if (destinationMarker) {
    map.setView(destinationMarker.getLatLng(), 15);
  }
}

function fitTrackingBounds(): void {
  if (!map || !driverMarker) return;
  const points = [driverMarker.getLatLng()];

  if (pickupMarker) points.push(pickupMarker.getLatLng());
  if (destinationMarker) points.push(destinationMarker.getLatLng());
  if (riderMarker) points.push(riderMarker.getLatLng());

  if (points.length > 1) {
    map.fitBounds(L.latLngBounds(points), { padding: [90, 90], maxZoom: 16 });
  }
}

export function setRoute(points: LatLng[]): void {
  if (!map || points.length < 2) return;
  if (routeLine) map.removeLayer(routeLine);

  const newRouteLine = L.polyline(
    points.map((point) => [point.lat, point.lng]),
    {
      color: "#1f9d61",
      weight: 6,
      opacity: 0.88,
      lineCap: "round",
      lineJoin: "round",
    }
  ).addTo(map);
  routeLine = newRouteLine;

  map.fitBounds(newRouteLine.getBounds(), { padding: [90, 90] });
}

export function clearRoute(): void {
  if (!map || !routeLine) return;
  map.removeLayer(routeLine);
  routeLine = null;
}

export function clearMarkers(): void {
  if (!map) return;
  if (pickupMarker) { map.removeLayer(pickupMarker); pickupMarker = null; }
  if (destinationMarker) { map.removeLayer(destinationMarker); destinationMarker = null; }
  clearRealtimeMarkers();
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
}

export function clearRealtimeMarkers(): void {
  if (!map) return;
  if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
  if (riderMarker) { map.removeLayer(riderMarker); riderMarker = null; }
}



export function getMap(): Map | null { return map; }
