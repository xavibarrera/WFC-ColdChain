
import React from 'react';
import { Vehicle, DoorStatus } from '../types';
import { IconThermometer, IconDoorOpen, IconDoorClosed } from '../constants';

interface VehicleTableProps {
  vehicles: Vehicle[];
  onRowClick: (vehicle: Vehicle) => void;
  selectedVehicleId: string | null;
  onVehicleHover: (vehicleId: string | null) => void;
}

const TempDisplay: React.FC<{ temp: number | null }> = ({ temp }) => {
    if (temp === null) return <span className="text-gray-400">N/A</span>;
    const color = temp <= 0 ? 'text-blue-400' : 'text-yellow-400';
    return <span className={color}>{temp.toFixed(1)}°C</span>;
};

const DoorDisplay: React.FC<{ status: DoorStatus | null }> = ({ status }) => {
    if (status === null) return <span className="text-gray-400">N/A</span>;
    if (status === DoorStatus.OPEN) {
        return <span className="text-red-500 flex items-center gap-1"><IconDoorOpen className="h-5 w-5" /> Open</span>;
    }
    return <span className="text-green-500 flex items-center gap-1"><IconDoorClosed className="h-5 w-5" /> Closed</span>;
};


const VehicleTable: React.FC<VehicleTableProps> = ({ vehicles, onRowClick, selectedVehicleId, onVehicleHover }) => {
  return (
    <div className="h-full overflow-y-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Vehicle/Asset
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Temperature
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Door Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {vehicles.map((vehicle) => (
            <tr 
              id={`vehicle-row-${vehicle.uid}`}
              key={vehicle.uid} 
              onClick={() => onRowClick(vehicle)} 
              onMouseEnter={() => onVehicleHover(vehicle.uid)}
              onMouseLeave={() => onVehicleHover(null)}
              className={`cursor-pointer transition-colors duration-200 ${selectedVehicleId === vehicle.uid ? 'bg-red-100 dark:bg-red-900/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{vehicle.name}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{vehicle.type}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                    <IconThermometer className="h-5 w-5 text-gray-400"/>
                    <TempDisplay temp={vehicle.temperature} />
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <DoorDisplay status={vehicle.doorStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VehicleTable;
