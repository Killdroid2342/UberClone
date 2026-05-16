import { showScreen, showToast, setLoading, getFormData, validateEmail, validateRequired } from "./ui.js";
import {
  signupRider,
  loginRider,
  signupDriver,
  loginDriver,
  loginAdmin,
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
  getRideHistory,
  getDriverEarnings,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createRideShare,
  getSharedRide,
  getAdminDashboard,
  updateAdminUserStatus,
  forceAdminDriverOffline,
  acceptRide,
  rejectRide,
  updateRideStatus,
  simulateRefund,
  cancelRide,
  rateRide,
  reportRideIssue,
  connectShareSocket,
} from "./api.js";
import {
  clearAdminMapLayers,
  clearRealtimeMarkers,
  clearRoute,
  initAdminMap,
  initMap,
  renderAdminActiveRidesMap,
  setDriverMarker,
  setRiderMarker,
  setRoute,
} from "./map.js";
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
import type {
  AdminDashboard,
  AdminUserSummary,
  DriverEarnings,
  FareBreakdown,
  LatLng,
  NotificationInbox,
  NotificationItem,
  Ride,
  RideStatus,
  RouteEstimate,
  SharedRide,
  TripShare,
  UserProfile,
} from "./types.js";

let currentUser: UserProfile | null = null;
let currentRiderRideSocket: RealtimeSocket | null = null;
let currentDriverSocket: RealtimeSocket | null = null;
let currentShareSocket: RealtimeSocket | null = null;
let activeDriverRide: Ride | null = null;
let activeRiderRide: Ride | null = null;
let activeRiderRideId: string | null = null;
let activeShareRideId: string | null = null;
let activeShareUrl: string | null = null;
let activeShareToken: string | null = null;
let driverLocationWatchId: number | null = null;
let riderLocationWatchId: number | null = null;
let lastDriverLocationSentAt = 0;
let lastRiderLocationSentAt = 0;
let lastDriverLocation: LatLng | null = null;
let lastRiderLocation: LatLng | null = null;
let isDriverOnline = false;
let driverAvailabilityLoading = false;
let activeRefundRideId: string | null = null;
let activeRiderRatingRideId: string | null = null;
let activeDriverRatingRideId: string | null = null;
let activeRiderIssueRideId: string | null = null;
let activeDriverIssueRideId: string | null = null;
let riderSelectedRating = 5;
let driverSelectedRating = 5;
let riderRouteState = createLiveRouteState();
let driverRouteState = createLiveRouteState();
let adminDashboardRefreshTimer: number | null = null;

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
  const shareToken = new URLSearchParams(window.location.search).get("share");
  if (shareToken) {
    void showSharedTrip(shareToken);
    return;
  }

  const token = getToken();
  if (token) {
    try {
      const user = await getMe();
      currentUser = user;
      if (user.role === "rider") {
        showRiderHome();
      } else if (user.role === "driver") {
        showDriverHome(user);
      } else {
        showAdminHome(user);
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
  bindClick("btn-role-admin", () => showScreen("screen-admin-login"));
  bindClick("link-rider-signup", () => showScreen("screen-rider-signup"));
  bindClick("link-rider-login", () => showScreen("screen-rider-login"));
  bindClick("link-driver-signup", () => showScreen("screen-driver-signup"));
  bindClick("link-driver-login", () => showScreen("screen-driver-login"));
  bindClick("link-back-welcome-r", () => showScreen("screen-welcome"));
  bindClick("link-back-welcome-d", () => showScreen("screen-welcome"));
  bindClick("link-back-welcome-a", () => showScreen("screen-welcome"));
  bindClick("link-back-welcome-rs", () => showScreen("screen-welcome"));
  bindClick("link-back-welcome-ds", () => showScreen("screen-welcome"));
  bindClick("btn-logout-rider", () => { logout(); });
  bindClick("btn-logout-driver", () => { logout(); });
  bindClick("btn-logout-admin", () => { logout(); });
  bindRiderLogin();
  bindRiderSignup();
  bindDriverLogin();
  bindDriverSignup();
  bindAdminLogin();
  bindConfirmRide();
  bindRiderCancellation();
  bindRefundSimulation();
  bindTripSharing();
  bindRatingControls("rider");
  bindRatingControls("driver");
  bindRatingSubmission("rider");
  bindRatingSubmission("driver");
  bindIssueReport("rider");
  bindIssueReport("driver");
  bindDriverRideActions();
  bindDriverAvailabilityToggle();
  bindClick("btn-refresh-rider-history", () => { void refreshRideHistory(); });
  bindClick("btn-refresh-driver-earnings", () => { void refreshDriverEarnings(); });
  bindClick("btn-refresh-rider-notifications", () => { void refreshNotifications("rider"); });
  bindClick("btn-refresh-driver-notifications", () => { void refreshNotifications("driver"); });
  bindClick("btn-read-rider-notifications", () => { void readAllNotifications("rider"); });
  bindClick("btn-read-driver-notifications", () => { void readAllNotifications("driver"); });
  bindClick("btn-refresh-admin-dashboard", () => { void refreshAdminDashboard(); });
  bindClick("btn-refresh-share-trip", () => { if (activeShareToken) void loadSharedTrip(activeShareToken); });
  bindClick("btn-close-share-view", () => {
    currentShareSocket?.close();
    currentShareSocket = null;
    activeShareToken = null;
    window.history.replaceState({}, "", window.location.pathname);
    showScreen("screen-welcome");
  });
}

function showRiderHome(): void {
  stopAdminDashboardRefresh();
  stopRiderLocationTracking();
  showScreen("screen-rider-home");
  setTimeout(() => {
    initMap("map");
    initLocationSearch();
    resetRiderRideStatus();
    renderPaymentPanel(null);
    renderTripSharePanel(null);
    clearRealtimeMarkers();
    void refreshRideHistory();
    void refreshNotifications("rider");
  }, 100);
}

function showDriverHome(user: UserProfile): void {
  stopAdminDashboardRefresh();
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
  void refreshDriverEarnings();
  void refreshNotifications("driver");
}

function showAdminHome(user: UserProfile): void {
  stopAdminDashboardRefresh();
  currentRiderRideSocket?.close();
  currentDriverSocket?.close();
  currentShareSocket?.close();
  currentRiderRideSocket = null;
  currentDriverSocket = null;
  currentShareSocket = null;
  stopDriverLocationTracking();
  stopRiderLocationTracking();
  showScreen("screen-admin-home");
  setText("admin-user-name", user.name);
  setTimeout(() => {
    initAdminMap("admin-active-rides-map");
    void refreshAdminDashboard();
    adminDashboardRefreshTimer = window.setInterval(() => {
      void refreshAdminDashboard();
    }, 15000);
  }, 100);
}

function stopAdminDashboardRefresh(): void {
  if (adminDashboardRefreshTimer) {
    window.clearInterval(adminDashboardRefreshTimer);
    adminDashboardRefreshTimer = null;
  }
}

function logout(): void {
  stopAdminDashboardRefresh();
  if (currentUser?.role === "driver" && isDriverOnline) {
    void updateDriverAvailability(false).catch(() => {});
  }
  currentRiderRideSocket?.close();
  currentDriverSocket?.close();
  currentShareSocket?.close();
  stopDriverLocationTracking();
  stopRiderLocationTracking();
  currentRiderRideSocket = null;
  currentDriverSocket = null;
  currentShareSocket = null;
  activeDriverRide = null;
  activeRiderRide = null;
  activeRiderRideId = null;
  activeShareRideId = null;
  activeShareUrl = null;
  activeShareToken = null;
  activeRefundRideId = null;
  activeRiderRatingRideId = null;
  activeDriverRatingRideId = null;
  activeRiderIssueRideId = null;
  activeDriverIssueRideId = null;
  isDriverOnline = false;
  clearDirections("rider");
  clearDirections("driver");
  clearRoute();
  clearAdminMapLayers();
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

function bindAdminLogin(): void {
  const form = document.getElementById("form-admin-login") as HTMLFormElement;
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]") as HTMLButtonElement;
    const data = getFormData("form-admin-login");

    if (!validateEmail(data.email)) { showToast("Enter a valid email", "error"); return; }
    if (!data.password) { showToast("Password is required", "error"); return; }

    setLoading(btn, true);
    try {
      const res = await loginAdmin({ email: data.email, password: data.password });
      setToken(res.token);
      currentUser = res.user;
      showToast(`Welcome, ${res.user.name}!`, "success");
      showAdminHome(res.user);
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
  activeRiderRide = ride;
  activeRiderRideId = ride.id;
  currentRiderRideSocket = connectRideSocket(ride.id, (data) => {
    if (data.type === "ride_update") {
      activeRiderRide = data.ride;
      renderRideLocations(data.ride);
      renderRiderRideStatus(data.ride);
      renderPaymentPanel(data.ride);
      renderTripSharePanel(data.ride);
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
        activeRiderRide = null;
        clearRealtimeMarkers();
        clearDirections("rider");
        clearRoute();
        void refreshRideHistory();
      }
    }
    if (data.type === "notification") {
      handleRealtimeNotification(data.notification, "rider");
    }
  });
  startRiderLocationTracking(ride.id);
  void refreshRiderRoute(ride, true);
  renderTripSharePanel(ride);
}

function connectDriverUpdates(driverId: string): void {
  currentDriverSocket?.close();
  currentDriverSocket = connectDriverSocket(driverId, (data) => {
    if (data.type === "ride_request" || data.type === "ride_update") {
      renderDriverRequest(data.ride);
      void refreshDriverRoute(data.ride, data.type === "ride_request");
      if (data.ride?.status === "completed") {
        void refreshDriverEarnings();
      }
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
    if (data.type === "notification") {
      handleRealtimeNotification(data.notification, "driver");
    }
  });
}

async function showSharedTrip(token: string): Promise<void> {
  currentRiderRideSocket?.close();
  currentDriverSocket?.close();
  currentShareSocket?.close();
  currentRiderRideSocket = null;
  currentDriverSocket = null;
  currentShareSocket = null;
  activeShareToken = token;
  showScreen("screen-trip-share");
  await loadSharedTrip(token);

  currentShareSocket = connectShareSocket(token, (data) => {
    if (data.type === "share_update") {
      renderSharedTrip(data.ride);
    }
  }, { reconnect: true });
}

async function loadSharedTrip(token: string): Promise<void> {
  try {
    const share = await getSharedRide(token);
    renderSharedTrip(share.ride);
  } catch (err: any) {
    renderSharedTripError(err.message || "Shared trip not found");
  }
}

function renderSharedTrip(ride: SharedRide): void {
  setText("share-trip-status", rideStatusLabel(ride.status));
  setText("share-trip-title", sharedTripTitle(ride));
  setText("share-trip-body", sharedTripBody(ride));
  setText("share-trip-updated", `Updated ${formatDateTime(ride.updated_at)}`);
  setText("share-trip-pickup", formatPoint(ride.pickup));
  setText("share-trip-destination", formatPoint(ride.destination));
  setText("share-trip-driver", ride.driver?.name || "Driver pending");
  setText("share-trip-vehicle", sharedVehicleLabel(ride));
  setText("share-trip-distance", ride.distance_km ? formatDistanceKm(ride.distance_km) : "--");
  setText("share-trip-rider-location", ride.rider_location ? formatPoint(ride.rider_location) : "--");
  setText("share-trip-driver-location", ride.driver_location ? formatPoint(ride.driver_location) : "--");

  const route = document.getElementById("share-route-visual");
  if (route) {
    route.className = `share-route-visual share-route-${ride.status}`;
  }
}

function renderSharedTripError(message: string): void {
  setText("share-trip-status", "Unavailable");
  setText("share-trip-title", "Shared trip unavailable");
  setText("share-trip-body", message);
  setText("share-trip-updated", "");
  setText("share-trip-pickup", "--");
  setText("share-trip-destination", "--");
  setText("share-trip-driver", "--");
  setText("share-trip-vehicle", "--");
  setText("share-trip-distance", "--");
  setText("share-trip-rider-location", "--");
  setText("share-trip-driver-location", "--");
}

function sharedTripTitle(ride: SharedRide): string {
  if (ride.status === "pending_driver") return "Driver reviewing request";
  if (ride.status === "accepted") return "Driver is on the way";
  if (ride.status === "arrived") return "Driver is at pickup";
  if (ride.status === "in_progress") return "Trip is underway";
  if (ride.status === "completed") return "Trip complete";
  if (ride.status === "cancelled") return "Trip cancelled";
  if (ride.status === "no_drivers_available") return "No drivers available";
  return "Finding a driver";
}

function sharedTripBody(ride: SharedRide): string {
  if (ride.driver?.name && ["accepted", "arrived", "in_progress"].includes(ride.status)) {
    return `${ride.driver.name} is handling this trip.`;
  }
  if (ride.status === "completed") return "The rider has reached the destination.";
  if (ride.status === "cancelled") return "This shared trip is no longer active.";
  return "Live status will update as the ride progresses.";
}

function sharedVehicleLabel(ride: SharedRide): string {
  const vehicle = ride.driver?.vehicle;
  if (!vehicle) return "Vehicle pending";
  return `${vehicle.color} ${vehicle.make} ${vehicle.model} - ${vehicle.plate}`;
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
    activeRiderRide = null;
    card.classList.add("is-hidden");
    cancelBtn.classList.add("is-hidden");
    btn.disabled = false;
    btn.innerHTML = `<span>Confirm pickup</span><i data-lucide="navigation"></i>`;
    renderRiderFeedbackPanels(null);
    renderTripSharePanel(null);
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
    const driverRating = formatRatingSummary(ride.driver?.average_rating, ride.driver?.rating_count);
    title.textContent = "Ride accepted";
    body.textContent = ride.driver
      ? `${ride.driver.name}${driverRating ? ` (${driverRating})` : ""} is on the way${vehicle ? ` in a ${vehicle.color} ${vehicle.make} ${vehicle.model}` : ""}.`
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

  renderRiderFeedbackPanels(ride);
  refreshDynamicIcons();
}

function resetRiderRideStatus(): void {
  renderRiderRideStatus(null);
}

function renderPaymentPanel(ride: Ride | null): void {
  const panel = document.getElementById("payment-panel");
  const status = document.getElementById("payment-status");
  const amount = document.getElementById("payment-amount");
  const method = document.getElementById("payment-method");
  const reference = document.getElementById("payment-reference");
  const refundButton = document.getElementById("payment-refund-btn") as HTMLButtonElement | null;

  if (!panel || !status || !amount || !method || !reference) return;

  if (!ride?.payment) {
    panel.classList.add("is-hidden");
    refundButton?.classList.add("is-hidden");
    activeRefundRideId = null;
    renderPaymentFareBreakdown(null);
    return;
  }

  const payment = ride.payment;
  const canRefund = ride.status === "completed" && payment.status === "paid";
  panel.classList.remove("is-hidden");
  status.textContent = paymentStatusLabel(payment.status);
  status.className = `payment-status payment-status-${payment.status}`;
  amount.textContent = formatCurrency(payment.amount, payment.currency);
  method.textContent = payment.method || "Mock payment";
  reference.textContent = payment.receipt_number || payment.authorization_code || compactRideId(payment.id);
  activeRefundRideId = canRefund ? ride.id : null;
  if (refundButton) {
    refundButton.classList.toggle("is-hidden", !canRefund);
    refundButton.disabled = !canRefund;
  }
  renderPaymentFareBreakdown(ride.fare_breakdown || payment.fare_breakdown || null);
}

function renderPaymentFareBreakdown(breakdown: FareBreakdown | null): void {
  const panel = document.getElementById("payment-fare-breakdown");
  if (!panel) return;

  if (!breakdown) {
    panel.classList.add("is-hidden");
    setText("payment-fare-base", "--");
    setText("payment-fare-distance-charge", "--");
    setText("payment-fare-time-charge", "--");
    setText("payment-fare-surge-charge", "--");
    setText("payment-fare-minimum-adjustment", "--");
    return;
  }

  panel.classList.remove("is-hidden");
  setText("payment-fare-base", formatCurrency(breakdown.base_fare, breakdown.currency));
  setText("payment-fare-distance-charge", formatCurrency(breakdown.distance_charge, breakdown.currency));
  setText("payment-fare-time-charge", formatCurrency(breakdown.time_charge, breakdown.currency));
  setText(
    "payment-fare-surge-charge",
    breakdown.surge_multiplier > 1
      ? `${formatCurrency(breakdown.surge_charge, breakdown.currency)} (${breakdown.surge_multiplier.toFixed(2)}x)`
      : "None"
  );
  setText(
    "payment-fare-minimum-adjustment",
    breakdown.minimum_adjustment > 0
      ? formatCurrency(breakdown.minimum_adjustment, breakdown.currency)
      : "None"
  );
}

function renderTripSharePanel(ride: Ride | null, share?: TripShare): void {
  const panel = document.getElementById("trip-share-panel");
  const input = document.getElementById("trip-share-url") as HTMLInputElement | null;
  const status = document.getElementById("trip-share-status");
  const button = document.getElementById("btn-create-trip-share") as HTMLButtonElement | null;
  const openLink = document.getElementById("trip-share-open") as HTMLAnchorElement | null;
  if (!panel || !input || !status || !button || !openLink) return;

  if (!ride) {
    panel.classList.add("is-hidden");
    activeShareRideId = null;
    activeShareUrl = null;
    input.value = "";
    status.textContent = "Not shared";
    openLink.classList.add("is-hidden");
    return;
  }

  activeShareRideId = ride.id;
  panel.classList.remove("is-hidden");

  const token = share?.token || ride.share_token;
  if (share) {
    activeShareUrl = toAbsoluteShareUrl(share.url_path);
  } else if (!token) {
    activeShareUrl = null;
  }

  if (token && !activeShareUrl) {
    activeShareUrl = toAbsoluteShareUrl(`/?share=${encodeURIComponent(token)}`);
  }

  input.value = activeShareUrl || "";
  input.placeholder = "Create a live trip link";
  status.textContent = activeShareUrl ? "Live link ready" : "Not shared";
  button.querySelector("span")!.textContent = activeShareUrl ? "Copy link" : "Create link";
  openLink.href = activeShareUrl || "#";
  openLink.classList.toggle("is-hidden", !activeShareUrl);
}

function bindTripSharing(): void {
  const button = document.getElementById("btn-create-trip-share") as HTMLButtonElement | null;
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!activeShareRideId) return;

    setLoading(button, true);
    try {
      let url = activeShareUrl;
      let share: TripShare | null = null;
      if (!url) {
        share = await createRideShare(activeShareRideId);
        url = toAbsoluteShareUrl(share.url_path);
      }

      activeShareUrl = url;
      if (share && activeRiderRide) {
        activeRiderRide = { ...activeRiderRide, share_token: share.token };
      }
      const input = document.getElementById("trip-share-url") as HTMLInputElement | null;
      const status = document.getElementById("trip-share-status");
      const openLink = document.getElementById("trip-share-open") as HTMLAnchorElement | null;
      const label = button.querySelector("span");
      if (input) input.value = url;
      if (status) status.textContent = "Live link ready";
      if (label) label.textContent = "Copy link";
      if (openLink) {
        openLink.href = url;
        openLink.classList.remove("is-hidden");
      }

      await copyText(url);
      showToast("Trip link copied", "success");
    } catch (err: any) {
      showToast(err.message || "Could not share trip", "error");
    } finally {
      setLoading(button, false);
      const label = button.querySelector("span");
      if (label && activeShareUrl) label.textContent = "Copy link";
      refreshDynamicIcons();
    }
  });
}

function toAbsoluteShareUrl(urlPath: string): string {
  return new URL(urlPath, window.location.origin).toString();
}

function renderAdminDrivers(dashboard: AdminDashboard): void {
  const list = document.getElementById("admin-drivers-list");
  if (!list) return;
  list.innerHTML = "";

  if (dashboard.drivers.length === 0) {
    renderAdminListMessage(list, "No drivers yet");
    return;
  }

  for (const driver of dashboard.drivers.slice(0, 8)) {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    const copy = document.createElement("div");
    copy.className = "admin-list-copy";

    const title = document.createElement("strong");
    title.textContent = driver.name;

    const vehicle = driver.vehicle
      ? `${driver.vehicle.color} ${driver.vehicle.make} ${driver.vehicle.model}`
      : "No vehicle";
    const meta = document.createElement("span");
    meta.textContent = `${availabilityLabel(driver.availability)} - ${vehicle} - ${formatCurrency(driver.today_net, dashboard.currency)} today`;

    const status = document.createElement("em");
    status.textContent = `${driver.acceptance_rate}%`;

    copy.append(title, meta);
    item.append(copy, status);
    list.appendChild(item);
  }
}

function renderAdminIssues(dashboard: AdminDashboard): void {
  const list = document.getElementById("admin-issues-list");
  if (!list) return;
  list.innerHTML = "";

  if (dashboard.issues.length === 0) {
    renderAdminListMessage(list, "No open issues");
    return;
  }

  for (const issue of dashboard.issues.slice(0, 6)) {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    const copy = document.createElement("div");
    copy.className = "admin-list-copy";

    const title = document.createElement("strong");
    title.textContent = `${issue.category} report`;

    const meta = document.createElement("span");
    meta.textContent = `${issue.reporter_role} - ${issue.description}`;

    const status = document.createElement("em");
    status.textContent = formatDateTime(issue.created_at);

    copy.append(title, meta);
    item.append(copy, status);
    list.appendChild(item);
  }
}

function renderAdminDashboardError(message: string): void {
  clearAdminMapLayers();
  setText("admin-map-meta", "Map unavailable");
  setText("admin-analytics-meta", "Could not load");
  setText("admin-management-meta", "Could not load");
  ["admin-rides-list", "admin-drivers-list", "admin-issues-list", "admin-users-list", "admin-analytics-grid", "admin-status-mix"].forEach((id) => {
    const list = document.getElementById(id);
    if (list) {
      list.innerHTML = "";
      renderAdminListMessage(list, message);
    }
  });
}

function renderAdminListMessage(list: HTMLElement, message: string): void {
  const empty = document.createElement("div");
  empty.className = "history-empty";
  empty.textContent = message;
  list.appendChild(empty);
}

function renderDriverRequest(ride: Ride | null): void {
  const card = document.getElementById("driver-request-card");
  const status = document.getElementById("driver-location-status");
  const title = document.getElementById("driver-request-title");
  const body = document.getElementById("driver-request-body");
  const pickup = document.getElementById("driver-request-pickup");
  const destination = document.getElementById("driver-request-destination");
  const distance = document.getElementById("driver-request-distance");
  const fare = document.getElementById("driver-request-fare");
  const surge = document.getElementById("driver-request-surge");
  const riderLocation = document.getElementById("driver-request-rider-location");
  const actions = document.getElementById("driver-request-actions");
  const rejectBtn = document.getElementById("btn-reject-ride") as HTMLButtonElement;
  const acceptBtn = document.getElementById("btn-accept-ride") as HTMLButtonElement;
  const arrivedBtn = document.getElementById("btn-arrived-ride") as HTMLButtonElement;
  const startBtn = document.getElementById("btn-start-ride") as HTMLButtonElement;
  const completeBtn = document.getElementById("btn-complete-ride") as HTMLButtonElement;
  const cancelBtn = document.getElementById("btn-cancel-driver-ride") as HTMLButtonElement;

  if (!card || !status || !title || !body || !pickup || !destination || !distance || !fare || !surge || !riderLocation || !actions) return;

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
    fare.textContent = "--";
    surge.textContent = "--";
    riderLocation.textContent = "--";
    renderDriverFeedbackPanels(null);
    clearDirections("driver");
    showOnlyActions();
    return;
  }

  pickup.textContent = formatPoint(ride.pickup);
  destination.textContent = formatPoint(ride.destination);
  distance.textContent = ride.driver_distance_km === null ? "--" : formatDistanceKm(ride.driver_distance_km);
  fare.textContent = formatCurrency(ride.fare, ride.currency);
  surge.textContent = fareSurgeLabel(ride.fare_breakdown);
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

  renderDriverFeedbackPanels(ride);
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
        void refreshDriverEarnings();
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
        void refreshDriverEarnings();
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
      renderPaymentPanel(ride);
      stopRiderLocationTracking();
      currentRiderRideSocket?.close();
      currentRiderRideSocket = null;
      clearRealtimeMarkers();
      clearDirections("rider");
      clearRoute();
      void refreshRideHistory();
      showToast("Ride cancelled", "info");
    } catch (err: any) {
      showToast(err.message || "Could not cancel ride", "error");
    } finally {
      setLoading(button, false);
    }
  });
}

function bindRefundSimulation(): void {
  const button = document.getElementById("payment-refund-btn") as HTMLButtonElement;
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!activeRefundRideId) return;
    setLoading(button, true);
    try {
      const ride = await simulateRefund(activeRefundRideId);
      renderRiderRideStatus(ride);
      renderPaymentPanel(ride);
      void refreshRideHistory();
      showToast("Refund simulated", "success");
    } catch (err: any) {
      showToast(err.message || "Could not simulate refund", "error");
    } finally {
      setLoading(button, false);
      refreshDynamicIcons();
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
      void refreshDriverEarnings();
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
      if (ride.status === "completed") {
        void refreshDriverEarnings();
      }
      showToast(successMessage, "success");
    } catch (err: any) {
      showToast(err.message || "Could not update ride", "error");
    } finally {
      setLoading(button, false);
    }
  });
}

function bindDriverAvailabilityToggle(): void {
  const button = document.getElementById("btn-driver-availability") as HTMLButtonElement;
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!currentUser || currentUser.role !== "driver" || driverAvailabilityLoading) return;

    const nextOnline = !isDriverOnline;
    const previousAvailability = currentUser.availability;
    const previousOnline = isDriverOnline;
    driverAvailabilityLoading = true;
    renderDriverAvailability(nextOnline ? "available" : "offline");

    try {
      const user = await updateDriverAvailability(nextOnline);
      currentUser = user;
      isDriverOnline = user.availability !== "offline";
      renderDriverAvailability(user.availability);

      if (isDriverOnline) {
        startDriverLocationTracking();
        showToast("You are online", "success");
      } else {
        stopDriverLocationTracking();
        renderDriverRequest(null);
        clearDirections("driver");
        showToast("You are offline", "info");
      }
    } catch (err: any) {
      showToast(err.message || "Could not update availability", "error");
      isDriverOnline = previousOnline;
      if (currentUser?.role === "driver") currentUser = { ...currentUser, availability: previousAvailability };
      renderDriverAvailability(previousAvailability);
    } finally {
      driverAvailabilityLoading = false;
      renderDriverAvailability(currentUser?.availability);
    }
  });
}

function renderDriverAvailability(
  availability: UserProfile["availability"] = isDriverOnline ? "available" : "offline",
  labelOverride?: string
): void {
  const status = document.getElementById("driver-location-status");
  const heading = document.getElementById("driver-status-heading");
  const copy = document.getElementById("driver-status-copy");
  const button = document.getElementById("btn-driver-availability") as HTMLButtonElement;
  const buttonLabel = document.getElementById("driver-availability-label");

  const normalized = availability || (isDriverOnline ? "available" : "offline");
  isDriverOnline = normalized !== "offline";
  if (currentUser?.role === "driver") {
    currentUser = { ...currentUser, availability: normalized };
  }

  if (status) {
    status.textContent = labelOverride || availabilityLabel(normalized);
    status.classList.toggle("is-offline", normalized === "offline");
    status.classList.toggle("is-busy", normalized === "busy");
    status.classList.toggle("is-pending", normalized === "pending");
  }

  if (heading && copy) {
    if (normalized === "offline") {
      heading.textContent = "You're offline";
      copy.textContent = "Go online when you are ready to receive nearby rider requests.";
    } else if (normalized === "busy") {
      heading.textContent = "Driving now";
      copy.textContent = "Live trip updates and rerouting are active for this ride.";
    } else if (normalized === "pending") {
      heading.textContent = "Request pending";
      copy.textContent = "Review the incoming trip before accepting or going offline.";
    } else {
      heading.textContent = "Ready for requests";
      copy.textContent = "Your driver account is active and available for nearby riders.";
    }
  }

  if (button && buttonLabel) {
    const hasBlockingRide = Boolean(
      activeDriverRide &&
      activeDriverRide.status !== "pending_driver" &&
      !isTerminalRideStatus(activeDriverRide.status)
    );
    button.disabled = driverAvailabilityLoading || hasBlockingRide;
    button.classList.toggle("is-offline", !isDriverOnline);
    button.setAttribute("aria-pressed", String(isDriverOnline));
    buttonLabel.textContent = driverAvailabilityLoading
      ? "Updating"
      : hasBlockingRide
        ? "Finish trip"
        : isDriverOnline
          ? "Go offline"
          : "Go online";
  }
}

function availabilityLabel(availability: UserProfile["availability"]): string {
  if (availability === "offline") return "Offline";
  if (availability === "busy") return "Busy";
  if (availability === "pending") return "Pending";
  return "Online";
}

function driverAvailabilityForRide(ride: Ride | null): UserProfile["availability"] {
  if (!isDriverOnline) return "offline";
  if (!ride || isTerminalRideStatus(ride.status)) return "available";
  return ride.status === "pending_driver" ? "pending" : "busy";
}

function formatDistanceKm(distanceKm: number): string {
  const miles = distanceKm * 0.621371;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

function formatPoint(point: LatLng): string {
  return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
}

function formatCurrency(amount: number | null | undefined, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount ?? 0);
}

function formatRatingSummary(rating?: number | null, count?: number): string {
  if (!rating || !count) return "";
  return `${rating.toFixed(1)} rating`;
}

function fareSurgeLabel(breakdown?: FareBreakdown): string {
  if (!breakdown || breakdown.surge_multiplier <= 1) return "Normal";
  return `${breakdown.surge_multiplier.toFixed(2)}x`;
}

function formatPercent(rate: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(rate);
}

function formatAnalyticsPercent(value: number): string {
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}%`;
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function adminUserDetail(user: AdminUserSummary, currency: string): string {
  if (user.role === "driver") {
    const vehicle = user.vehicle
      ? `${user.vehicle.color} ${user.vehicle.make} ${user.vehicle.model}`
      : "No vehicle";
    const availability = availabilityLabel(user.availability);
    return `${availability} - ${vehicle} - ${formatCurrency(user.today_net, currency)} today - ${user.completed_rides ?? 0} completed`;
  }

  return `${user.total_rides ?? 0} rides - ${user.completed_rides ?? 0} completed`;
}

function adminStatusColor(status: string): string {
  if (status === "completed") return "#1f9d61";
  if (status === "cancelled" || status === "no_drivers_available") return "#d94848";
  if (status === "in_progress") return "#2f67f6";
  if (status === "accepted" || status === "arrived") return "#2457c5";
  return "#f1a51d";
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Pending";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function rideStatusLabel(status: RideStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function paymentStatusLabel(status?: string): string {
  if (status === "paid") return "Paid";
  if (status === "voided") return "Voided";
  if (status === "refunded") return "Refunded";
  if (status === "authorized") return "Authorized";
  return "Pending";
}

function compactRideId(id: string): string {
  return `#${id.slice(0, 8)}`;
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
      renderPaymentPanel(ride);
      renderTripSharePanel(ride);
      void refreshRideHistory();
      showToast("Ride requested", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to request ride", "error");
      setLoading(btn, false);
    }
  });
}
