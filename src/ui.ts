
const allScreenIds = [
  "screen-welcome",
  "screen-rider-login",
  "screen-rider-signup",
  "screen-driver-login",
  "screen-driver-signup",
  "screen-rider-home",
  "screen-driver-home",
];

export function showScreen(screenId: string): void {
  for (const id of allScreenIds) {
    const el = document.getElementById(id);
    if (el) {
      if (id === screenId) {
        el.classList.add("active");
        el.classList.remove("hidden");
      } else {
        el.classList.remove("active");
        el.classList.add("hidden");
      }
    }
  }
}

let toastTimeout: number | null = null;

export function showToast(message: string, type: "success" | "error" | "info" = "info"): void {
  const existing = document.getElementById("toast-container");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast-container";
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
    <span class="toast-message">${message}</span>
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

