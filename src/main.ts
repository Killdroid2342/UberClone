import { showScreen, showToast, setLoading, getFormData, validateEmail, validateRequired } from "./ui.js";
import { signupRider, loginRider, signupDriver, loginDriver, getMe, setToken, getToken, clearToken, requestRide } from "./api.js";
import { initMap } from "./map.js";
import { initLocationSearch, getSelectedPickup, getSelectedDest } from "./location.js";
import type { UserProfile } from "./types.js";

let currentUser: UserProfile | null = null;

document.addEventListener("DOMContentLoaded", async () => {

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

