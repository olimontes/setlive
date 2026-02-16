export const API_ROOT = import.meta.env.VITE_API_ROOT ?? 'http://localhost:8000/api';
export const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

export const AUTH_API_BASE_URL = `${API_ROOT}/auth`;
export const REPERTOIRE_API_BASE_URL = `${API_ROOT}/repertoire`;
