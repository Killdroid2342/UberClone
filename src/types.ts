
export type LatLng = {
  lat: number;
  lng: number;
};

export type LocationResult = {
  name: string;
  lat: number;
  lng: number;
};

export type RiderSignupData = {
  email: string;
  password: string;
  name: string;
  phone: string;
};

export type DriverSignupData = {
  email: string;
  password: string;
  name: string;
  phone: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: string;
  vehicle_plate: string;
  license_number: string;
};

export type LoginData = {
  email: string;
  password: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: "rider" | "driver";
  vehicle?: {
    make: string;
    model: string;
    year: number;
    color: string;
    plate: string;
  };
  license_number?: string;
  onboarding_status?: string;
  availability?: "offline" | "available" | "pending" | "busy";
  location?: LatLng | null;
  current_ride_id?: string | null;
  stats?: {
    accepted: number;
    rejected: number;
  };
};

export type LoginResponse = {
  token: string;
  user: UserProfile;
};

export type RouteEstimate = {
  distance_km: number;
  duration_min: number;
  fare: number;
  route: LatLng[];
  source: string;
};

export type RideStatus =
  | "matching"
  | "pending_driver"
  | "accepted"
  | "no_drivers_available";

