const API_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000";

export async function requestRide() {
  const response = await fetch(`${API_URL}/rides`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rider_id: "rider_1",
      pickup: {
        lat: 40.7128,
        lng: -74.006,
      },
      destination: {
        lat: 40.758,
        lng: -73.9855,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to request ride");
  }

  return response.json();
}

export function connectRideSocket(
  rideId: string,
  onMessage: (data: any) => void
) {
  const socket = new WebSocket(`${WS_URL}/ws/rides/${rideId}`);

  socket.onopen = () => {
    console.log("WebSocket connected");
  };

  socket.onmessage = (event) => {
    onMessage(JSON.parse(event.data));
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket closed");
  };

  return socket;
}