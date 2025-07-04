import { AuthCredentials, Vehicle, DoorStatus, HistoricalDataPoint } from '../types';

const API_BASE_URL = 'https://csv.webfleet.com/extern';

class WebfleetService {
    private static async apiRequest(action: string, params: Record<string, any>, auth: AuthCredentials): Promise<any> {
        const { accountName, username, password, apiKey } = auth;

        if (!username || !password) {
            throw new Error("Username and password are required for authentication.");
        }

        const url = new URL(API_BASE_URL);

        const queryParams: Record<string, any> = {
            ...params,
            action,
            account: accountName,
            apikey: apiKey,
            outputformat: 'json',
            lang: 'en',
            useISO8601: 'true',
        };
        
        for (const key in queryParams) {
            if (queryParams[key] !== undefined && queryParams[key] !== null) {
                url.searchParams.append(key, queryParams[key].toString());
            }
        }

        const basicAuth = btoa(`${username}:${password}`);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
            },
        });
        
        const responseText = await response.text();

        if (!response.ok) {
             const errMessage = response.headers.get('X-Webfleet-Errormessage') || responseText;
             if (response.status === 401) {
                 throw new Error('Authentication failed. Please check your username and password.');
            }
            throw new Error(`API Error: ${errMessage} (Status: ${response.status})`);
        }

        if (!responseText || responseText.includes('document is empty') || responseText.trim() === '[]') {
            return [];
        }

        try {
            return JSON.parse(responseText);
        } catch (e) {
            if (typeof responseText === 'string' && responseText.match(/^\d+,/)) {
                throw new Error(`API Error: ${responseText}`);
            }
            console.error("Failed to parse JSON from API response:", responseText);
            throw new Error("Received an invalid or malformed response from the server.");
        }
    }

    public static async login(credentials: AuthCredentials): Promise<AuthCredentials> {
        await this.apiRequest('showUserReportExtern', {}, credentials);
        return credentials;
    }
    
    public static async logout(auth: AuthCredentials): Promise<void> {
        return Promise.resolve();
    }

    public static async getVehiclesAndAssets(auth: AuthCredentials): Promise<Vehicle[]> {
        if (!auth.apiKey) throw new Error("API Key is required to fetch vehicle data.");

        const [vehicleData, tempData, doorData] = await Promise.all([
            this.apiRequest('showObjectReportExtern', { objectclass: 'asset,vehicle' }, auth),
            this.apiRequest('getCurrentTemperatureData', {}, auth).catch(() => []),
            this.apiRequest('getCurrentRefrigeratedDoorStatusData', {}, auth).catch(() => []),
        ]);

        if (!vehicleData || !Array.isArray(vehicleData)) {
            return [];
        }

        const tempMap = new Map<string, number>();
        if (Array.isArray(tempData)) {
            tempData.forEach(item => item.objectuid && tempMap.set(item.objectuid, item.temperature));
        }

        const doorMap = new Map<string, DoorStatus>();
        if (Array.isArray(doorData)) {
            doorData.forEach(item => item.objectuid && doorMap.set(item.objectuid, item.status === 'OPEN' ? DoorStatus.OPEN : DoorStatus.CLOSED));
        }
        
        return vehicleData.map((item: any): Vehicle => {
            const hasLocation = typeof item.latitude_mdeg === 'number' && typeof item.longitude_mdeg === 'number';
            return {
                uid: item.objectuid,
                name: item.objectname,
                type: item.objectclass === 'asset' ? 'Asset' : 'Vehicle',
                temperature: tempMap.get(item.objectuid) ?? null,
                doorStatus: doorMap.get(item.objectuid) ?? null,
                location: hasLocation
                    ? {
                        lat: item.latitude_mdeg / 1000000,
                        lng: item.longitude_mdeg / 1000000,
                        address: item.postext || 'Address not available',
                    }
                    : null,
            };
        });
    }

    public static async getHistoricalData(
        auth: AuthCredentials,
        objectuid: string,
        rangePattern: string
    ): Promise<HistoricalDataPoint[]> {
        if (!auth.apiKey) throw new Error("API Key is required to fetch historical data.");

        const params = {
            objectuid,
            range_pattern: rangePattern,
        };

        const [tempData, doorData] = await Promise.all([
            this.apiRequest('getHistoricalTemperatureData', params, auth).catch(() => []),
            this.apiRequest('getHistoricalRefrigeratedDoorStatusData', params, auth).catch(() => [])
        ]);

        const events: ({ timestamp: number } & ({ temperature: number } | { doorStatus: DoorStatus }))[] = [];

        if (Array.isArray(tempData)) {
            tempData.forEach((d: any) => {
                const ts = d.timestamp ? new Date(d.timestamp).getTime() : null;
                if (ts && !isNaN(ts)) {
                    events.push({ timestamp: ts, temperature: d.temperature });
                }
            });
        }
        if (Array.isArray(doorData)) {
            doorData.forEach((d: any) => {
                const ts = d.timestamp ? new Date(d.timestamp).getTime() : null;
                if (ts && !isNaN(ts)) {
                    events.push({ timestamp: ts, doorStatus: d.status === 'OPEN' ? DoorStatus.OPEN : DoorStatus.CLOSED });
                }
            });
        }
        
        if (events.length === 0) return [];

        events.sort((a, b) => a.timestamp - b.timestamp);

        const results: HistoricalDataPoint[] = [];
        let lastTemp: number | null = null;
        let lastDoor: DoorStatus | null = null;

        for (const event of events) {
            if (results.length > 0) {
                const prevTimestamp = results[results.length - 1].timestamp;
                if (event.timestamp > prevTimestamp + 1) { 
                    results.push({
                        timestamp: event.timestamp - 1,
                        temperature: lastTemp,
                        doorStatus: lastDoor === DoorStatus.OPEN ? 1 : 0,
                    });
                }
            }

            if ('temperature' in event) {
                lastTemp = event.temperature;
            }
            if ('doorStatus' in event) {
                lastDoor = event.doorStatus;
            }

            if (results.length > 0 && results[results.length - 1].timestamp === event.timestamp) {
                results[results.length - 1] = {
                    timestamp: event.timestamp,
                    temperature: lastTemp,
                    doorStatus: lastDoor === DoorStatus.OPEN ? 1 : 0,
                };
            } else {
                results.push({
                    timestamp: event.timestamp,
                    temperature: lastTemp,
                    doorStatus: lastDoor === DoorStatus.OPEN ? 1 : 0,
                });
            }
        }
        
        return results;
    }
}

export default WebfleetService;