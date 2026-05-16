
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
  role: "rider" | "driver" | "admin";
  account_status?: "active" | "suspended" | string;
  average_rating?: number | null;
  rating_count?: number;
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

export type FareBreakdown = {
  currency: string;
  base_fare: number;
  distance_charge: number;
  time_charge: number;
  subtotal: number;
  minimum_adjustment: number;
  surge_multiplier: number;
  surge_charge: number;
  surge_reason: string;
  demand_level: "normal" | "elevated" | "busy" | "peak" | string;
  active_demand: number;
  available_drivers: number;
  total: number;
  distance_miles: number;
  duration_min: number;
  distance_rate_per_mile: number;
  time_rate_per_minute: number;
  minimum_fare: number;
};

export type RouteEstimate = {
  distance_km: number;
  duration_min: number;
  currency: string;
  fare: number;
  fare_breakdown: FareBreakdown;
  route: LatLng[];
  steps: RouteStep[];
  source: string;
};

export type RouteStep = {
  instruction: string;
  distance_km: number;
  duration_min: number;
  location: LatLng | null;
};

export type RideStatus =
  | "matching"
  | "pending_driver"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_drivers_available";

export type RideStatusHistoryItem = {
  from: RideStatus | null;
  status: RideStatus;
  actor: "system" | "rider" | "driver" | string;
  at: string;
};

export type DriverSummary = {
  id: string;
  name: string;
  phone: string;
  vehicle?: UserProfile["vehicle"];
  location?: LatLng | null;
  average_rating?: number | null;
  rating_count?: number;
};

export type RideRating = {
  id: string;
  ride_id: string;
  score: number;
  comment: string;
  from_user_id: string;
  from_role: "rider" | "driver" | string;
  to_user_id: string;
  to_role: "rider" | "driver" | string;
  created_at: string;
  updated_at: string;
};

export type RideIssueReport = {
  id: string;
  ride_id: string;
  category: string;
  description: string;
  status: "open" | "closed" | string;
  reporter_user_id: string;
  reporter_role: "rider" | "driver" | string;
  created_at: string;
  updated_at: string;
};

export type MockPayment = {
  id: string;
  ride_id: string;
  amount: number;
  currency: string;
  method: string;
  status: "authorized" | "paid" | "voided" | "refunded" | string;
  authorization_code?: string;
  authorized_at?: string;
  captured_at?: string | null;
  voided_at?: string | null;
  refunded_at?: string | null;
  void_reason?: string;
  receipt_number?: string | null;
  fare_breakdown?: FareBreakdown | null;
  refund?: {
    id: string;
    ride_id: string;
    payment_id: string;
    amount: number;
    currency: string;
    status: string;
    reason: string;
    created_at: string;
  };
};

export type Ride = {
  id: string;
  rider_id: string;
  pickup: LatLng;
  destination: LatLng;
  distance_km?: number;
  duration_min?: number;
  currency?: string;
  fare?: number;
  fare_breakdown?: FareBreakdown;
  payment?: MockPayment;
  status: RideStatus;
  driver_id: string | null;
  driver?: DriverSummary | null;
  driver_distance_km: number | null;
  driver_location: LatLng | null;
  rider_location: LatLng | null;
  created_at: string;
  updated_at: string;
  status_history?: RideStatusHistoryItem[];
  matched_at?: string;
  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  no_drivers_available_at?: string;
  ratings?: Record<string, RideRating>;
  issue_reports?: RideIssueReport[];
  share_token?: string;
};

export type NotificationItem = {
  id: string;
  user_id: string;
  role: "rider" | "driver" | "admin" | string;
  kind: string;
  title: string;
  body: string;
  ride_id?: string | null;
  read_at?: string | null;
  created_at: string;
};

export type NotificationInbox = {
  unread_count: number;
  notifications: NotificationItem[];
};

export type SharedRide = {
  id: string;
  status: RideStatus;
  pickup: LatLng;
  destination: LatLng;
  distance_km?: number;
  duration_min?: number;
  driver_location?: LatLng | null;
  rider_location?: LatLng | null;
  driver?: Omit<DriverSummary, "id" | "phone"> | null;
  created_at: string;
  updated_at: string;
  matched_at?: string | null;
  accepted_at?: string | null;
  arrived_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
};

export type TripShare = {
  token: string;
  url_path: string;
  created_at: string;
  ride: SharedRide;
};


export type RideSocketMessage =
  | { type: "ride_update"; ride: Ride }
  | { type: "driver_location_update"; location: LatLng; ride?: Ride }
  | { type: "rider_location_update"; location: LatLng; ride?: Ride }
  | { type: "notification"; notification: NotificationItem; unread_count: number }
  | { type: "pong"; sent_at?: string };

export type DriverSocketMessage =
  | { type: "ride_request"; ride: Ride }
  | { type: "ride_update"; ride: Ride }
  | { type: "ride_cleared"; ride_id: string }
  | { type: "availability_update"; availability: UserProfile["availability"]; online: boolean }
  | { type: "driver_location_update"; location: LatLng; ride?: Ride }
  | { type: "notification"; notification: NotificationItem; unread_count: number }
  | { type: "pong"; sent_at?: string };

export type ShareSocketMessage =
  | { type: "share_update"; ride: SharedRide }
  | { type: "pong"; sent_at?: string };
