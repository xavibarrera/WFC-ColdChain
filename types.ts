
export interface AuthCredentials {
  apiKey: string;
  accountName: string;
  username: string;
  password: string;
}

export enum DoorStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface Vehicle {
  uid: string;
  name: string;
  type: 'Vehicle' | 'Asset';
  temperature: number | null;
  doorStatus: DoorStatus | null;
  location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
}

export interface HistoricalDataPoint {
  timestamp: number;
  temperature: number | null;
  doorStatus: 0 | 1; // 0 for closed, 1 for open
  location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
}
