const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export function saveTokens({ access, refresh }) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function readTokens() {
  const access = localStorage.getItem(ACCESS_KEY);
  const refresh = localStorage.getItem(REFRESH_KEY);

  if (!access || !refresh) {
    return null;
  }

  return { access, refresh };
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
