import { requestRide, connectRideSocket } from "./api";

const requestRideBtn = document.getElementById("requestRideBtn") as HTMLButtonElement;
const rideIdEl = document.getElementById("rideId") as HTMLSpanElement;
const rideStatusEl = document.getElementById("rideStatus") as HTMLSpanElement;
const driverLatEl = document.getElementById("driverLat") as HTMLSpanElement;
const driverLngEl = document.getElementById("driverLng") as HTMLSpanElement;
const logsEl = document.getElementById("logs") as HTMLPreElement;

let driverInterval: number | null = null;

function log(message: string, data?: unknown) {
  logsEl.textContent += `${message}\n`;

  if (data) {
    logsEl.textContent += `${JSON.stringify(data, null, 2)}\n`;
  }

  logsEl.textContent += "\n";
  logsEl.scrollTop = logsEl.scrollHeight;
}

requestRideBtn.addEventListener("click", async () => {
  try {
    requestRideBtn.disabled = true;
    requestRideBtn.textContent = "Ride requested";

    const ride = await requestRide();

    rideIdEl.textContent = ride.id;
    rideStatusEl.textContent = ride.status;

    log("Ride requested:", ride);

    const socket = connectRideSocket(ride.id, (data) => {
      const updatedRide = data.ride;

      rideStatusEl.textContent = updatedRide.status;

      if (updatedRide.driver_location) {
        driverLatEl.textContent = String(updatedRide.driver_location.lat);
        driverLngEl.textContent = String(updatedRide.driver_location.lng);
      }

      log("Live ride update:", data);
    });

    if (driverInterval) {
      clearInterval(driverInterval);
    }

    driverInterval = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "driver_location",
            location: {
              lat: Number((40.72 + Math.random() * 0.01).toFixed(6)),
              lng: Number((-74.0 + Math.random() * 0.01).toFixed(6)),
            },
          })
        );
      }
    }, 2000);
  } catch (error) {
    requestRideBtn.disabled = false;
    requestRideBtn.textContent = "Request Ride";
    log("Error:", error);
  }
});