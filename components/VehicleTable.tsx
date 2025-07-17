
import React from 'react';
import { Vehicle, DoorStatus, TemperatureReading } from '../types';

interface VehicleTableProps {
  vehicles: Vehicle[];
  onRowClick: (vehicle: Vehicle) => void;
  selectedVehicleId: string | null;
  onVehicleHover: (vehicleId: string | null) => void;
}

const TempDisplay: React.FC<{ temps: { [id: number]: TemperatureReading } | null }> = ({ temps }) => {
    if (!temps || Object.keys(temps).length === 0) return <div className="text-gray-500">N/A</div>;
    const sortedSensorIds = Object.keys(temps).map(Number).sort((a, b) => a - b);
    
    return (
        <div className="flex items-center gap-2 flex-wrap justify-end">
            {sortedSensorIds.map(id => {
                const reading = temps[id];
                return (
                    <span key={id} className="text-xs font-medium bg-gray-200 text-gray-800 px-2 py-1 rounded-full whitespace-nowrap">
                        {reading.name}: {reading.value.toFixed(1)}°C
                    </span>
                );
            })}
        </div>
    );
};


const DoorDisplay: React.FC<{ statuses: { [id: number]: DoorStatus } | null }> = ({ statuses }) => {
    if (!statuses || Object.keys(statuses).length === 0) return <div className="text-gray-500">N/A</div>;
    const sortedSensorIds = Object.keys(statuses).map(Number).sort((a, b) => a - b);
    
    return (
        <div className="flex items-center gap-2 flex-wrap justify-start">
            {sortedSensorIds.map(id => (
                <span key={id} className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                    statuses[id] === DoorStatus.OPEN ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                    D{id}: {statuses[id] === DoorStatus.OPEN ? 'Open' : 'Closed'}
                </span>
            ))}
        </div>
    );
};

const VehicleTableHeader: React.FC = () => (
    <div className="p-4 flex items-center justify-between border-b-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0 z-10">
        <div className="flex-1">
            <span>Vehicle</span>
        </div>
        <div className="flex items-center space-x-6 text-right">
            <div className="w-48 text-center">Temperature</div>
            <div className="w-48 text-left">Door</div>
        </div>
    </div>
);


const VehicleTable: React.FC<VehicleTableProps> = ({ vehicles, onRowClick, selectedVehicleId, onVehicleHover }) => {
  return (
    <>
      <VehicleTableHeader />
      <ul className="divide-y divide-gray-200">
        {vehicles.map((vehicle) => {
          return (
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
              <div className="flex-1">
                <p className="font-semibold text-lg text-gray-800">{vehicle.name}</p>
                <p className="text-sm text-gray-500">{vehicle.type}</p>
              </div>
              <div className="flex items-center space-x-6 text-right">
                <div className="w-48 flex items-center justify-end">
                   <span className="material-icons text-gray-400 mr-2">thermostat</span>
                   <TempDisplay temps={vehicle.temperatures} />
                </div>
                <div className="w-48 text-left">
                  <DoorDisplay statuses={vehicle.doorStatus} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  );
};

export default VehicleTable;