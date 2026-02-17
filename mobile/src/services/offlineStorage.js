const SNAPSHOT_KEY = 'setlive_offline_snapshot_v1';
const PENDING_MUTATIONS_KEY = 'setlive_pending_mutations_v1';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

export function loadOfflineSnapshot() {
  return readJson(SNAPSHOT_KEY, null);
}

export function saveOfflineSnapshot(snapshot) {
  writeJson(SNAPSHOT_KEY, snapshot);
}

export function loadPendingMutations() {
  const pending = readJson(PENDING_MUTATIONS_KEY, []);
  return Array.isArray(pending) ? pending : [];
}

export function savePendingMutations(pending) {
  writeJson(PENDING_MUTATIONS_KEY, pending);
}
