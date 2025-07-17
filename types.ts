
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

export interface TemperatureReading {
  value: number;
  name: string;
}

export interface Vehicle {
  uid: string;
  name: string;
  type: 'Vehicle' | 'Asset';
  temperatures: { [sensorId: number]: TemperatureReading } | null;
  doorStatus: { [sensorId: number]: DoorStatus } | null;
  location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
}

export interface HistoricalDataPoint {
  timestamp: number;
  temperatures: { [sensorId: number]: TemperatureReading } | null;
  doorStatus: { [sensorId: number]: 0 | 1 } | null; // 0 for closed, 1 for open
  location: {
    lat: number;
    lng: number;
    address: string;
  } | null;
}