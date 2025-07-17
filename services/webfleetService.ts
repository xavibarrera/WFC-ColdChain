
import { AuthCredentials, Vehicle, DoorStatus, HistoricalDataPoint, TemperatureReading } from '../types';

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
            if (response.status === 401) {
                throw new Error('Authentication failed. Please check your username and password.');
            }
            const errMessage = response.headers.get('X-Webfleet-Errormessage') || responseText;
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

        const tempMap = new Map<string, { [id: number]: TemperatureReading }>();
        if (Array.isArray(tempData)) {
            const readingsByUid = new Map<string, any[]>();
            tempData.forEach(item => {
                if (item.objectuid && typeof item.temperature === 'number') {
                    if (!readingsByUid.has(item.objectuid)) {
                        readingsByUid.set(item.objectuid, []);
                    }
                    readingsByUid.get(item.objectuid)!.push(item);
                }
            });
    
            readingsByUid.forEach((readings, uid) => {
                const vehicleTemps: { [id: number]: TemperatureReading } = {};
                const usedSensorIds = new Set<number>();
                
                readings.forEach(item => {
                    if (item.sensor) {
                        vehicleTemps[item.sensor] = {
                            value: item.temperature,
                            name: item.sensorname || `Sensor ${item.sensor}`
                        };
                        usedSensorIds.add(item.sensor);
                    }
                });
    
                let nextSensorId = 1;
                readings.forEach(item => {
                    if (!item.sensor) {
                        while (usedSensorIds.has(nextSensorId)) {
                            nextSensorId++;
                        }
                        vehicleTemps[nextSensorId] = {
                            value: item.temperature,
                            name: item.sensorname || `Sensor ${nextSensorId}`
                        };
                        usedSensorIds.add(nextSensorId);
                    }
                });
                
                tempMap.set(uid, vehicleTemps);
            });
        }

        const doorMap = new Map<string, { [id: number]: DoorStatus }>();
        if (Array.isArray(doorData)) {
            const doorReadingsByUid = new Map<string, any[]>();
            doorData.forEach(item => {
                if (item.objectuid && item.status) {
                    if (!doorReadingsByUid.has(item.objectuid)) {
                        doorReadingsByUid.set(item.objectuid, []);
                    }
                    doorReadingsByUid.get(item.objectuid)!.push(item);
                }
            });
    
            doorReadingsByUid.forEach((readings, uid) => {
                const vehicleDoors: { [id: number]: DoorStatus } = {};
                const usedSensorIds = new Set<number>();
                
                readings.forEach(item => {
                    if (item.sensor) {
                        vehicleDoors[item.sensor] = item.status === 'OPEN' ? DoorStatus.OPEN : DoorStatus.CLOSED;
                        usedSensorIds.add(item.sensor);
                    }
                });
    
                let nextSensorId = 1;
                readings.forEach(item => {
                    if (!item.sensor) {
                        while (usedSensorIds.has(nextSensorId)) {
                            nextSensorId++;
                        }
                        vehicleDoors[nextSensorId] = item.status === 'OPEN' ? DoorStatus.OPEN : DoorStatus.CLOSED;
                        usedSensorIds.add(nextSensorId);
                    }
                });
                
                if (Object.keys(vehicleDoors).length > 0) {
                    doorMap.set(uid, vehicleDoors);
                }
            });
        }
        
        return vehicleData.map((item: any): Vehicle => {
            const hasLocation = typeof item.latitude_mdeg === 'number' && typeof item.longitude_mdeg === 'number';
            return {
                uid: item.objectuid,
                name: item.objectname,
                type: item.objectclass === 'asset' ? 'Asset' : 'Vehicle',
                temperatures: tempMap.get(item.objectuid) ?? null,
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

    private static assignStableIds(data: any[], valueKey: 'temperature' | 'status'): any[] {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }
    
        const readingsByTs = new Map<number, any[]>();
        const explicitIds = new Set<number>();
    
        // First pass: Group by timestamp and find all explicit IDs
        data.forEach(d => {
            const ts = d.timestamp ? new Date(d.timestamp).getTime() : null;
            if (ts && !isNaN(ts) && (d[valueKey] !== undefined)) {
                if (!readingsByTs.has(ts)) readingsByTs.set(ts, []);
                readingsByTs.get(ts)!.push(d);
                if (d.sensor) {
                    explicitIds.add(d.sensor);
                }
            }
        });
        
        // Find the maximum number of anonymous sensors at any single point in time
        let maxAnonCount = 0;
        readingsByTs.forEach(readings => {
            const anonCount = readings.filter(r => !r.sensor).length;
            if (anonCount > maxAnonCount) {
                maxAnonCount = anonCount;
            }
        });
    
        if (maxAnonCount === 0) {
            return data; // No changes needed
        }
    
        const maxExplicitId = explicitIds.size > 0 ? Math.max(...Array.from(explicitIds)) : 0;
        const anonIdPool = Array.from({ length: maxAnonCount }, (_, i) => maxExplicitId + 1 + i);
    
        const processedData: any[] = [];
        readingsByTs.forEach(readings => {
            const anonReadings = readings.filter(r => !r.sensor);
            const explicitReadings = readings.filter(r => r.sensor);
    
            // Assign stable IDs from the pool to the anonymous readings for this timestamp
            const updatedAnonReadings = anonReadings.map((reading, index) => ({
                ...reading,
                sensor: anonIdPool[index]
            }));
            
            processedData.push(...updatedAnonReadings, ...explicitReadings);
        });
    
        return processedData;
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
    
        const [rawTempData, rawDoorData, trackData] = await Promise.all([
            this.apiRequest('getHistoricalTemperatureData', params, auth).catch(() => []),
            this.apiRequest('getHistoricalRefrigeratedDoorStatusData', params, auth).catch(() => []),
            this.apiRequest('showTrack', params, auth).catch(() => [])
        ]);
    
        //console.log('[WebfleetService] Raw Historical Temperature Data from API:', JSON.stringify(rawTempData, null, 2));
        //console.log('[WebfleetService] Raw Historical Door Status Data from API:', JSON.stringify(rawDoorData, null, 2));
        //console.log('[WebfleetService] Raw Historical Track Data from API:', JSON.stringify(trackData, null, 2));
        
        // Normalize sensor identifier property from 'sensorcode' (hex string) to 'sensor' (number)
        const normalizeSensorData = (data: any[]) => {
            if (!Array.isArray(data)) return [];
            return data.map(d => {
                // The historical API returns 'sensorcode' (hex), but the app expects 'sensor' (number).
                if (d.sensorcode && typeof d.sensor === 'undefined') {
                    const numericId = parseInt(d.sensorcode, 16);
                    if (!isNaN(numericId)) {
                        return { ...d, sensor: numericId };
                    }
                }
                return d;
            });
        };

        const normalizedTempData = normalizeSensorData(rawTempData);
        const normalizedDoorData = normalizeSensorData(rawDoorData);

        const tempData = WebfleetService.assignStableIds(normalizedTempData, 'temperature');
        const doorData = WebfleetService.assignStableIds(normalizedDoorData, 'status');

        const dataByTs = new Map<number, {
            temperatures?: { [id: number]: TemperatureReading };
            doorStatus?: { [id: number]: 0 | 1 };
            location?: { lat: number; lng: number; address: string; };
        }>();
    
        const getOrCreatePoint = (ts: number) => {
            if (!dataByTs.has(ts)) {
                dataByTs.set(ts, {});
            }
            return dataByTs.get(ts)!;
        };
    
        // Process temperature data
        if (Array.isArray(tempData)) {
            tempData.forEach(d => {
                const ts = new Date(d.timestamp).getTime();
                if (d.sensor && typeof d.temperature === 'number') {
                    const point = getOrCreatePoint(ts);
                    if (!point.temperatures) point.temperatures = {};
                    point.temperatures[d.sensor] = {
                        value: d.temperature,
                        name: d.sensorname || `Sensor ${d.sensor}`
                    };
                }
            });
        }
    
        // Process door data
        if (Array.isArray(doorData)) {
            doorData.forEach(d => {
                const ts = new Date(d.timestamp).getTime();
                if (d.sensor && d.status) {
                    const point = getOrCreatePoint(ts);
                    if (!point.doorStatus) point.doorStatus = {};
                    point.doorStatus[d.sensor] = d.status === 'OPEN' ? 1 : 0;
                }
            });
        }
    
        if (Array.isArray(trackData)) {
            trackData.forEach((d: any) => {
                const ts = d.recordtime ? new Date(d.recordtime).getTime() : null;
                if (ts && !isNaN(ts) && typeof d.latitude_mdeg === 'number') {
                    const point = getOrCreatePoint(ts);
                    point.location = {
                        lat: d.latitude_mdeg / 1000000,
                        lng: d.longitude_mdeg / 1000000,
                        address: d.postext || 'Address not available',
                    };
                }
            });
        }
    
        const sortedTimestamps = Array.from(dataByTs.keys()).sort((a, b) => a - b);
    
        if (sortedTimestamps.length === 0) return [];

        const results: HistoricalDataPoint[] = [];
        let lastDoor: { [id: number]: 0 | 1 } | null = null;
        let carriedTemps: { [id: number]: TemperatureReading } | null = null;
        let lastLocation: { lat: number, lng: number, address: string } | null = null;
        
        for (const timestamp of sortedTimestamps) {
            const point = dataByTs.get(timestamp)!;
            
            const hasTemp = point.temperatures && Object.keys(point.temperatures).length > 0;
            const hasDoorData = point.doorStatus && Object.keys(point.doorStatus).length > 0;
            
            const combinedDoorStatus = { ...(lastDoor || {}), ...(point.doorStatus || {}) };
            const doorChanged = JSON.stringify(combinedDoorStatus) !== JSON.stringify(lastDoor);
            
            // An event is the first point, a temp reading, or a door status change.
            if (results.length === 0 || hasTemp || doorChanged) {
                
                // Add a synthetic point before a time gap to ensure graph continuity.
                if (results.length > 0) {
                    const prevTimestamp = results[results.length - 1].timestamp;
                    if (timestamp > prevTimestamp + 1) {
                        results.push({
                            timestamp: timestamp - 1,
                            temperatures: carriedTemps,
                            doorStatus: lastDoor,
                            location: lastLocation,
                        });
                    }
                }
                
                const currentTemps = hasTemp ? { ...(carriedTemps || {}), ...point.temperatures } : carriedTemps;
                const currentDoor = (hasDoorData || lastDoor) ? combinedDoorStatus : null;
                const currentLocation = point.location || lastLocation;

                results.push({
                    timestamp,
                    temperatures: currentTemps,
                    doorStatus: currentDoor,
                    location: currentLocation,
                });
                
                // Update last known states for the next iteration.
                lastDoor = currentDoor;
                carriedTemps = currentTemps;
                lastLocation = currentLocation;

            } else if (point.location) {
                // If not a primary event, just update location.
                // This attaches the most recent location to the next primary event.
                lastLocation = point.location;
            }
        }
    
        console.log(`[WebfleetService] Found ${results.length} filtered historical data points for object ${objectuid}.`);
        return results;
    }
}

export default WebfleetService;
