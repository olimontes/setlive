import { AUTH_API_BASE_URL } from '../config/api';

async function parseError(response, fallback) {
  try {
    const body = await response.json();
    if (body?.detail) {
      return body.detail;
    }

    if (typeof body === 'object' && body !== null) {
      const firstField = Object.keys(body)[0];
      const firstValue = body[firstField];
      if (Array.isArray(firstValue) && firstValue.length > 0) {
        return String(firstValue[0]);
      }
    }
  } catch {
    // no-op
  }
  return fallback;
}

export async function login({ email, password }) {
  const response = await fetch(`${AUTH_API_BASE_URL}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Falha no login.'));
  }

  const payload = await response.json();
  return payload.tokens;
}

export async function register({ email, password, firstName, lastName }) {
  const response = await fetch(`${AUTH_API_BASE_URL}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Falha no cadastro.'));
  }

  const payload = await response.json();
  return payload.tokens;
}

export async function me(accessToken) {
  const response = await fetch(`${AUTH_API_BASE_URL}/me/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Sessao invalida.');
  }
}
