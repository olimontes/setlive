import { REPERTOIRE_API_BASE_URL } from '../config/api';
import { readTokens } from './tokenStorage';

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

    if (typeof body === 'object' && body !== null) {
      const firstField = Object.keys(body)[0];
      const firstValue = body[firstField];
      if (Array.isArray(firstValue) && firstValue.length > 0) {
        return String(firstValue[0]);
      }
      if (typeof firstValue === 'string') {
        return firstValue;
      }
    }
  } catch {
    // no-op
  }

  return fallback;
}

async function requestJson(url, options = {}, fallbackError = 'Erro na requisicao.') {
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

export function listSongs() {
  return requestJson(`${REPERTOIRE_API_BASE_URL}/songs/`, {}, 'Falha ao listar musicas.');
}

export function createSong({ title, artist }) {
  return requestJson(
    `${REPERTOIRE_API_BASE_URL}/songs/`,
    {
      method: 'POST',
      body: JSON.stringify({ title, artist }),
    },
    'Falha ao criar musica.'
  );
}

export function listSetlists() {
  return requestJson(`${REPERTOIRE_API_BASE_URL}/setlists/`, {}, 'Falha ao listar repertorios.');
}

export function createSetlist({ name }) {
  return requestJson(
    `${REPERTOIRE_API_BASE_URL}/setlists/`,
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    },
    'Falha ao criar repertorio.'
  );
}

export function getSetlist(setlistId) {
  return requestJson(`${REPERTOIRE_API_BASE_URL}/setlists/${setlistId}/`, {}, 'Falha ao carregar repertorio.');
}

export function updateSetlist(setlistId, { name }) {
  return requestJson(
    `${REPERTOIRE_API_BASE_URL}/setlists/${setlistId}/`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
    'Falha ao atualizar repertorio.'
  );
}

export function deleteSetlist(setlistId) {
  return requestJson(
    `${REPERTOIRE_API_BASE_URL}/setlists/${setlistId}/`,
    {
      method: 'DELETE',
    },
    'Falha ao remover repertorio.'
  );
}

export function addSetlistItem(setlistId, songId) {
  return requestJson(
    `${REPERTOIRE_API_BASE_URL}/setlists/${setlistId}/items/`,
    {
      method: 'POST',
      body: JSON.stringify({ song_id: songId }),
    },
    'Falha ao adicionar musica ao repertorio.'
  );
}

export function reorderSetlist(setlistId, itemIds) {
  return requestJson(
    `${REPERTOIRE_API_BASE_URL}/setlists/${setlistId}/reorder/`,
    {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    },
    'Falha ao reordenar repertorio.'
  );
}

export function deleteSetlistItem(itemId) {
  return requestJson(
    `${REPERTOIRE_API_BASE_URL}/items/${itemId}/`,
    {
      method: 'DELETE',
    },
    'Falha ao remover item do repertorio.'
  );
}
