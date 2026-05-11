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
  bindRiderSignup();
  bindDriverLogin();
  bindDriverSignup();
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
      showScreen("screen-driver-home");
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