import { showScreen, showToast, setLoading, getFormData, validateEmail, validateRequired } from "./ui.js";
import {
  signupRider,
  loginRider,
  signupDriver,
  loginDriver,
  getMe,
  setToken,
  getToken,
  clearToken,
  requestRide,
  connectRideSocket,
  connectDriverSocket,
  updateDriverLocation,
  updateDriverAvailability,
  updateRiderLocation,
  getRouteEstimate,
  getDriverRideRequest,
  acceptRide,
  rejectRide,
  updateRideStatus,
  cancelRide,
} from "./api.js";
import { clearRealtimeMarkers, clearRoute, initMap, setDriverMarker, setRiderMarker, setRoute } from "./map.js";
import { clearDirections, formatRouteMeta, renderDirections } from "./directions.js";
import { initLocationSearch, getSelectedPickup, getSelectedDest } from "./location.js";
import {
  DEFAULT_CENTER,
  LOCATION_PUBLISH_DISTANCE_METERS,
  LOCATION_PUBLISH_INTERVAL_MS,
  REROUTE_DISTANCE_METERS,
  REROUTE_INTERVAL_MS,
} from "./config.js";
import type { RealtimeSocket } from "./socket.js";
import type { LatLng, Ride, RideStatus, RouteEstimate, UserProfile } from "./types.js";

let currentUser: UserProfile | null = null;
let currentRiderRideSocket: RealtimeSocket | null = null;
let currentDriverSocket: RealtimeSocket | null = null;
let activeDriverRide: Ride | null = null;
let activeRiderRideId: string | null = null;
let driverLocationWatchId: number | null = null;
let riderLocationWatchId: number | null = null;
let lastDriverLocationSentAt = 0;
let lastRiderLocationSentAt = 0;
let lastDriverLocation: LatLng | null = null;
let lastRiderLocation: LatLng | null = null;
let isDriverOnline = false;
let driverAvailabilityLoading = false;
let riderRouteState = createLiveRouteState();
let driverRouteState = createLiveRouteState();

type LiveRouteState = {
  rideId: string | null;
  leg: string | null;
  origin: LatLng | null;
  requestedAt: number;
  requestId: number;
};

type LiveRouteTarget = {
  leg: string;
  label: string;
  origin: LatLng;
  destination: LatLng;
};

document.addEventListener("DOMContentLoaded", async () => {
  bindAll();
  const token = getToken();
  if (token) {
    try {
      const user = await getMe();
      currentUser = user;
      if (user.role === "rider") {
        showRiderHome();
      } else {
        showDriverHome(user);
      }
      showToast(`Welcome back, ${user.name}!`, "success");
      return;
    } catch {
      clearToken();
    }
  }

  showScreen("screen-welcome");
});

function bindAll(): void {
  bindClick("btn-role-rider", () => showScreen("screen-rider-login"));
  bindClick("btn-role-driver", () => showScreen("screen-driver-login"));
  bindClick("link-rider-signup", () => showScreen("screen-rider-signup"));
  bindClick("link-rider-login", () => showScreen("screen-rider-login"));
  bindClick("link-driver-signup", () => showScreen("screen-driver-signup"));
  bindClick("link-driver-login", () => showScreen("screen-driver-login"));
  bindClick("link-back-welcome-r", () => showScreen("screen-welcome"));
  bindClick("link-back-welcome-d", () => showScreen("screen-welcome"));
  bindClick("link-back-welcome-rs", () => showScreen("screen-welcome"));
  bindClick("link-back-welcome-ds", () => showScreen("screen-welcome"));
  bindClick("btn-logout-rider", () => { logout(); });
  bindClick("btn-logout-driver", () => { logout(); });
  bindRiderLogin();
  bindRiderSignup();
  bindDriverLogin();
  bindDriverSignup();
  bindConfirmRide();
  bindRiderCancellation();
  bindDriverRideActions();
  bindDriverAvailabilityToggle();
}

function showRiderHome(): void {
  stopRiderLocationTracking();
  showScreen("screen-rider-home");
  setTimeout(() => {
    initMap("map");
    initLocationSearch();
    resetRiderRideStatus();
    clearRealtimeMarkers();
  }, 100);
}

function showDriverHome(user: UserProfile): void {
  showScreen("screen-driver-home");
  isDriverOnline = user.availability !== "offline";
  renderDriverAvailability(user.availability);
  renderDriverRequest(null);
  connectDriverUpdates(user.id);
  if (isDriverOnline) {
    startDriverLocationTracking();
  } else {
    stopDriverLocationTracking();
  }
  void refreshDriverRideRequest();
}

function logout(): void {
  if (currentUser?.role === "driver" && isDriverOnline) {
    void updateDriverAvailability(false).catch(() => {});
  }
  currentRiderRideSocket?.close();
  currentDriverSocket?.close();
  stopDriverLocationTracking();
  stopRiderLocationTracking();
  currentRiderRideSocket = null;
  currentDriverSocket = null;
  activeDriverRide = null;
  activeRiderRideId = null;
  isDriverOnline = false;
  clearDirections("rider");
  clearDirections("driver");
  clearRoute();
  currentUser = null;
  clearToken();
  showScreen("screen-welcome");
  showToast("Logged out", "info");
}

function bindRiderLogin(): void {
  const form = document.getElementById("form-rider-login") as HTMLFormElement;
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]") as HTMLButtonElement;
    const data = getFormData("form-rider-login");

    if (!validateEmail(data.email)) { showToast("Enter a valid email", "error"); return; }
    if (!data.password) { showToast("Password is required", "error"); return; }

    setLoading(btn, true);
    try {
      const res = await loginRider({ email: data.email, password: data.password });
      setToken(res.token);
      currentUser = res.user;
      showToast(`Welcome, ${res.user.name}!`, "success");
      showRiderHome();
    } catch (err: any) {
      showToast(err.message || "Login failed", "error");
    } finally {
      setLoading(btn, false);
    }
  });
}

function bindRiderSignup(): void {
  const form = document.getElementById("form-rider-signup") as HTMLFormElement;
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]") as HTMLButtonElement;
    const data = getFormData("form-rider-signup");

    const missing = validateRequired(data, ["name", "email", "phone", "password"]);
    if (missing) { showToast(missing, "error"); return; }
    if (!validateEmail(data.email)) { showToast("Enter a valid email", "error"); return; }
    if (data.password.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }

    setLoading(btn, true);
    try {
      await signupRider({ name: data.name, email: data.email, phone: data.phone, password: data.password });
      showToast("Account created! Please log in.", "success");
      showScreen("screen-rider-login");
    } catch (err: any) {
      showToast(err.message || "Signup failed", "error");
    } finally {
      setLoading(btn, false);
    }
  });
}

function bindDriverLogin(): void {
  const form = document.getElementById("form-driver-login") as HTMLFormElement;
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]") as HTMLButtonElement;
    const data = getFormData("form-driver-login");

    if (!validateEmail(data.email)) { showToast("Enter a valid email", "error"); return; }
    if (!data.password) { showToast("Password is required", "error"); return; }

    setLoading(btn, true);
    try {
      const res = await loginDriver({ email: data.email, password: data.password });
      setToken(res.token);
      currentUser = res.user;
      showToast(`Welcome, ${res.user.name}!`, "success");
      showDriverHome(res.user);
    } catch (err: any) {
      showToast(err.message || "Login failed", "error");
    } finally {
      setLoading(btn, false);
    }
  });
}

function bindDriverSignup(): void {
  const btnNext1 = document.getElementById("btn-driver-step-2") as HTMLButtonElement;
  const btnNext2 = document.getElementById("btn-driver-step-3") as HTMLButtonElement;
  const btnBack1 = document.getElementById("btn-driver-back-1") as HTMLButtonElement;
  const btnBack2 = document.getElementById("btn-driver-back-2") as HTMLButtonElement;
  const btnSubmit = document.getElementById("btn-driver-submit") as HTMLButtonElement;

  const step1 = document.getElementById("driver-step-1") as HTMLDivElement;
  const step2 = document.getElementById("driver-step-2") as HTMLDivElement;
  const step3 = document.getElementById("driver-step-3") as HTMLDivElement;
  const indicators = document.querySelectorAll(".step-indicator .step");

  function setStep(n: number) {
    [step1, step2, step3].forEach((s, i) => {
      if (s) { s.style.display = i === n ? "block" : "none"; }
    });
    indicators.forEach((ind, i) => {
      ind.classList.toggle("active", i <= n);
    });
  }

  if (btnNext1) btnNext1.addEventListener("click", () => {
    const data = getFormData("form-driver-signup");
    const missing = validateRequired(data, ["name", "email", "phone", "password"]);
    if (missing) { showToast(missing, "error"); return; }
    if (!validateEmail(data.email)) { showToast("Enter a valid email", "error"); return; }
    if (data.password.length < 6) { showToast("Password must be 6+ chars", "error"); return; }
    setStep(1);
  });

  if (btnNext2) btnNext2.addEventListener("click", () => {
    const data = getFormData("form-driver-signup");
    const missing = validateRequired(data, ["vehicle_make", "vehicle_model", "vehicle_year", "vehicle_color", "vehicle_plate"]);
    if (missing) { showToast(missing, "error"); return; }
    setStep(2);
  });

  if (btnBack1) btnBack1.addEventListener("click", () => setStep(0));
  if (btnBack2) btnBack2.addEventListener("click", () => setStep(1));

  if (btnSubmit) btnSubmit.addEventListener("click", async () => {
    const data = getFormData("form-driver-signup");
    const missing = validateRequired(data, ["license_number"]);
    if (missing) { showToast(missing, "error"); return; }

    setLoading(btnSubmit, true);
    try {
      await signupDriver({
        name: data.name, email: data.email, phone: data.phone, password: data.password,
        vehicle_make: data.vehicle_make, vehicle_model: data.vehicle_model,
        vehicle_year: parseInt(data.vehicle_year), vehicle_color: data.vehicle_color,
        vehicle_plate: data.vehicle_plate, license_number: data.license_number,
      });
      showToast("Driver account created! Please log in.", "success");
      showScreen("screen-driver-login");
    } catch (err: any) {
      showToast(err.message || "Signup failed", "error");
    } finally {
      setLoading(btnSubmit, false);
    }
  });
}

function connectRiderRideUpdates(ride: Ride): void {
  currentRiderRideSocket?.close();
  activeRiderRideId = ride.id;
  currentRiderRideSocket = connectRideSocket(ride.id, (data) => {
    if (data.type === "ride_update") {
      renderRideLocations(data.ride);
      renderRiderRideStatus(data.ride);
      void refreshRiderRoute(data.ride);
      if (data.ride.status === "no_drivers_available") {
        stopRiderLocationTracking(false);
      }
      if (isTerminalRideStatus(data.ride.status)) {
        stopRiderLocationTracking();
      }
      if (isTerminalRideStatus(data.ride.status)) {
        currentRiderRideSocket?.close();
        currentRiderRideSocket = null;
        clearRealtimeMarkers();
        clearDirections("rider");
        clearRoute();
      }
    }
  });
  startRiderLocationTracking(ride.id);
  void refreshRiderRoute(ride, true);
}

function connectDriverUpdates(driverId: string): void {
  currentDriverSocket?.close();
  currentDriverSocket = connectDriverSocket(driverId, (data) => {
    if (data.type === "ride_request" || data.type === "ride_update") {
      renderDriverRequest(data.ride);
      void refreshDriverRoute(data.ride, data.type === "ride_request");
      if (data.type === "ride_request" && data.ride?.status === "pending_driver") {
        showToast("New ride request", "info");
      }
    }
    if (data.type === "driver_location_update") {
      if (data.ride) {
        renderDriverRequest(data.ride);
        void refreshDriverRoute(data.ride);
      } else {
        renderDriverAvailability(driverAvailabilityForRide(activeDriverRide));
      }
    }
    if (data.type === "availability_update") {
      isDriverOnline = data.online;
      renderDriverAvailability(data.availability);
      if (data.online) startDriverLocationTracking();
      else {
        stopDriverLocationTracking();
        activeDriverRide = null;
        clearDirections("driver");
      }
      renderDriverRequest(activeDriverRide);
    }
    if (data.type === "ride_cleared") {
      renderDriverRequest(null);
      clearDirections("driver");
    }
  });
}

function startDriverLocationTracking(): void {
  if (!currentUser || currentUser.role !== "driver") return;
  if (!isDriverOnline) return;
  stopDriverLocationTracking();

  if (!navigator.geolocation) {
    void publishDriverLocation(defaultLocation(), true);
    return;
  }

  driverLocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      void publishDriverLocation(
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        !lastDriverLocation
      );
    },
    () => {
      if (!lastDriverLocation) {
        void publishDriverLocation(defaultLocation(), true);
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

function stopDriverLocationTracking(): void {
  if (driverLocationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(driverLocationWatchId);
  }
  driverLocationWatchId = null;
  lastDriverLocation = null;
  lastDriverLocationSentAt = 0;
}

function startRiderLocationTracking(rideId: string): void {
  stopRiderLocationTracking(false);
  activeRiderRideId = rideId;

  if (!navigator.geolocation) {
    const pickup = getSelectedPickup();
    if (pickup) {
      void publishRiderLocation({ lat: pickup.lat, lng: pickup.lng }, true);
    }
    return;
  }

  riderLocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      void publishRiderLocation(
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        !lastRiderLocation
      );
    },
    () => {
      const pickup = getSelectedPickup();
      if (!lastRiderLocation && pickup) {
        void publishRiderLocation({ lat: pickup.lat, lng: pickup.lng }, true);
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

function stopRiderLocationTracking(clearRide = true): void {
  if (riderLocationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(riderLocationWatchId);
  }
  riderLocationWatchId = null;
  lastRiderLocation = null;
  lastRiderLocationSentAt = 0;
  if (clearRide) activeRiderRideId = null;
}

async function publishDriverLocation(location: LatLng, force = false): Promise<void> {
  if (!currentUser || currentUser.role !== "driver") return;
  if (!isDriverOnline) return;
  if (!force && !shouldPublishLocation(location, lastDriverLocation, lastDriverLocationSentAt)) return;

  lastDriverLocation = location;
  lastDriverLocationSentAt = Date.now();
  renderDriverAvailability(driverAvailabilityForRide(activeDriverRide));
  if (activeDriverRide) {
    void refreshDriverRoute(activeDriverRide);
  }

  const sentOverSocket = currentDriverSocket?.sendJson({
    type: "driver_location_update",
    location,
  }) ?? false;

  if (sentOverSocket) return;

  try {
    await updateDriverLocation(location);
  } catch (err: any) {
    showToast(err.message || "Could not go online", "error");
    isDriverOnline = false;
    renderDriverAvailability("offline");
  }
}

async function publishRiderLocation(location: LatLng, force = false): Promise<void> {
  if (!activeRiderRideId) return;
  if (!force && !shouldPublishLocation(location, lastRiderLocation, lastRiderLocationSentAt)) return;

  lastRiderLocation = location;
  lastRiderLocationSentAt = Date.now();
  setRiderMarker(location);

  const sentOverSocket = currentRiderRideSocket?.sendJson({
    type: "rider_location_update",
    location,
  }) ?? false;

  if (sentOverSocket) return;

  try {
    await updateRiderLocation(activeRiderRideId, location);
  } catch {
    // The next geolocation tick or socket reconnect will retry.
  }
}

async function refreshDriverRideRequest(): Promise<void> {
  try {
    const ride = await getDriverRideRequest();
    renderDriverRequest(ride);
    if (ride) void refreshDriverRoute(ride, true);
  } catch {
    renderDriverRequest(null);
    clearDirections("driver");
  }
}

function defaultLocation(): LatLng {
  return { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
}

function isTerminalRideStatus(status: RideStatus): boolean {
  return status === "completed" || status === "cancelled";
}

function isRiderCancelableStatus(status: RideStatus): boolean {
  return (
    status === "matching" ||
    status === "pending_driver" ||
    status === "accepted" ||
    status === "arrived" ||
    status === "no_drivers_available"
  );
}

function shouldPublishLocation(location: LatLng, previous: LatLng | null, sentAt: number): boolean {
  if (!previous) return true;
  const elapsed = Date.now() - sentAt;
  if (elapsed >= LOCATION_PUBLISH_INTERVAL_MS) return true;
  return distanceMeters(previous, location) >= LOCATION_PUBLISH_DISTANCE_METERS;
}

function renderRideLocations(ride: Ride): void {
  if (ride.rider_location) {
    setRiderMarker(ride.rider_location);
  }

  if (ride.driver_location) {
    setDriverMarker(ride.driver_location);
  }
}

function createLiveRouteState(): LiveRouteState {
  return {
    rideId: null,
    leg: null,
    origin: null,
    requestedAt: 0,
    requestId: 0,
  };
}

async function refreshRiderRoute(ride: Ride, force = false): Promise<void> {
  const target = riderRouteTarget(ride);

  if (!target) {
    if (isTerminalRideStatus(ride.status)) {
      clearDirections("rider");
      clearRoute();
      riderRouteState = createLiveRouteState();
    }
    return;
  }

  await refreshLiveRoute("rider", riderRouteState, ride.id, target, force, true);
}

async function refreshDriverRoute(ride: Ride, force = false): Promise<void> {
  const target = driverRouteTarget(ride);

  if (!target) {
    clearDirections("driver");
    driverRouteState = createLiveRouteState();
    return;
  }

  await refreshLiveRoute("driver", driverRouteState, ride.id, target, force, false);
}

async function refreshLiveRoute(
  panel: "rider" | "driver",
  state: LiveRouteState,
  rideId: string,
  target: LiveRouteTarget,
  force: boolean,
  drawMapRoute: boolean
): Promise<void> {
  const now = Date.now();
  const sameRoute =
    state.rideId === rideId &&
    state.leg === target.leg &&
    state.origin !== null &&
    distanceMeters(state.origin, target.origin) < REROUTE_DISTANCE_METERS;
  const recent = now - state.requestedAt < REROUTE_INTERVAL_MS;

  if (!force && sameRoute && recent) return;

  const requestId = state.requestId + 1;
  state.rideId = rideId;
  state.leg = target.leg;
  state.origin = target.origin;
  state.requestedAt = now;
  state.requestId = requestId;

  try {
    const estimate = await getRouteEstimate(target.origin, target.destination);
    if (state.requestId !== requestId) return;

    renderDirections(panel, estimate.steps, target.label, estimateMeta(estimate));
    if (drawMapRoute) {
      setRoute(estimate.route);
    }
  } catch {
    // Keep the last successful directions visible while the next tick retries.
  }
}

function riderRouteTarget(ride: Ride): LiveRouteTarget | null {
  if (
    (ride.status === "pending_driver" || ride.status === "accepted" || ride.status === "arrived") &&
    ride.driver_location
  ) {
    return {
      leg: "driver-to-pickup",
      label: "Driver to pickup",
      origin: ride.driver_location,
      destination: ride.pickup,
    };
  }

  if (ride.status === "in_progress") {
    return {
      leg: "trip-to-destination",
      label: "To destination",
      origin: ride.rider_location || ride.driver_location || ride.pickup,
      destination: ride.destination,
    };
  }

  return null;
}

function driverRouteTarget(ride: Ride): LiveRouteTarget | null {
  if (ride.status === "pending_driver" || ride.status === "accepted") {
    const origin = lastDriverLocation || ride.driver_location;
    if (!origin) return null;
    return {
      leg: "driver-to-pickup",
      label: "To pickup",
      origin,
      destination: ride.pickup,
    };
  }

  if (ride.status === "arrived") {
    return {
      leg: "pickup-to-destination",
      label: "Trip route",
      origin: ride.pickup,
      destination: ride.destination,
    };
  }

  if (ride.status === "in_progress") {
    const origin = lastDriverLocation || ride.driver_location || ride.rider_location || ride.pickup;
    return {
      leg: "trip-to-destination",
      label: "To destination",
      origin,
      destination: ride.destination,
    };
  }

  return null;
}

function estimateMeta(estimate: RouteEstimate): string {
  return formatRouteMeta(estimate.distance_km, estimate.duration_min);
}

function distanceMeters(a: LatLng, b: LatLng): number {
  return distanceKm(a, b) * 1000;
}

function distanceKm(a: LatLng, b: LatLng): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function renderRiderRideStatus(ride: Ride | null): void {
  const card = document.getElementById("ride-status-card");
  const title = document.getElementById("ride-status-title");
  const body = document.getElementById("ride-status-body");
  const meta = document.getElementById("ride-status-meta");
  const btn = document.getElementById("confirm-ride-btn") as HTMLButtonElement;
  const cancelBtn = document.getElementById("cancel-ride-btn") as HTMLButtonElement;

  if (!card || !title || !body || !meta || !btn || !cancelBtn) return;

  if (!ride) {
    card.classList.add("is-hidden");
    cancelBtn.classList.add("is-hidden");
    btn.disabled = false;
    btn.innerHTML = `<span>Confirm pickup</span><i data-lucide="navigation"></i>`;
    clearRealtimeMarkers();
    clearDirections("rider");
    refreshDynamicIcons();
    return;
  }

  card.classList.remove("is-hidden");
  cancelBtn.classList.toggle("is-hidden", !isRiderCancelableStatus(ride.status));

  if (ride.status === "pending_driver") {
    title.textContent = "Driver matched";
    body.textContent = `${ride.driver?.name || "A nearby driver"} is reviewing your request.`;
    meta.textContent = ride.driver_location
      ? `${formatDistanceKm(distanceKm(ride.driver_location, ride.pickup))} from pickup`
      : ride.driver_distance_km === null
        ? "Waiting for acceptance"
        : `${formatDistanceKm(ride.driver_distance_km)} away`;
    btn.disabled = true;
    btn.innerHTML = `<span>Waiting for driver</span><i data-lucide="loader-circle"></i>`;
  } else if (ride.status === "accepted") {
    const vehicle = ride.driver?.vehicle;
    title.textContent = "Ride accepted";
    body.textContent = ride.driver
      ? `${ride.driver.name} is on the way${vehicle ? ` in a ${vehicle.color} ${vehicle.make} ${vehicle.model}` : ""}.`
      : "Your driver is on the way.";
    meta.textContent = ride.driver_location
      ? `${formatDistanceKm(distanceKm(ride.driver_location, ride.pickup))} from pickup`
      : vehicle?.plate
        ? `Plate ${vehicle.plate}`
        : "Meet at the pickup point";
    btn.disabled = true;
    btn.innerHTML = `<span>Driver on the way</span><i data-lucide="car-front"></i>`;
  } else if (ride.status === "arrived") {
    title.textContent = "Driver arrived";
    body.textContent = ride.driver
      ? `${ride.driver.name} is at the pickup point.`
      : "Your driver is at the pickup point.";
    meta.textContent = ride.driver?.vehicle?.plate
      ? `Plate ${ride.driver.vehicle.plate}`
      : "Meet your driver";
    btn.disabled = true;
    btn.innerHTML = `<span>Driver arrived</span><i data-lucide="map-pin-check"></i>`;
  } else if (ride.status === "in_progress") {
    title.textContent = "Trip in progress";
    body.textContent = "You are on your way to the destination.";
    meta.textContent = "Enjoy the ride";
    btn.disabled = true;
    btn.innerHTML = `<span>On trip</span><i data-lucide="route"></i>`;
  } else if (ride.status === "completed") {
    title.textContent = "Trip complete";
    body.textContent = "You have arrived at the destination.";
    meta.textContent = "Ready when you are";
    btn.disabled = false;
    btn.innerHTML = `<span>Book another ride</span><i data-lucide="navigation"></i>`;
  } else if (ride.status === "cancelled") {
    title.textContent = "Ride cancelled";
    body.textContent = "This ride is no longer active.";
    meta.textContent = "Choose a route to try again";
    btn.disabled = false;
    btn.innerHTML = `<span>Try again</span><i data-lucide="refresh-cw"></i>`;
  } else if (ride.status === "no_drivers_available") {
    title.textContent = "No drivers available";
    body.textContent = "No online drivers are close enough right now.";
    meta.textContent = "Try again in a moment";
    btn.disabled = false;
    btn.innerHTML = `<span>Try again</span><i data-lucide="refresh-cw"></i>`;
  } else {
    title.textContent = "Searching for driver";
    body.textContent = "Checking nearby online drivers.";
    meta.textContent = "Matching";
    btn.disabled = true;
    btn.innerHTML = `<span>Searching</span><i data-lucide="loader-circle"></i>`;
  }

  refreshDynamicIcons();
}

function resetRiderRideStatus(): void {
  renderRiderRideStatus(null);
}

function renderDriverRequest(ride: Ride | null): void {
  const card = document.getElementById("driver-request-card");
  const status = document.getElementById("driver-location-status");
  const title = document.getElementById("driver-request-title");
  const body = document.getElementById("driver-request-body");
  const pickup = document.getElementById("driver-request-pickup");
  const destination = document.getElementById("driver-request-destination");
  const distance = document.getElementById("driver-request-distance");
  const riderLocation = document.getElementById("driver-request-rider-location");
  const actions = document.getElementById("driver-request-actions");
  const rejectBtn = document.getElementById("btn-reject-ride") as HTMLButtonElement;
  const acceptBtn = document.getElementById("btn-accept-ride") as HTMLButtonElement;
  const arrivedBtn = document.getElementById("btn-arrived-ride") as HTMLButtonElement;
  const startBtn = document.getElementById("btn-start-ride") as HTMLButtonElement;
  const completeBtn = document.getElementById("btn-complete-ride") as HTMLButtonElement;
  const cancelBtn = document.getElementById("btn-cancel-driver-ride") as HTMLButtonElement;

  if (!card || !status || !title || !body || !pickup || !destination || !distance || !riderLocation || !actions) return;

  const actionsEl = actions;
  const actionButtons = [rejectBtn, acceptBtn, arrivedBtn, startBtn, completeBtn, cancelBtn]
    .filter(Boolean) as HTMLButtonElement[];

  function showOnlyActions(...buttons: HTMLButtonElement[]): void {
    actionButtons.forEach((button) => button.classList.add("is-hidden"));
    buttons.forEach((button) => button.classList.remove("is-hidden"));
    actionsEl.classList.toggle("single-action", buttons.length === 1);
    actionsEl.classList.toggle("is-hidden", buttons.length === 0);
  }

  activeDriverRide = ride;
  card.classList.toggle("has-request", Boolean(ride));

  if (!ride) {
    renderDriverAvailability(isDriverOnline ? "available" : "offline");
    title.textContent = isDriverOnline ? "Waiting for requests" : "You're offline";
    body.textContent = isDriverOnline
      ? "You are available for nearby rider requests."
      : "Go online when you are ready to receive trips.";
    pickup.textContent = "--";
    destination.textContent = "--";
    distance.textContent = "--";
    riderLocation.textContent = "--";
    clearDirections("driver");
    showOnlyActions();
    return;
  }

  pickup.textContent = formatPoint(ride.pickup);
  destination.textContent = formatPoint(ride.destination);
  distance.textContent = ride.driver_distance_km === null ? "--" : formatDistanceKm(ride.driver_distance_km);
  riderLocation.textContent = ride.rider_location ? formatPoint(ride.rider_location) : "--";

  if (ride.status === "accepted") {
    renderDriverAvailability("busy");
    title.textContent = "Ride accepted";
    body.textContent = "Head to the pickup point.";
    showOnlyActions(cancelBtn, arrivedBtn);
  } else if (ride.status === "arrived") {
    renderDriverAvailability("busy", "At pickup");
    title.textContent = "Rider pickup";
    body.textContent = "Start the trip when the rider is in the car.";
    showOnlyActions(cancelBtn, startBtn);
  } else if (ride.status === "in_progress") {
    renderDriverAvailability("busy", "On trip");
    title.textContent = "Trip in progress";
    body.textContent = "Complete the ride after reaching the destination.";
    showOnlyActions(completeBtn);
  } else if (ride.status === "completed") {
    renderDriverAvailability(isDriverOnline ? "available" : "offline", "Completed");
    title.textContent = "Ride complete";
    body.textContent = "The trip has been completed.";
    clearDirections("driver");
    showOnlyActions();
  } else if (ride.status === "cancelled") {
    renderDriverAvailability(isDriverOnline ? "available" : "offline", "Cancelled");
    title.textContent = "Ride cancelled";
    body.textContent = "This ride is no longer active.";
    clearDirections("driver");
    showOnlyActions();
  } else if (ride.status === "pending_driver") {
    renderDriverAvailability("pending", "New request");
    title.textContent = "Incoming ride";
    body.textContent = "Review the pickup and destination before responding.";
    showOnlyActions(rejectBtn, acceptBtn);
  } else {
    renderDriverAvailability(isDriverOnline ? "available" : "offline", "Matching");
    title.textContent = "Finding another driver";
    body.textContent = "The rider request is being rematched.";
    showOnlyActions();
  }

  refreshDynamicIcons();
}

function bindDriverRideActions(): void {
  const acceptBtn = document.getElementById("btn-accept-ride") as HTMLButtonElement;
  const rejectBtn = document.getElementById("btn-reject-ride") as HTMLButtonElement;
  const arrivedBtn = document.getElementById("btn-arrived-ride") as HTMLButtonElement;
  const startBtn = document.getElementById("btn-start-ride") as HTMLButtonElement;
  const completeBtn = document.getElementById("btn-complete-ride") as HTMLButtonElement;
  const cancelBtn = document.getElementById("btn-cancel-driver-ride") as HTMLButtonElement;

  if (acceptBtn) {
    acceptBtn.addEventListener("click", async () => {
      if (!activeDriverRide) return;
      setLoading(acceptBtn, true);
      try {
        const ride = await acceptRide(activeDriverRide.id);
        renderDriverRequest(ride);
        void refreshDriverRoute(ride, true);
        showToast("Ride accepted", "success");
      } catch (err: any) {
        showToast(err.message || "Could not accept ride", "error");
      } finally {
        setLoading(acceptBtn, false);
      }
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener("click", async () => {
      if (!activeDriverRide) return;
      setLoading(rejectBtn, true);
      try {
        await rejectRide(activeDriverRide.id);
        renderDriverRequest(null);
        clearDirections("driver");
        showToast("Ride rejected", "info");
      } catch (err: any) {
        showToast(err.message || "Could not reject ride", "error");
      } finally {
        setLoading(rejectBtn, false);
      }
    });
  }

  bindDriverProgressAction(arrivedBtn, "arrived", "Marked arrived");
  bindDriverProgressAction(startBtn, "in_progress", "Trip started");
  bindDriverProgressAction(completeBtn, "completed", "Ride completed");
  bindDriverCancelAction(cancelBtn);
}

function bindRiderCancellation(): void {
  const button = document.getElementById("cancel-ride-btn") as HTMLButtonElement;
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!activeRiderRideId) return;
    setLoading(button, true);
    try {
      const ride = await cancelRide(activeRiderRideId);
      renderRiderRideStatus(ride);
      stopRiderLocationTracking();
      currentRiderRideSocket?.close();
      currentRiderRideSocket = null;
      clearRealtimeMarkers();
      clearDirections("rider");
      clearRoute();
      showToast("Ride cancelled", "info");
    } catch (err: any) {
      showToast(err.message || "Could not cancel ride", "error");
    } finally {
      setLoading(button, false);
    }
  });
}

function bindDriverCancelAction(button: HTMLButtonElement | null): void {
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!activeDriverRide) return;
    setLoading(button, true);
    try {
      const ride = await cancelRide(activeDriverRide.id);
      renderDriverRequest(ride);
      clearDirections("driver");
      showToast("Ride cancelled", "info");
    } catch (err: any) {
      showToast(err.message || "Could not cancel ride", "error");
    } finally {
      setLoading(button, false);
    }
  });
}

function bindDriverProgressAction(
  button: HTMLButtonElement | null,
  status: RideStatus,
  successMessage: string
): void {
  if (!button) return;
  button.addEventListener("click", async () => {
    if (!activeDriverRide) return;
    setLoading(button, true);
    try {
      const ride = await updateRideStatus(activeDriverRide.id, status);
      renderDriverRequest(ride);
      void refreshDriverRoute(ride, true);
      showToast(successMessage, "success");
    } catch (err: any) {
      showToast(err.message || "Could not update ride", "error");
    } finally {
      setLoading(button, false);
    }
  });
}


function formatDistanceKm(distanceKm: number): string {
  const miles = distanceKm * 0.621371;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

function formatPoint(point: LatLng): string {
  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function refreshDynamicIcons(): void {
  (window as any).lucide?.createIcons();
}

function bindClick(id: string, handler: () => void): void {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

function bindConfirmRide(): void {
  const btn = document.getElementById("confirm-ride-btn") as HTMLButtonElement;
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (!currentUser) return;
    const pickup = getSelectedPickup();
    const dest = getSelectedDest();
    if (!pickup || !dest) {
      showToast("Please select pickup and destination", "error");
      return;
    }

    setLoading(btn, true);
    try {
      const ride = await requestRide(
        currentUser.id,
        { lat: pickup.lat, lng: pickup.lng },
        { lat: dest.lat, lng: dest.lng }
      );
      setLoading(btn, false);
      connectRiderRideUpdates(ride);
      renderRideLocations(ride);
      renderRiderRideStatus(ride);
      showToast("Ride requested", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to request ride", "error");
      setLoading(btn, false);
    }
  });
}
