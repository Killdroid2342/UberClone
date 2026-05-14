import { API_URL } from "./config.js";
import { connectRealtimeSocket, type RealtimeSocket, type RealtimeSocketOptions } from "./socket.js";
import type {
  RiderSignupData,
  DriverSignupData,
  LoginData,
  LoginResponse,
  UserProfile,
  LocationResult,
  LatLng,
  RouteEstimate,
  Ride,
  RideSocketMessage,
  DriverSocketMessage,
} from "./types.js";

export function getToken(): string | null {
  return localStorage.getItem("myuber_token");
}

export function setToken(token: string): void {
  localStorage.setItem("myuber_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("myuber_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function signupRider(data: RiderSignupData): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/riders/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Signup failed");
  }

  return res.json();
}

export async function loginRider(data: LoginData): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/riders/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login failed");
  }

  return res.json();
}

export async function signupDriver(data: DriverSignupData): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/drivers/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Signup failed");
  }

  return res.json();
}

export async function loginDriver(data: LoginData): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/drivers/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login failed");
  }

  return res.json();
}

export async function getMe(): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Not authenticated");
  }

  return res.json();
}

export async function searchLocations(query: string): Promise<LocationResult[]> {
  const res = await fetch(
    `${API_URL}/search/locations?q=${encodeURIComponent(query)}`,
    { headers: authHeaders() }
  );

  if (!res.ok) return [];
  return res.json();
}

export async function getRouteEstimate(
  pickup: LatLng,
  destination: LatLng
): Promise<RouteEstimate> {
  const res = await fetch(`${API_URL}/routes/estimate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ pickup, destination }),
  });

  if (!res.ok) throw new Error("Failed to estimate route");
  return res.json();
}

export async function requestRide(
  riderId: string,
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<Ride> {
  const res = await fetch(`${API_URL}/rides`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ rider_id: riderId, pickup, destination }),
  });

  if (!res.ok) throw new Error("Failed to request ride");
  return res.json();
}

export async function updateDriverLocation(location: LatLng): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/drivers/location`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ location }),
  });

  if (!res.ok) throw new Error("Failed to update driver location");
  return res.json();
}

export async function updateRiderLocation(
  rideId: string,
  location: LatLng
): Promise<Ride> {
  const res = await fetch(`${API_URL}/rides/${rideId}/rider-location`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ location }),
  });

  if (!res.ok) throw new Error("Failed to update rider location");
  return res.json();
}



export function connectRideSocket(
  rideId: string,
  onMessage: (data: RideSocketMessage) => void,
  options: Partial<Omit<RealtimeSocketOptions, "onMessage">> = {}
): RealtimeSocket {
  return connectRealtimeSocket(`/ws/rides/${rideId}`, {
    ...options,
    onMessage: (data) => onMessage(data as RideSocketMessage),
  });
}

export function connectDriverSocket(
  driverId: string,
  onMessage: (data: DriverSocketMessage) => void,
  options: Partial<Omit<RealtimeSocketOptions, "onMessage">> = {}
): RealtimeSocket {
  return connectRealtimeSocket(`/ws/drivers/${driverId}`, {
    ...options,
    onMessage: (data) => onMessage(data as DriverSocketMessage),
  });
}
