import { showScreen, showToast, setLoading, getFormData, validateEmail, validateRequired } from "./ui.js";
import { signupRider, loginRider, signupDriver, loginDriver, getMe, setToken, getToken, clearToken, requestRide } from "./api.js";
import { initMap } from "./map.js";
import { initLocationSearch, getSelectedPickup, getSelectedDest } from "./location.js";
import type { UserProfile } from "./types.js";

let currentUser: UserProfile | null = null;

document.addEventListener("DOMContentLoaded", async () => {
  bindAll();
  const token = getToken();
  if (token) {
    try {
      const user = await getMe();
      currentUser = user;
      if (user.role === "rider") {
        showScreen("screen-rider-home");
        setTimeout(() => { initMap("map"); initLocationSearch(); }, 100);
      } else {
        showScreen("screen-driver-home");
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
  bindClick("btn-logout-rider", () => { clearToken(); showScreen("screen-welcome"); showToast("Logged out", "info"); });
  bindClick("btn-logout-driver", () => { clearToken(); showScreen("screen-welcome"); showToast("Logged out", "info"); });
  bindRiderLogin();

  bindConfirmRide();
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
      showScreen("screen-rider-home");
      setTimeout(() => { initMap("map"); initLocationSearch(); }, 100);
    } catch (err: any) {
      showToast(err.message || "Login failed", "error");
    } finally {
      setLoading(btn, false);
    }
  });
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
      await requestRide(currentUser.id, { lat: pickup.lat, lng: pickup.lng }, { lat: dest.lat, lng: dest.lng });
      showToast("Ride requested! Searching for driver...", "success");
      btn.innerHTML = "Searching for driver...";
    } catch (err: any) {
      showToast(err.message || "Failed to request ride", "error");
      setLoading(btn, false);
    }
  });
}