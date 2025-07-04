
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
      setVehicles(data);
      const firstVehicleWithLocation = data.find(v => v.location);
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
        <div className="p-8 h-[calc(100vh-80px)]">
            <Spinner />
        </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] p-4 gap-4">
      <div className="lg:w-1/2 w-full h-1/2 lg:h-full overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <VehicleTable 
          vehicles={vehicles} 
          onRowClick={handleRowClick}
          selectedVehicleId={selectedVehicleId}
          onVehicleHover={setSelectedVehicleId}
        />
      </div>
      <div className="lg:w-1/2 w-full h-1/2 lg:h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
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
