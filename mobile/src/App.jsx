import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import PublicRequestPage from './pages/PublicRequestPage';

function AuthenticatedApp() {
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

function App() {
  const search = new URLSearchParams(window.location.search);
  const hasPublicToken = Boolean(search.get('public_token') || search.get('token'));

  if (window.location.pathname.startsWith('/public/') || hasPublicToken) {
    return <PublicRequestPage />;
  }

  return <AuthenticatedApp />;
}

export default App;
