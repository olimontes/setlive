import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login, me, register } from '../services/authApi';
import { clearTokens, readTokens, saveTokens } from '../services/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function bootstrap() {
      setIsLoading(true);

      try {
        const saved = readTokens();
        if (!saved) {
          setIsAuthenticated(false);
        } else {
          await me(saved.access);
          setIsAuthenticated(true);
        }
      } catch {
        clearTokens();
        setIsAuthenticated(false);
      } finally {
        setIsBootstrapped(true);
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function doLogin(email, password) {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const tokens = await login({ email, password });
      saveTokens(tokens);
      setIsAuthenticated(true);
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível concluir a autenticação.');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function doRegister({ email, password, firstName, lastName }) {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const tokens = await register({ email, password, firstName, lastName });
      saveTokens(tokens);
      setIsAuthenticated(true);
    } catch (error) {
      setErrorMessage(error.message || 'Não foi possível concluir a autenticação.');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    clearTokens();
    setIsAuthenticated(false);
  }

  const value = useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      isBootstrapped,
      errorMessage,
      login: doLogin,
      register: doRegister,
      logout,
    }),
    [isLoading, isAuthenticated, isBootstrapped, errorMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return context;
}
