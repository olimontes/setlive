import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function AuthPage() {
  const auth = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    if (password.length < 8) {
      return;
    }

    if (isRegisterMode) {
      await auth.register({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      return;
    }

    await auth.login(email.trim(), password);
  }

  return (
    <main className="shell">
      <section className="card">
        <h1>SetLive</h1>
        <p>{isRegisterMode ? 'Crie sua conta para organizar seus shows.' : 'Entre na sua conta para abrir seu painel.'}</p>

        <form onSubmit={handleSubmit} className="form">
          {isRegisterMode && (
            <>
              <label>
                Nome
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label>
                Sobrenome
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
            </>
          )}

          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label>
            Senha
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </label>

          <button type="submit" disabled={auth.isLoading}>
            {isRegisterMode ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <button type="button" className="link" disabled={auth.isLoading} onClick={() => setIsRegisterMode((prev) => !prev)}>
          {isRegisterMode ? 'Ja tem conta? Entrar' : 'Nao tem conta? Cadastrar'}
        </button>

        {auth.errorMessage && <p className="error">{auth.errorMessage}</p>}
      </section>
    </main>
  );
}

export default AuthPage;
