import { API_ROOT } from '../config/api';
import { readTokens } from './tokenStorage';

const SPOTIFY_API_BASE = `${API_ROOT}/spotify`;

function authHeaders() {
  const tokens = readTokens();
  return {
    Authorization: `Bearer ${tokens?.access ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(response, fallback) {
  try {
    const body = await response.json();
    if (body?.detail) {
      return body.detail;
    }
  } catch {
    // no-op
  }
  return fallback;
}

async function requestJson(url, options = {}, fallbackError = 'Erro na requisicao Spotify.') {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response, fallbackError));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getSpotifyStatus() {
  return requestJson(`${SPOTIFY_API_BASE}/status/`, {}, 'Falha ao consultar conexao Spotify.');
}

export function getSpotifyAuthUrl(redirectUri) {
  const query = new URLSearchParams({ redirect_uri: redirectUri }).toString();
  return requestJson(`${SPOTIFY_API_BASE}/auth-url/?${query}`, {}, 'Falha ao iniciar OAuth Spotify.');
}

export function exchangeSpotifyCode({ code, state, redirectUri }) {
  return requestJson(
    `${SPOTIFY_API_BASE}/exchange-code/`,
    {
      method: 'POST',
      body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    },
    'Falha ao concluir conexao com Spotify.'
  );
}

export function listSpotifyPlaylists() {
  return requestJson(`${SPOTIFY_API_BASE}/playlists/`, {}, 'Falha ao listar playlists Spotify.');
}

export function importSpotifyPlaylist(playlistId) {
  return requestJson(
    `${SPOTIFY_API_BASE}/import-playlist/`,
    {
      method: 'POST',
      body: JSON.stringify({ playlist_id: playlistId }),
    },
    'Falha ao importar playlist do Spotify.'
  );
}
