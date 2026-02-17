import { useEffect, useMemo, useRef, useState } from 'react';
import { API_ROOT, SPOTIFY_REDIRECT_URI } from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  addSetlistItem,
  createSetlist,
  createSong,
  deleteSetlist,
  deleteSetlistItem,
  getSetlist,
  getSetlistAudienceLink,
  listSetlistAudienceRequests,
  listSetlists,
  listSongs,
  reorderSetlist,
  updateSetlist,
} from '../services/setlistApi';
import {
  exchangeSpotifyCode,
  getSpotifyAuthUrl,
  getSpotifyStatus,
  importSpotifyPlaylist,
  listSpotifyPlaylists,
} from '../services/spotifyApi';
import {
  loadOfflineSnapshot,
  loadPendingMutations,
  saveOfflineSnapshot,
  savePendingMutations,
} from '../services/offlineStorage';
import { readTokens } from '../services/tokenStorage';
import {
  filterSongsNotInSetlist,
  idsReadyToAdd,
  mergeSelectionWithSongs,
  pruneSelectedSongIds,
} from '../utils/songSelection';

function toWebSocketBaseUrl() {
  if (API_ROOT.startsWith('https://')) {
    return API_ROOT.replace('https://', 'wss://').replace(/\/api$/, '');
  }
  return API_ROOT.replace('http://', 'ws://').replace(/\/api$/, '');
}

function toCifraSlug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function isNetworkError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network') || message.includes('offline');
}

function createTempId() {
  return -Math.floor(Date.now() + Math.random() * 1000);
}

function HomePage() {
  const { logout } = useAuth();

  const [songs, setSongs] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [activeSetlist, setActiveSetlist] = useState(null);

  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');
  const [newSetlistName, setNewSetlistName] = useState('');
  const [editSetlistName, setEditSetlistName] = useState('');
  const [songSearchTerm, setSongSearchTerm] = useState('');
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [songsPage, setSongsPage] = useState(1);
  const [songsPageSize] = useState(30);
  const [songsTotal, setSongsTotal] = useState(0);
  const [songsHasNext, setSongsHasNext] = useState(false);
  const [songsHasPrevious, setSongsHasPrevious] = useState(false);
  const [selectedLibrarySongIds, setSelectedLibrarySongIds] = useState([]);

  const [spotifyStatus, setSpotifyStatus] = useState({ connected: false });
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [selectedSpotifyPlaylistId, setSelectedSpotifyPlaylistId] = useState('');

  const [audienceLink, setAudienceLink] = useState(null);
  const [requestQueue, setRequestQueue] = useState([]);
  const [queueConnectionStatus, setQueueConnectionStatus] = useState('disconnected');
  const [isStageMode, setIsStageMode] = useState(false);
  const [stageItemIndex, setStageItemIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  const [pendingMutations, setPendingMutations] = useState(() => loadPendingMutations());

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const queueSocketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const activeSetlistId = activeSetlist?.id ?? null;
  const stageItems = activeSetlist?.items ?? [];
  const currentStageItem = stageItems[stageItemIndex] ?? null;
  const spotifyRedirectUri = SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;
  const pendingCount = pendingMutations.length;
  const audienceQrCodeUrl = useMemo(() => {
    if (!audienceLink?.public_url) {
      return '';
    }
    const encoded = encodeURIComponent(audienceLink.public_url);
    return `https://quickchart.io/qr?text=${encoded}&size=260&margin=1`;
  }, [audienceLink?.public_url]);

  function persistPendingMutations(nextPending) {
    setPendingMutations(nextPending);
    savePendingMutations(nextPending);
  }

  function queueMutation(type, payload) {
    setPendingMutations((current) => {
      const nextPending = [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type,
          payload,
        },
      ];
      savePendingMutations(nextPending);
      return nextPending;
    });
  }

  function updateSetlistInLocalState(setlistId, updater) {
    setSetlists((current) => current.map((setlist) => (setlist.id === setlistId ? updater(setlist) : setlist)));
    setActiveSetlist((current) => {
      if (!current || current.id !== setlistId) {
        return current;
      }
      return updater(current);
    });
  }

  useEffect(() => {
    async function bootstrap() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        if (!window.navigator.onLine) {
          throw new Error('offline');
        }

        await handleSpotifyCallback();

        const [songsPayload, loadedSetlists, status] = await Promise.all([
          listSongs({ search: '', page: 1, pageSize: songsPageSize }),
          listSetlists(),
          getSpotifyStatus(),
        ]);

        setSongs(songsPayload.items ?? []);
        setSongsTotal(songsPayload.total ?? (songsPayload.items ?? []).length);
        setSongsHasPrevious(Boolean(songsPayload.has_previous));
        setSongsHasNext(Boolean(songsPayload.has_next));
        setSongsPage(songsPayload.page ?? 1);
        setSetlists(loadedSetlists);
        setSpotifyStatus(status);

        if (loadedSetlists.length > 0) {
          const detailEntries = await Promise.all(
            loadedSetlists.map(async (setlist) => [setlist.id, await getSetlist(setlist.id)])
          );
          const detailById = Object.fromEntries(detailEntries);
          const firstDetail = detailById[loadedSetlists[0].id];
          setActiveSetlist(firstDetail);
          setEditSetlistName(firstDetail.name);
          saveOfflineSnapshot({
            songs: songsPayload.items ?? [],
            setlists: loadedSetlists,
            activeSetlistId: firstDetail.id,
            setlistDetailsById: detailById,
            updatedAt: new Date().toISOString(),
          });
        } else {
          setActiveSetlist(null);
          setEditSetlistName('');
        }

        if (status.connected) {
          const playlistsPayload = await listSpotifyPlaylists();
          setSpotifyPlaylists(playlistsPayload.items ?? []);
        } else {
          setSpotifyPlaylists([]);
        }
      } catch (error) {
        const snapshot = loadOfflineSnapshot();
        if (snapshot) {
          setSongs(snapshot.songs ?? []);
          setSongsTotal((snapshot.songs ?? []).length);
          setSongsHasPrevious(false);
          setSongsHasNext(false);
          setSongsPage(1);
          setSetlists(snapshot.setlists ?? []);
          const cachedActiveId = snapshot.activeSetlistId ?? null;
          const cachedActive = (snapshot.setlistDetailsById ?? {})[cachedActiveId] ?? null;
          setActiveSetlist(cachedActive);
          setEditSetlistName(cachedActive?.name ?? '');
          setErrorMessage('Modo offline ativo. Dados carregados do cache local.');
        } else {
          setErrorMessage(error.message || 'Falha ao carregar dados iniciais.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }

    function goOffline() {
      setIsOnline(false);
      setQueueConnectionStatus('offline');
    }

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSongSearchQuery(songSearchTerm.trim());
      setSongsPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [songSearchTerm]);

  useEffect(() => {
    const currentSnapshot = loadOfflineSnapshot() ?? { setlistDetailsById: {} };
    const nextSetlistDetails = { ...(currentSnapshot.setlistDetailsById ?? {}) };
    if (activeSetlist?.id) {
      nextSetlistDetails[activeSetlist.id] = activeSetlist;
    }
    saveOfflineSnapshot({
      songs,
      setlists,
      activeSetlistId: activeSetlist?.id ?? null,
      setlistDetailsById: nextSetlistDetails,
      updatedAt: new Date().toISOString(),
    });
  }, [songs, setlists, activeSetlist]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    let cancelled = false;

    async function loadSongsPage() {
      if (!isOnline) {
        const snapshot = loadOfflineSnapshot();
        const cachedSongs = snapshot?.songs ?? [];
        const term = songSearchQuery.toLowerCase();
        const filtered = term
          ? cachedSongs.filter((song) => {
              const title = String(song.title ?? '').toLowerCase();
              const artist = String(song.artist ?? '').toLowerCase();
              return title.includes(term) || artist.includes(term);
            })
          : cachedSongs;
        const start = (songsPage - 1) * songsPageSize;
        const items = filtered.slice(start, start + songsPageSize);
        if (cancelled) {
          return;
        }
        setSongs(items);
        setSongsTotal(filtered.length);
        setSongsHasPrevious(songsPage > 1);
        setSongsHasNext(start + songsPageSize < filtered.length);
        return;
      }

      try {
        const payload = await listSongs({ search: songSearchQuery, page: songsPage, pageSize: songsPageSize });
        if (cancelled) {
          return;
        }
        setSongs(payload.items ?? []);
        setSongsTotal(payload.total ?? (payload.items ?? []).length);
        setSongsHasPrevious(Boolean(payload.has_previous));
        setSongsHasNext(Boolean(payload.has_next));
        setSongsPage(payload.page ?? songsPage);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || 'Falha ao listar musicas.');
        }
      }
    }

    loadSongsPage();

    return () => {
      cancelled = true;
    };
  }, [isLoading, isOnline, songSearchQuery, songsPage, songsPageSize]);

  useEffect(() => {
    let cancelled = false;

    async function loadAudienceData(setlistId) {
      if (!setlistId || !isOnline) {
        setAudienceLink(null);
        if (!setlistId) {
          setRequestQueue([]);
        }
        setQueueConnectionStatus(isOnline ? 'disconnected' : 'offline');
        return;
      }

      try {
        const [link, queuePayload] = await Promise.all([
          getSetlistAudienceLink(setlistId),
          listSetlistAudienceRequests(setlistId),
        ]);
        if (cancelled) {
          return;
        }
        setAudienceLink(link);
        setRequestQueue(queuePayload.items ?? []);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error.message || 'Falha ao carregar dados de pedidos.');
        }
      }
    }

    loadAudienceData(activeSetlistId);

    return () => {
      cancelled = true;
    };
  }, [activeSetlistId, isOnline]);

  useEffect(() => {
    if (!isOnline || !activeSetlistId || !audienceLink?.token) {
      if (queueSocketRef.current) {
        queueSocketRef.current.close();
      }
      queueSocketRef.current = null;
      setQueueConnectionStatus(isOnline ? 'disconnected' : 'offline');
      return;
    }

    let closedByApp = false;
    const wsBase = toWebSocketBaseUrl();
    const accessToken = readTokens()?.access ?? '';
    const wsUrl = `${wsBase}/ws/repertoire/setlists/${activeSetlistId}/requests/?token=${encodeURIComponent(accessToken)}`;

    async function refreshQueueSilently() {
      try {
        const queuePayload = await listSetlistAudienceRequests(activeSetlistId);
        setRequestQueue(queuePayload.items ?? []);
      } catch {
        // no-op
      }
    }

    function connect() {
      setQueueConnectionStatus('connecting');
      const socket = new WebSocket(wsUrl);
      queueSocketRef.current = socket;

      socket.onopen = () => {
        setQueueConnectionStatus('connected');
        refreshQueueSilently();
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'queue.request.created' || payload.type === 'connection.ready') {
            refreshQueueSilently();
          }
        } catch {
          // no-op
        }
      };

      socket.onclose = () => {
        if (closedByApp) {
          return;
        }
        setQueueConnectionStatus('reconnecting');
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      closedByApp = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (queueSocketRef.current) {
        queueSocketRef.current.close();
      }
      queueSocketRef.current = null;
    };
  }, [activeSetlistId, audienceLink?.token, isOnline]);

  useEffect(() => {
    if (!isOnline || !activeSetlistId) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const queuePayload = await listSetlistAudienceRequests(activeSetlistId);
        setRequestQueue(queuePayload.items ?? []);
      } catch {
        // no-op
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeSetlistId, isOnline]);

  useEffect(() => {
    if (!isStageMode) {
      return;
    }
    if (!activeSetlist || stageItems.length === 0) {
      setIsStageMode(false);
      setStageItemIndex(0);
      return;
    }
    if (stageItemIndex > stageItems.length - 1) {
      setStageItemIndex(stageItems.length - 1);
    }
  }, [activeSetlist, isStageMode, stageItemIndex, stageItems.length]);

  useEffect(() => {
    if (!isStageMode) {
      return;
    }

    function onKeyDown(event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousStageSong();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextStageSong();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeStageMode();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isStageMode, stageItems.length]);

  useEffect(() => {
    if (!isOnline || pendingCount === 0) {
      return;
    }
    flushPendingMutations();
  }, [isOnline, pendingCount]);

  const songsNotInSetlist = useMemo(() => {
    return filterSongsNotInSetlist(songs, activeSetlist?.items ?? []);
  }, [songs, activeSetlist?.items]);

  const filteredSongsNotInSetlist = songsNotInSetlist;

  useEffect(() => {
    setSelectedLibrarySongIds((current) => pruneSelectedSongIds(current, songsNotInSetlist));
  }, [songsNotInSetlist]);

  function buildChordSearchUrl(song) {
    if (!song) {
      return '#';
    }
    const artistSlug = toCifraSlug(song.artist || 'desconhecido');
    const titleSlug = toCifraSlug(song.title);
    return `https://www.cifraclub.com.br/${artistSlug}/${titleSlug}/imprimir.html`;
  }

  function buildLyricsSearchUrl(song) {
    if (!song) {
      return '#';
    }
    const query = encodeURIComponent(`${song.title} ${song.artist ?? ''} letra`.trim());
    return `https://www.google.com/search?q=${query}`;
  }

  function buildRequestSearchPayload(request) {
    if (request.song?.title) {
      return {
        title: request.song.title,
        artist: request.song.artist ?? '',
      };
    }
    return {
      title: request.requested_song_name ?? '',
      artist: '',
    };
  }

  async function applyPendingMutation(mutation, idMaps) {
    const resolveId = (id, map) => {
      if (id < 0 && map.has(id)) {
        return map.get(id);
      }
      return id;
    };

    if (mutation.type === 'create_song') {
      const { tempSongId, title, artist } = mutation.payload;
      const created = await createSong({ title, artist });
      idMaps.songId.set(tempSongId, created.id);
      return;
    }

    if (mutation.type === 'create_setlist') {
      const { tempSetlistId, name } = mutation.payload;
      const created = await createSetlist({ name });
      idMaps.setlistId.set(tempSetlistId, created.id);
      return;
    }

    if (mutation.type === 'rename_setlist') {
      const { setlistId, name } = mutation.payload;
      const resolvedSetlistId = resolveId(setlistId, idMaps.setlistId);
      if (resolvedSetlistId < 0) {
        return;
      }
      await updateSetlist(resolvedSetlistId, { name });
      return;
    }

    if (mutation.type === 'add_setlist_item') {
      const { setlistId, songId, tempItemId } = mutation.payload;
      const resolvedSetlistId = resolveId(setlistId, idMaps.setlistId);
      const resolvedSongId = resolveId(songId, idMaps.songId);
      if (resolvedSetlistId < 0 || resolvedSongId < 0) {
        return;
      }
      const created = await addSetlistItem(resolvedSetlistId, resolvedSongId);
      idMaps.itemId.set(tempItemId, created.id);
      return;
    }

    if (mutation.type === 'delete_setlist_item') {
      const { itemId } = mutation.payload;
      const resolvedItemId = resolveId(itemId, idMaps.itemId);
      if (resolvedItemId < 0) {
        return;
      }
      await deleteSetlistItem(resolvedItemId);
      return;
    }

    if (mutation.type === 'reorder_setlist') {
      const { setlistId, itemIds } = mutation.payload;
      const resolvedSetlistId = resolveId(setlistId, idMaps.setlistId);
      if (resolvedSetlistId < 0) {
        return;
      }
      const resolvedItemIds = itemIds.map((itemId) => resolveId(itemId, idMaps.itemId)).filter((itemId) => itemId > 0);
      if (resolvedItemIds.length === 0) {
        return;
      }
      await reorderSetlist(resolvedSetlistId, resolvedItemIds);
    }
  }

  async function flushPendingMutations() {
    if (!isOnline || pendingMutations.length === 0 || isSyncingPending) {
      return;
    }

    setIsSyncingPending(true);
    let remaining = [...pendingMutations];
    let hadProgress = false;

    const idMaps = {
      songId: new Map(),
      setlistId: new Map(),
      itemId: new Map(),
    };

    while (remaining.length > 0) {
      const current = remaining[0];
      try {
        await applyPendingMutation(current, idMaps);
        remaining = remaining.slice(1);
        hadProgress = true;
      } catch (error) {
        if (isNetworkError(error)) {
          break;
        }
        remaining = remaining.slice(1);
      }
    }

    persistPendingMutations(remaining);

    if (hadProgress) {
      try {
        await Promise.all([refreshSongs(), refreshSetlists(activeSetlistId)]);
        setSuccessMessage('Alteracoes offline sincronizadas.');
      } catch {
        // no-op
      }
    }

    setIsSyncingPending(false);
  }

  async function handleSpotifyCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      return;
    }

    const oauthKey = `spotify_oauth_${state}_${code}`;
    const oauthStatus = sessionStorage.getItem(oauthKey);
    if (oauthStatus === 'pending' || oauthStatus === 'done') {
      const cleanUrl = '/';
      window.history.replaceState({}, document.title, cleanUrl);
      return;
    }
    sessionStorage.setItem(oauthKey, 'pending');

    try {
      await exchangeSpotifyCode({
        code,
        state,
        redirectUri: spotifyRedirectUri,
      });
      sessionStorage.setItem(oauthKey, 'done');
    } catch (error) {
      sessionStorage.removeItem(oauthKey);
      throw error;
    }

    const cleanUrl = '/';
    window.history.replaceState({}, document.title, cleanUrl);
    setSuccessMessage('Conta Spotify conectada com sucesso.');
  }

  async function refreshSetlists(targetSetlistId = activeSetlistId) {
    if (!isOnline) {
      const snapshot = loadOfflineSnapshot();
      const cachedSetlists = snapshot?.setlists ?? [];
      const cachedDetails = snapshot?.setlistDetailsById ?? {};
      setSetlists(cachedSetlists);
      if (!targetSetlistId) {
        setActiveSetlist(null);
        setEditSetlistName('');
        return;
      }
      const detail = cachedDetails[targetSetlistId] ?? null;
      setActiveSetlist(detail);
      setEditSetlistName(detail?.name ?? '');
      return;
    }

    const loadedSetlists = await listSetlists();
    setSetlists(loadedSetlists);

    if (!targetSetlistId) {
      setActiveSetlist(null);
      return;
    }

    const exists = loadedSetlists.some((setlist) => setlist.id === targetSetlistId);
    if (!exists) {
      setActiveSetlist(null);
      setEditSetlistName('');
      return;
    }

    const detail = await getSetlist(targetSetlistId);
    setActiveSetlist(detail);
    setEditSetlistName(detail.name);
  }

  async function refreshSongs(next = {}) {
    const targetSearch = next.search ?? songSearchQuery;
    const targetPage = next.page ?? songsPage;

    if (!isOnline) {
      const snapshot = loadOfflineSnapshot();
      const cachedSongs = snapshot?.songs ?? [];
      const term = String(targetSearch).toLowerCase();
      const filtered = term
        ? cachedSongs.filter((song) => {
            const title = String(song.title ?? '').toLowerCase();
            const artist = String(song.artist ?? '').toLowerCase();
            return title.includes(term) || artist.includes(term);
          })
        : cachedSongs;
      const start = (targetPage - 1) * songsPageSize;
      const items = filtered.slice(start, start + songsPageSize);
      setSongs(items);
      setSongsTotal(filtered.length);
      setSongsHasPrevious(targetPage > 1);
      setSongsHasNext(start + songsPageSize < filtered.length);
      setSongsPage(targetPage);
      return;
    }

    const payload = await listSongs({ search: targetSearch, page: targetPage, pageSize: songsPageSize });
    setSongs(payload.items ?? []);
    setSongsTotal(payload.total ?? (payload.items ?? []).length);
    setSongsHasPrevious(Boolean(payload.has_previous));
    setSongsHasNext(Boolean(payload.has_next));
    setSongsPage(payload.page ?? targetPage);
  }

  async function handleConnectSpotify() {
    if (!isOnline) {
      setErrorMessage('Conexao Spotify indisponivel offline.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      const payload = await getSpotifyAuthUrl(spotifyRedirectUri);
      window.location.href = payload.authorize_url;
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao iniciar conexao Spotify.');
      setIsSaving(false);
    }
  }

  async function handleRefreshSpotifyPlaylists() {
    if (!isOnline) {
      setErrorMessage('Atualizacao de playlists indisponivel offline.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      const status = await getSpotifyStatus();
      setSpotifyStatus(status);
      if (!status.connected) {
        setSpotifyPlaylists([]);
        setSelectedSpotifyPlaylistId('');
        return;
      }

      const payload = await listSpotifyPlaylists();
      setSpotifyPlaylists(payload.items ?? []);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao listar playlists Spotify.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImportSpotifyPlaylist(event) {
    event.preventDefault();

    if (!selectedSpotifyPlaylistId) {
      return;
    }
    if (!isOnline) {
      setErrorMessage('Importacao Spotify indisponivel offline.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const imported = await importSpotifyPlaylist(selectedSpotifyPlaylistId);
      await Promise.all([refreshSongs(), refreshSetlists(imported.setlist_id)]);
      setSuccessMessage(
        `Playlist importada: ${imported.setlist_name} (${imported.tracks_total} faixas, ${imported.songs_created} novas, ${imported.songs_reused} reaproveitadas).`
      );
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao importar playlist Spotify.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateSong(event) {
    event.preventDefault();

    const title = newSongTitle.trim();
    const artist = newSongArtist.trim();

    if (!title) {
      return;
    }
    if (!isOnline) {
      const tempSong = {
        id: createTempId(),
        title,
        artist,
        duration_ms: null,
        spotify_track_id: '',
        created_at: new Date().toISOString(),
      };
      setSongs((current) => [...current, tempSong].sort((a, b) => a.title.localeCompare(b.title)));
      queueMutation('create_song', { tempSongId: tempSong.id, title, artist });
      setNewSongTitle('');
      setNewSongArtist('');
      setSuccessMessage('Musica criada offline. Sera sincronizada ao reconectar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await createSong({
        title,
        artist,
      });
      setSongsPage(1);
      await refreshSongs({ page: 1 });
      setNewSongTitle('');
      setNewSongArtist('');
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao criar musica.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateSetlist(event) {
    event.preventDefault();

    const name = newSetlistName.trim();
    if (!name) {
      return;
    }
    if (!isOnline) {
      const tempSetlistId = createTempId();
      const now = new Date().toISOString();
      const tempSetlist = {
        id: tempSetlistId,
        name,
        created_at: now,
        updated_at: now,
      };
      const tempDetail = {
        ...tempSetlist,
        items: [],
      };
      setSetlists((current) => [tempSetlist, ...current]);
      setActiveSetlist(tempDetail);
      setEditSetlistName(name);
      setNewSetlistName('');
      queueMutation('create_setlist', { tempSetlistId, name });
      setSuccessMessage('Repertorio criado offline. Sera sincronizado ao reconectar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const created = await createSetlist({ name });
      setNewSetlistName('');
      await refreshSetlists(created.id);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao criar repertorio.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSelectSetlist(setlistId) {
    setIsSaving(true);
    setErrorMessage('');
    try {
      let detail;
      if (isOnline) {
        detail = await getSetlist(setlistId);
      } else {
        const snapshot = loadOfflineSnapshot();
        detail = snapshot?.setlistDetailsById?.[setlistId] ?? null;
        if (!detail) {
          throw new Error('Repertorio nao disponivel no cache offline.');
        }
      }
      setActiveSetlist(detail);
      setEditSetlistName(detail.name);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao carregar repertorio.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRenameSetlist(event) {
    event.preventDefault();

    if (!activeSetlistId || !editSetlistName.trim()) {
      return;
    }

    const nextName = editSetlistName.trim();

    if (!isOnline) {
      updateSetlistInLocalState(activeSetlistId, (setlist) => ({ ...setlist, name: nextName }));
      queueMutation('rename_setlist', { setlistId: activeSetlistId, name: nextName });
      setSuccessMessage('Alteracao salva offline. Sera sincronizada ao reconectar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await updateSetlist(activeSetlistId, { name: nextName });
      await refreshSetlists(activeSetlistId);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao atualizar repertorio.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSetlist() {
    if (!activeSetlistId) {
      return;
    }
    if (!isOnline) {
      setErrorMessage('Exclusao de repertorio requer conexao online.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await deleteSetlist(activeSetlistId);
      const fallbackId = setlists.find((setlist) => setlist.id !== activeSetlistId)?.id ?? null;
      await refreshSetlists(fallbackId);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao remover repertorio.');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleLibrarySongSelection(songId) {
    setSelectedLibrarySongIds((current) => {
      if (current.includes(songId)) {
        return current.filter((id) => id !== songId);
      }
      return [...current, songId];
    });
  }

  function selectAllFilteredSongs() {
    setSelectedLibrarySongIds((current) => mergeSelectionWithSongs(current, filteredSongsNotInSetlist));
  }

  function clearLibrarySelection() {
    setSelectedLibrarySongIds([]);
  }

  function goToPreviousSongsPage() {
    setSongsPage((current) => Math.max(current - 1, 1));
  }

  function goToNextSongsPage() {
    if (!songsHasNext) {
      return;
    }
    setSongsPage((current) => current + 1);
  }

  function addSongToSetOffline(songId) {
    const selectedSong = songs.find((song) => song.id === songId);
    if (!selectedSong) {
      return false;
    }
    if (activeSetlist?.items.some((item) => item.song.id === songId)) {
      return false;
    }

    const tempItemId = createTempId();
    const currentItems = activeSetlist?.items ?? [];
    const tempItem = {
      id: tempItemId,
      position: currentItems.length + 1,
      song: selectedSong,
    };
    setActiveSetlist((current) => {
      if (!current || current.id !== activeSetlistId) {
        return current;
      }
      return {
        ...current,
        items: [...current.items, tempItem],
      };
    });
    queueMutation('add_setlist_item', { setlistId: activeSetlistId, songId, tempItemId });
    return true;
  }

  async function addSongToSetOnline(songId) {
    await addSetlistItem(activeSetlistId, songId);
  }

  async function handleAddSelectedSongsToSet() {
    if (!activeSetlistId || selectedLibrarySongIds.length === 0) {
      return;
    }

    const idsToAdd = idsReadyToAdd(selectedLibrarySongIds, songsNotInSetlist);
    if (idsToAdd.length === 0) {
      setSelectedLibrarySongIds([]);
      return;
    }

    if (!isOnline) {
      let addedCount = 0;
      idsToAdd.forEach((songId) => {
        if (addSongToSetOffline(songId)) {
          addedCount += 1;
        }
      });
      setSelectedLibrarySongIds([]);
      if (addedCount > 0) {
        setSuccessMessage(`${addedCount} musica(s) adicionada(s) offline. Serao sincronizadas ao reconectar.`);
      }
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      for (const songId of idsToAdd) {
        // sequential insert keeps deterministic order in the set
        await addSongToSetOnline(songId);
      }
      setSelectedLibrarySongIds([]);
      await refreshSetlists(activeSetlistId);
      setSuccessMessage(`${idsToAdd.length} musica(s) adicionada(s) ao set atual.`);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao adicionar musicas ao repertorio.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMoveItem(itemId, direction) {
    if (!activeSetlistId || !activeSetlist) {
      return;
    }

    const items = [...activeSetlist.items];
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) {
      return;
    }

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    const [moved] = items.splice(index, 1);
    items.splice(targetIndex, 0, moved);

    if (!isOnline) {
      const reorderedDetail = {
        ...activeSetlist,
        items: items.map((item, position) => ({ ...item, position: position + 1 })),
      };
      setActiveSetlist(reorderedDetail);
      queueMutation('reorder_setlist', { setlistId: activeSetlistId, itemIds: items.map((item) => item.id) });
      setSuccessMessage('Reordenacao salva offline. Sera sincronizada ao reconectar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const detail = await reorderSetlist(
        activeSetlistId,
        items.map((item) => item.id)
      );
      setActiveSetlist(detail);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao reordenar repertorio.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveItem(itemId) {
    if (!activeSetlistId) {
      return;
    }
    if (!isOnline) {
      setActiveSetlist((current) => {
        if (!current || current.id !== activeSetlistId) {
          return current;
        }
        const remaining = current.items.filter((item) => item.id !== itemId).map((item, index) => ({ ...item, position: index + 1 }));
        return {
          ...current,
          items: remaining,
        };
      });
      queueMutation('delete_setlist_item', { itemId, setlistId: activeSetlistId });
      setSuccessMessage('Remocao salva offline. Sera sincronizada ao reconectar.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await deleteSetlistItem(itemId);
      await refreshSetlists(activeSetlistId);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao remover item.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyPublicLink() {
    if (!audienceLink?.public_url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(audienceLink.public_url);
      setSuccessMessage('Link publico copiado.');
    } catch {
      setErrorMessage('Nao foi possivel copiar o link.');
    }
  }

  function openStageMode(startIndex = 0) {
    if (!activeSetlist || stageItems.length === 0) {
      return;
    }
    const safeIndex = Math.min(Math.max(startIndex, 0), stageItems.length - 1);
    setStageItemIndex(safeIndex);
    setIsStageMode(true);
  }

  function closeStageMode() {
    setIsStageMode(false);
  }

  function goToPreviousStageSong() {
    setStageItemIndex((current) => Math.max(current - 1, 0));
  }

  function goToNextStageSong() {
    setStageItemIndex((current) => Math.min(current + 1, Math.max(stageItems.length - 1, 0)));
  }

  if (isLoading) {
    return (
      <main className="shell">
        <section className="card">
          <p>Carregando dados...</p>
        </section>
      </main>
    );
  }

  if (isStageMode) {
    return (
      <main className="stage-shell">
        <section className="stage-header">
          <div>
            <p className="stage-tag">Modo palco</p>
            <h1>{activeSetlist?.name ?? 'Sem repertorio'}</h1>
          </div>
          <button className="button-secondary" onClick={closeStageMode}>
            Sair do modo palco
          </button>
        </section>

        <section className="stage-main">
          <p className="stage-position">
            Musica {stageItemIndex + 1} de {stageItems.length}
          </p>
          <h2 className="stage-song-title">{currentStageItem?.song.title ?? 'Sem musica'}</h2>
          <p className="stage-song-artist">{currentStageItem?.song.artist || 'Artista nao informado'}</p>

          <div className="stage-links">
            <a
              href={buildChordSearchUrl(currentStageItem?.song)}
              target="_blank"
              rel="noreferrer"
              className="stage-link-button"
            >
              Abrir cifra
            </a>
            <a
              href={buildLyricsSearchUrl(currentStageItem?.song)}
              target="_blank"
              rel="noreferrer"
              className="stage-link-button"
            >
              Abrir letra
            </a>
          </div>

          <div className="stage-nav">
            <button onClick={goToPreviousStageSong} disabled={stageItemIndex === 0}>
              Anterior
            </button>
            <button onClick={goToNextStageSong} disabled={stageItemIndex >= stageItems.length - 1}>
              Proxima
            </button>
          </div>
        </section>

        <section className="stage-queue">
          <h3>Fila de pedidos</h3>
          <ul className="list compact">
            {requestQueue.slice(0, 5).map((request) => (
              <li key={request.id}>
                <strong>{request.requested_song_name || request.song?.title || 'Musica nao informada'}</strong>
                {request.requester_name ? ` (por ${request.requester_name})` : ''}
                <div className="row-actions">
                  <a
                    href={buildChordSearchUrl(buildRequestSearchPayload(request))}
                    target="_blank"
                    rel="noreferrer"
                    className="stage-link-button"
                  >
                    Cifra
                  </a>
                  <a
                    href={buildLyricsSearchUrl(buildRequestSearchPayload(request))}
                    target="_blank"
                    rel="noreferrer"
                    className="stage-link-button"
                  >
                    Letra
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="stage-setlist">
          <h3>Navegacao rapida</h3>
          <div className="stage-setlist-grid">
            {stageItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`stage-item-button ${index === stageItemIndex ? 'active' : ''}`}
                onClick={() => setStageItemIndex(index)}
              >
                {index + 1}. {item.song.title}
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell shell-wide">
      <section className="card board">
        <header className="board-header">
          <div>
            <h1>SetLive</h1>
          </div>
          <button className="button-secondary" onClick={logout}>
            Sair
          </button>
        </header>

        {errorMessage && <p className="error">{errorMessage}</p>}
        {successMessage && <p className="success">{successMessage}</p>}

        <section className="panel spotify-panel">
          <h2>Spotify</h2>
          <p>
            Status: {spotifyStatus.connected ? `Conectado (${spotifyStatus.display_name || spotifyStatus.spotify_user_id})` : 'Nao conectado'}
          </p>
          <div className="row-actions">
            <button type="button" onClick={handleConnectSpotify} disabled={isSaving || !isOnline}>
              Conectar Spotify
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={handleRefreshSpotifyPlaylists}
              disabled={isSaving || !spotifyStatus.connected || !isOnline}
            >
              Atualizar playlists
            </button>
          </div>
          <form className="form-inline" onSubmit={handleImportSpotifyPlaylist}>
            <select
              value={selectedSpotifyPlaylistId}
              onChange={(event) => setSelectedSpotifyPlaylistId(event.target.value)}
              required
              disabled={!spotifyStatus.connected || !isOnline}
            >
              <option value="">Selecione uma playlist</option>
              {spotifyPlaylists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} ({playlist.tracks_total})
                </option>
              ))}
            </select>
            <button type="submit" disabled={isSaving || !selectedSpotifyPlaylistId || !isOnline}>
              Importar
            </button>
          </form>
        </section>

        <div className="columns">
          <section className="panel">
            <h2>Repertorios</h2>
            <form className="form-inline" onSubmit={handleCreateSetlist}>
              <input
                value={newSetlistName}
                onChange={(event) => setNewSetlistName(event.target.value)}
                placeholder="Novo repertorio"
                required
              />
              <button disabled={isSaving}>Criar</button>
            </form>

            <ul className="list">
              {setlists.map((setlist) => (
                <li key={setlist.id}>
                  <button
                    className={`list-button ${setlist.id === activeSetlistId ? 'active' : ''}`}
                    onClick={() => handleSelectSetlist(setlist.id)}
                    disabled={isSaving}
                  >
                    {setlist.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Musicas</h2>
            <form className="form-stack" onSubmit={handleCreateSong}>
              <input
                value={newSongTitle}
                onChange={(event) => setNewSongTitle(event.target.value)}
                placeholder="Titulo"
                required
              />
              <input
                value={newSongArtist}
                onChange={(event) => setNewSongArtist(event.target.value)}
                placeholder="Artista"
              />
              <button disabled={isSaving}>Adicionar musica</button>
            </form>

            <div className="form-stack">
              <input
                value={songSearchTerm}
                onChange={(event) => setSongSearchTerm(event.target.value)}
                placeholder="Buscar musica para o set atual"
              />
              <p className="muted">
                Biblioteca: {songsTotal} musica(s) | Pagina {songsPage}
              </p>
              <div className="row-actions">
                <button type="button" className="button-secondary button-sm" onClick={goToPreviousSongsPage} disabled={!songsHasPrevious || isSaving}>
                  Pagina anterior
                </button>
                <button type="button" className="button-secondary button-sm" onClick={goToNextSongsPage} disabled={!songsHasNext || isSaving}>
                  Proxima pagina
                </button>
              </div>
              <div className="row-actions actions-grid-two">
                <button type="button" className="button-secondary" onClick={selectAllFilteredSongs} disabled={filteredSongsNotInSetlist.length === 0}>
                  Selecionar filtradas
                </button>
                <button type="button" className="button-secondary" onClick={clearLibrarySelection} disabled={selectedLibrarySongIds.length === 0}>
                  Limpar selecao
                </button>
              </div>
              <button type="button" className="button-sm" onClick={handleAddSelectedSongsToSet} disabled={!activeSetlistId || selectedLibrarySongIds.length === 0 || isSaving}>
                Adicionar selecionadas ao set atual ({selectedLibrarySongIds.length})
              </button>
            </div>

            <ul className="list compact">
              {filteredSongsNotInSetlist.map((song) => (
                <li key={song.id}>
                  <label className="row-actions">
                    <input
                      type="checkbox"
                      checked={selectedLibrarySongIds.includes(song.id)}
                      onChange={() => toggleLibrarySongSelection(song.id)}
                    />
                    <span>
                      {song.title}
                      {song.artist ? ` - ${song.artist}` : ''}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Set atual</h2>
            {!activeSetlist ? (
              <p>Crie ou selecione um repertorio.</p>
            ) : (
              <>
                <div className="row-actions">
                  <button
                    type="button"
                    onClick={() => openStageMode(0)}
                    disabled={activeSetlist.items.length === 0}
                  >
                    Abrir modo palco
                  </button>
                  <p className="muted">No modo palco, os controles de configuracao ficam ocultos.</p>
                </div>

                <form className="form-inline" onSubmit={handleRenameSetlist}>
                  <input
                    value={editSetlistName}
                    onChange={(event) => setEditSetlistName(event.target.value)}
                    required
                  />
                  <button disabled={isSaving}>Salvar nome</button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={handleDeleteSetlist}
                    disabled={isSaving || !isOnline}
                  >
                    Excluir
                  </button>
                </form>

                <p className="muted">Selecione as musicas no painel "Musicas" e use "Adicionar selecionadas ao set atual".</p>

                <ol className="ordered-list">
                  {activeSetlist.items.map((item, index) => (
                    <li key={item.id}>
                      <span>
                        {item.song.title}
                        {item.song.artist ? ` - ${item.song.artist}` : ''}
                      </span>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={isSaving || index === 0}
                          onClick={() => handleMoveItem(item.id, -1)}
                        >
                          Subir
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={isSaving || index === activeSetlist.items.length - 1}
                          onClick={() => handleMoveItem(item.id, 1)}
                        >
                          Descer
                        </button>
                        <button
                          type="button"
                          onClick={() => openStageMode(index)}
                          disabled={isSaving}
                        >
                          Tocar agora
                        </button>
                        <button
                          type="button"
                          className="button-danger"
                          disabled={isSaving}
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>

                <hr />
                <h2>Pedidos do publico</h2>
                {audienceLink ? (
                  <>
                    <p>Compartilhe este link/QR com o publico:</p>
                    <div className="form-inline">
                      <input value={audienceLink.public_url} readOnly />
                      <button type="button" className="button-secondary" onClick={handleCopyPublicLink}>
                        Copiar
                      </button>
                    </div>
                    {audienceQrCodeUrl ? (
                      <div className="qr-block">
                        <img className="qr-image" src={audienceQrCodeUrl} alt="QR Code para pedidos do publico" />
                        <a className="stage-link-button" href={audienceQrCodeUrl} target="_blank" rel="noreferrer">
                          Abrir QR em tela cheia
                        </a>
                      </div>
                    ) : null}
                    <p>
                      Conexao em tempo real:{' '}
                      {queueConnectionStatus === 'connected'
                        ? 'conectada'
                        : queueConnectionStatus === 'reconnecting'
                          ? 'reconectando'
                          : queueConnectionStatus}
                    </p>
                  </>
                ) : null}

                <p>Fila atual: {requestQueue.length} pedido(s).</p>
                <ul className="list compact">
                  {requestQueue.map((request) => (
                    <li key={request.id}>
                      <strong>{request.requested_song_name || request.song?.title || 'Musica nao informada'}</strong>
                      {request.song?.artist ? ` - ${request.song.artist}` : ''}
                      {request.requester_name ? ` (por ${request.requester_name})` : ''}
                      <div className="row-actions">
                        <a
                          href={buildChordSearchUrl(buildRequestSearchPayload(request))}
                          target="_blank"
                          rel="noreferrer"
                          className="stage-link-button"
                        >
                          Cifra
                        </a>
                        <a
                          href={buildLyricsSearchUrl(buildRequestSearchPayload(request))}
                          target="_blank"
                          rel="noreferrer"
                          className="stage-link-button"
                        >
                          Letra
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
