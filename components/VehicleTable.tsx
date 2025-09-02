import React, { useState, useMemo } from 'react';
import { Vehicle, DoorStatus, TemperatureReading, TemperatureAlert } from '../types';

interface VehicleTableProps {
  vehicles: Vehicle[];
  onRowClick: (vehicle: Vehicle) => void;
  selectedVehicleId: string | null;
  onVehicleHover: (vehicleId: string | null) => void;
}

const AlertTooltip: React.FC<{ alerts: TemperatureAlert[] }> = ({ alerts }) => {
    const latestAlert = useMemo(() => {
        if (!alerts || alerts.length === 0) return null;
        return [...alerts].sort((a, b) => new Date(b.eventtime).getTime() - new Date(a.eventtime).getTime())[0];
    }, [alerts]);

    if (!latestAlert) {
        return null;
    }

    return (
        <div className="absolute z-50 w-72 p-3 text-sm font-normal text-white bg-gray-800 rounded-lg shadow-lg top-1/2 -translate-y-1/2 left-full ml-2 pointer-events-none opacity-100 transition-opacity">
            <h3 className="font-semibold text-white border-b border-gray-600 pb-1 mb-1">Unresolved Temperature Alert</h3>
            <div className="mt-2 text-gray-300">
                <p>{latestAlert.msgtext}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(latestAlert.eventtime).toLocaleString()}</p>
            </div>
        </div>
    );
};


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
    <div className="p-4 flex items-center justify-between border-b-2 border-gray-200 bg-app-content text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0 z-10">
        <div className="flex-1 min-w-0">
            <span>Vehicle</span>
        </div>
        <div className="flex items-center space-x-6 text-right">
            <div className="w-56 text-center">Temperature</div>
            <div className="w-48 text-left">Door</div>
        </div>
    </div>
);


const VehicleTable: React.FC<VehicleTableProps> = ({ vehicles, onRowClick, selectedVehicleId, onVehicleHover }) => {
    const [hoveredAlertVehicleId, setHoveredAlertVehicleId] = useState<string | null>(null);

  return (
    <>
      <VehicleTableHeader />
      <div className="overflow-y-auto">
      <ul>
        {vehicles.map((vehicle, index) => {
          const hasAlerts = vehicle.alerts && vehicle.alerts.length > 0;
          return (
            <li
              id={`vehicle-row-${vehicle.uid}`}
              key={vehicle.uid}
              onClick={() => onRowClick(vehicle)}
              onMouseEnter={() => onVehicleHover(vehicle.uid)}
              onMouseLeave={() => onVehicleHover(null)}
              className={`p-4 flex items-center justify-between cursor-pointer transition-colors duration-300 row-hover ${index % 2 !== 0 ? 'row-odd-bg' : 'bg-white'}`}
              style={selectedVehicleId === vehicle.uid ? { backgroundColor: '#e9f4c1' } : undefined}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg text-gray-800 truncate">{vehicle.name}</p>
                <p className="text-sm text-gray-500">{vehicle.type}</p>
              </div>
              <div className="flex items-center space-x-6">
                <div 
                  className="w-56 flex items-center justify-end"
                >
                   <div 
                    className="relative flex-shrink-0 mr-2"
                    onMouseEnter={() => hasAlerts && setHoveredAlertVehicleId(vehicle.uid)}
                    onMouseLeave={() => setHoveredAlertVehicleId(null)}
                   >
                     <span className={`material-icons ${hasAlerts ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>thermostat</span>
                     {hoveredAlertVehicleId === vehicle.uid && hasAlerts && (
                       <AlertTooltip alerts={vehicle.alerts!} />
                     )}
                   </div>
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
      </div>
    </>
  );
};

export default VehicleTable;
