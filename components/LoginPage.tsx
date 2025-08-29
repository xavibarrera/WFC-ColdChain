import React, { useState, useCallback, useEffect } from 'react';
import { AuthCredentials } from '../types';
import WebfleetService from '../services/webfleetService';

interface LoginPageProps {
  onLogin: (credentials: AuthCredentials) => void;
}

const Spinner: React.FC = () => (
  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [apiKey, setApiKey] = useState('');
  const [accountName, setAccountName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedCredentials');
    if (remembered) {
      try {
        const { apiKey, accountName, username } = JSON.parse(remembered);
        setApiKey(apiKey || '');
        setAccountName(accountName || '');
        setUsername(username || '');
        setRememberMe(true);
      } catch (e) {
        console.error("Failed to parse remembered credentials", e);
        localStorage.removeItem('rememberedCredentials');
      }
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !accountName || !username || !password) {
      setError('All fields are required.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const credentials: AuthCredentials = { apiKey, accountName, username, password };
    
    try {
      const authenticatedCredentials = await WebfleetService.login(credentials);
      if (rememberMe) {
        // Do not store the password
        localStorage.setItem('rememberedCredentials', JSON.stringify({ apiKey, accountName, username }));
      } else {
        localStorage.removeItem('rememberedCredentials');
      }
      onLogin(authenticatedCredentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, accountName, username, password, onLogin, rememberMe]);

  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('https://lh3.googleusercontent.com/p/AF1QipMXRp5PIoFZ5TWVYe9vY98uNrrL33dIiEGyd91N=s680-w680-h510-rw')" }}
    >
      <div className="w-full max-w-lg p-10 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="text-center">
            <img src="https://media.webfleet.com/f_auto,q_auto/branding/wf/wf.svg" alt="Webfleet Logo" className="h-12 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 p-2">
                COLD CHAIN MONITOR
            </h1>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <input 
              id="api-key" 
              name="api-key" 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required 
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-login-input bg-login-input text-black placeholder-gray-800 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm" 
              placeholder="API Key" 
            />
          </div>
          <div className="rounded-md shadow-sm -space-y-px">
             <div>
              <input 
                id="account-name" 
                name="account-name" 
                type="text" 
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required 
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-login-input bg-login-input text-black placeholder-gray-800 rounded-t-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm" 
                placeholder="Account Name" 
              />
            </div>
            <div>
              <input 
                id="username" 
                name="username" 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username" 
                required 
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-login-input bg-login-input text-black placeholder-gray-800 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm" 
                placeholder="Username" 
              />
            </div>
             <div>
              <input 
                id="password" 
                name="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" 
                required 
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-login-input bg-login-input text-black placeholder-gray-800 rounded-b-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm" 
                placeholder="Password" 
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
              Remember me
            </label>
          </div>
          
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div>
            <button 
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-400 disabled:cursor-not-allowed"
            >
              {isLoading ? <Spinner /> : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;