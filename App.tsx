import React, { useState, useCallback } from 'react';
import { AuthCredentials, Vehicle } from './types';
import LoginPage from './components/LoginPage';
import MainView from './components/MainView';
import DetailView from './components/DetailView';
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
    <div className="flex flex-col h-screen bg-gray-100">
      {auth && (
        <header className="bg-white text-gray-800 shadow-md">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-3 items-center h-20">
              <div className="flex items-center">
                <img src="https://media.webfleet.com/f_auto,q_auto/branding/wf/wf.svg" alt="Webfleet Logo" className="h-8 mr-4" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold">COLD CHAIN</h1>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleLogout}
                  className="flex items-center text-gray-800 hover:text-red-500 transition-colors duration-300"
                >
                  <span className="material-icons mr-2">logout</span>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
      )}
      <main className={`flex-grow flex flex-col min-h-0 ${currentView === 'detail' ? 'bg-vehicles-header' : ''}`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;