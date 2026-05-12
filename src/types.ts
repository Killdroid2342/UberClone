
export interface LatLng {
  lat: number;
  lng: number;
}

export interface LocationResult {
  name: string;
  lat: number;
  lng: number;
}

export interface RiderSignupData {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface DriverSignupData {
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
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UserProfile {
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
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}
