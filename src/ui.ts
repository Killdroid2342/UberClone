
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

