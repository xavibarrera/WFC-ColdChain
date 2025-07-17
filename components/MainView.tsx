
import React, { useState, useEffect, useCallback } from 'react';
import { AuthCredentials, Vehicle } from '../types';
import WebfleetService from '../services/webfleetService';
import VehicleTable from './VehicleTable';
import VehicleMap from './VehicleMap';

interface MainViewProps {
  auth: AuthCredentials;
  onSelectVehicle: (vehicle: Vehicle) => void;
}

const Spinner: React.FC = () => (
  <div className="flex justify-center items-center h-full">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500"></div>
  </div>
);


const MainView: React.FC<MainViewProps> = ({ auth, onSelectVehicle }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await WebfleetService.getVehiclesAndAssets(auth);
      const vehiclesWithSensors = data.filter(v => 
        (v.temperatures && Object.keys(v.temperatures).length > 0) || v.doorStatus !== null
      );
      vehiclesWithSensors.sort((a, b) => a.name.localeCompare(b.name));
      setVehicles(vehiclesWithSensors);
      const firstVehicleWithLocation = vehiclesWithSensors.find(v => v.location);
      if (firstVehicleWithLocation?.location) {
        setMapCenter([firstVehicleWithLocation.location.lat, firstVehicleWithLocation.location.lng]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vehicle data.');
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleRowClick = (vehicle: Vehicle) => {
    onSelectVehicle(vehicle);
  };
  
  const handleMarkerClick = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
     const element = document.getElementById(`vehicle-row-${vehicleId}`);
     element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };


  if (isLoading) {
    return (
        <div className="p-8 h-full">
            <Spinner />
        </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
      <div className="w-full md:w-2/5 flex flex-col bg-white h-1/2 md:h-full">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">Vehicles</h2>
        </div>
        <div className="flex-grow overflow-y-auto">
          <VehicleTable 
            vehicles={vehicles} 
            onRowClick={handleRowClick}
            selectedVehicleId={selectedVehicleId}
            onVehicleHover={setSelectedVehicleId}
          />
        </div>
      </div>
      <div className="w-full md:w-3/5 h-1/2 md:h-full">
        <VehicleMap 
          vehicles={vehicles} 
          onMarkerClick={handleMarkerClick}
          selectedVehicleId={selectedVehicleId}
          center={mapCenter}
        />
      </div>
    </div>
  );
};

export default MainView;