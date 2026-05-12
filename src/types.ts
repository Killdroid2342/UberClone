
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

