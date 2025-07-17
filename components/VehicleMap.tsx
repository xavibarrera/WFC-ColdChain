
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Vehicle, DoorStatus, TemperatureReading } from '../types';
import L from 'leaflet';

interface VehicleMapProps {
  vehicles: Vehicle[];
  onMarkerClick: (vehicleId: string) => void;
  selectedVehicleId: string | null;
  center: [number, number] | null;
}

const MapUpdater: React.FC<{ center: [number, number] | null }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.setView(center, map.getZoom() || 12);
        }
    }, [center, map]);
    return null;
}

const formatTemperaturesForPopup = (temps: { [id: number]: TemperatureReading } | null): string => {
    if (!temps || Object.keys(temps).length === 0) return 'N/A';
    const sortedSensorIds = Object.keys(temps).map(Number).sort((a, b) => a - b);
    return sortedSensorIds.map(id => `${temps[id].name}: ${temps[id].value.toFixed(1)}°C`).join('<br />');
};

const formatDoorStatusesForPopup = (statuses: { [id: number]: DoorStatus } | null): string => {
    if (!statuses || Object.keys(statuses).length === 0) return 'N/A';
    const sortedSensorIds = Object.keys(statuses).map(Number).sort((a, b) => a - b);
    return sortedSensorIds.map(id => `Door ${id}: ${statuses[id]}`).join('<br />');
};

const VehicleMap: React.FC<VehicleMapProps> = ({ vehicles, onMarkerClick, selectedVehicleId, center }) => {
    const defaultPosition: [number, number] = center || [52.3676, 4.9041]; // Amsterdam Centraal

    const createIcon = (color: string) => {
        return new L.DivIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="${color}" stroke="white" stroke-width="1"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>`,
            className: 'bg-transparent border-0',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
    };

    const defaultIcon = createIcon("#9CA3AF"); // gray-400
    const selectedIcon = createIcon("#EF4444"); // red-500


  return (
    <MapContainer center={defaultPosition} zoom={12} scrollWheelZoom={true} className="h-full w-full">
      <MapUpdater center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {vehicles.filter(v => v.location).map((vehicle) => {
        const tempString = formatTemperaturesForPopup(vehicle.temperatures);
        const doorString = formatDoorStatusesForPopup(vehicle.doorStatus);
        return (
            <Marker 
                key={vehicle.uid} 
                position={[vehicle.location!.lat, vehicle.location!.lng]}
                icon={selectedVehicleId === vehicle.uid ? selectedIcon : defaultIcon}
                eventHandlers={{
                    click: () => onMarkerClick(vehicle.uid),
                }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-base">{vehicle.name}</p>
                  <p className="text-gray-600">{vehicle.location!.address}</p>
                  <hr className="my-2"/>
                  <p><b>Temperatures:</b><br />{tempString}</p>
                  <p className="mt-1"><b>Door Status:</b><br />{doorString}</p>
                </div>
              </Popup>
            </Marker>
        )
      })}
    </MapContainer>
  );
};

export default VehicleMap;