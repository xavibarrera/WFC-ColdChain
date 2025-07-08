
import React from 'react';
import { Vehicle, DoorStatus } from '../types';

interface VehicleTableProps {
  vehicles: Vehicle[];
  onRowClick: (vehicle: Vehicle) => void;
  selectedVehicleId: string | null;
  onVehicleHover: (vehicleId: string | null) => void;
}

const getTempColor = (temp: number | null): string => {
    if (temp === null) return 'text-gray-500';
    if (temp <= 25.5) return 'text-blue-500'; // based on design example
    return 'text-yellow-500'; // based on design example
};

const DoorDisplay: React.FC<{ status: DoorStatus | null }> = ({ status }) => {
    if (status === null) return <div className="text-gray-500">N/A</div>;
    if (status === DoorStatus.OPEN) {
        return <div className="text-red-500">Open</div>;
    }
    return <div className="text-green-500">Closed</div>;
};


const VehicleTable: React.FC<VehicleTableProps> = ({ vehicles, onRowClick, selectedVehicleId, onVehicleHover }) => {
  return (
    <ul className="divide-y divide-gray-200">
      {vehicles.map((vehicle) => (
        <li
          id={`vehicle-row-${vehicle.uid}`}
          key={vehicle.uid}
          onClick={() => onRowClick(vehicle)}
          onMouseEnter={() => onVehicleHover(vehicle.uid)}
          onMouseLeave={() => onVehicleHover(null)}
          className={`p-4 flex items-center justify-between cursor-pointer transition-colors duration-300 ${
            selectedVehicleId === vehicle.uid ? 'bg-red-50' : 'hover:bg-red-50'
          }`}
        >
          <div>
            <p className="font-semibold text-lg text-gray-800">{vehicle.name}</p>
            <p className="text-sm text-gray-500">{vehicle.type}</p>
          </div>
          <div className="flex items-center space-x-8">
            <div className={`flex items-center ${getTempColor(vehicle.temperature)}`}>
              <span className="material-icons text-gray-400">thermostat</span>
              <span className="ml-2">
                {vehicle.temperature !== null ? `${vehicle.temperature.toFixed(1)}°C` : 'N/A'}
              </span>
            </div>
            <DoorDisplay status={vehicle.doorStatus} />
          </div>
        </li>
      ))}
    </ul>
  );
};

export default VehicleTable;
