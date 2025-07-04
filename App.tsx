
import React, { useState, useCallback } from 'react';
import { AuthCredentials, Vehicle } from './types';
import LoginPage from './components/LoginPage';
import MainView from './components/MainView';
import DetailView from './components/DetailView';
import { IconLogo, IconLogout } from './constants';
import WebfleetService from './services/webfleetService';

type View = 'login' | 'main' | 'detail';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthCredentials | null>(null);
  const [currentView, setCurrentView] = useState<View>('login');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const handleLogin = useCallback((credentials: AuthCredentials) => {
    setAuth(credentials);
    setCurrentView('main');
  }, []);

  const handleLogout = useCallback(async () => {
    if (auth) {
      await WebfleetService.logout(auth);
    }
    setAuth(null);
    setSelectedVehicle(null);
    setCurrentView('login');
  }, [auth]);

  const handleSelectVehicle = useCallback((vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setCurrentView('detail');
  }, []);

  const handleBackToMain = useCallback(() => {
    setSelectedVehicle(null);
    setCurrentView('main');
  }, []);

  const renderContent = () => {
    if (currentView === 'login' || !auth) {
      return <LoginPage onLogin={handleLogin} />;
    }

    switch (currentView) {
      case 'main':
        return <MainView auth={auth} onSelectVehicle={handleSelectVehicle} />;
      case 'detail':
        if (selectedVehicle) {
          return <DetailView auth={auth} vehicle={selectedVehicle} onBack={handleBackToMain} />;
        }
        // Fallback to main view if no vehicle is selected
        setCurrentView('main');
        return <MainView auth={auth} onSelectVehicle={handleSelectVehicle} />;
      default:
        return <LoginPage onLogin={handleLogin} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      {auth && (
        <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <IconLogo/>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Webfleet Cold Chain</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <IconLogout className="h-5 w-5" />
            Logout
          </button>
        </header>
      )}
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;