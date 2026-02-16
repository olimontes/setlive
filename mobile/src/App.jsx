import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';

function App() {
  const { isBootstrapped, isLoading, isAuthenticated } = useAuth();

  if (!isBootstrapped || isLoading) {
    return (
      <main className="shell">
        <section className="card">
          <p>Carregando sessao...</p>
        </section>
      </main>
    );
  }

  return isAuthenticated ? <HomePage /> : <AuthPage />;
}

export default App;
