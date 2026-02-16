import { useAuth } from '../context/AuthContext';

function HomePage() {
  const { logout } = useAuth();

  return (
    <main className="shell">
      <section className="card">
        <h1>SetLive</h1>
        <p>Sessao ativa com sucesso.</p>
        <button onClick={logout}>Sair</button>
      </section>
    </main>
  );
}

export default HomePage;
