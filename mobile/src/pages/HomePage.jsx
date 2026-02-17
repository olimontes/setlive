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
import { readTokens } from '../services/tokenStorage';

function toWebSocketBaseUrl() {
  if (API_ROOT.startsWith('https://')) {
    return API_ROOT.replace('https://', 'wss://').replace(/\/api$/, '');
  }
  return API_ROOT.replace('http://', 'ws://').replace(/\/api$/, '');
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
  const [selectedSongId, setSelectedSongId] = useState('');

  const [spotifyStatus, setSpotifyStatus] = useState({ connected: false });
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [selectedSpotifyPlaylistId, setSelectedSpotifyPlaylistId] = useState('');

  const [audienceLink, setAudienceLink] = useState(null);
  const [requestQueue, setRequestQueue] = useState([]);
  const [queueConnectionStatus, setQueueConnectionStatus] = useState('disconnected');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const queueSocketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const activeSetlistId = activeSetlist?.id ?? null;
  const spotifyRedirectUri = SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`;

  useEffect(() => {
    async function bootstrap() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        await handleSpotifyCallback();

        const [loadedSongs, loadedSetlists, status] = await Promise.all([
          listSongs(),
          listSetlists(),
          getSpotifyStatus(),
        ]);

        setSongs(loadedSongs);
        setSetlists(loadedSetlists);
        setSpotifyStatus(status);

        if (loadedSetlists.length > 0) {
          const detail = await getSetlist(loadedSetlists[0].id);
          setActiveSetlist(detail);
          setEditSetlistName(detail.name);
        }

        if (status.connected) {
          const playlistsPayload = await listSpotifyPlaylists();
          setSpotifyPlaylists(playlistsPayload.items ?? []);
        }
      } catch (error) {
        setErrorMessage(error.message || 'Falha ao carregar dados iniciais.');
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAudienceData(setlistId) {
      if (!setlistId) {
        setAudienceLink(null);
        setRequestQueue([]);
        setQueueConnectionStatus('disconnected');
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
  }, [activeSetlistId]);

  useEffect(() => {
    if (!activeSetlistId || !audienceLink?.token) {
      if (queueSocketRef.current) {
        queueSocketRef.current.close();
      }
      queueSocketRef.current = null;
      setQueueConnectionStatus('disconnected');
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
  }, [activeSetlistId, audienceLink?.token]);

  useEffect(() => {
    if (!activeSetlistId) {
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
  }, [activeSetlistId]);

  const songsNotInSetlist = useMemo(() => {
    if (!activeSetlist) {
      return songs;
    }

    const inSet = new Set(activeSetlist.items.map((item) => item.song.id));
    return songs.filter((song) => !inSet.has(song.id));
  }, [songs, activeSetlist]);

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

  async function refreshSongs() {
    const loadedSongs = await listSongs();
    setSongs(loadedSongs);
  }

  async function handleConnectSpotify() {
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

    if (!newSongTitle.trim()) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const created = await createSong({
        title: newSongTitle.trim(),
        artist: newSongArtist.trim(),
      });
      const nextSongs = [...songs, created].sort((a, b) => a.title.localeCompare(b.title));
      setSongs(nextSongs);
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

    if (!newSetlistName.trim()) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const created = await createSetlist({ name: newSetlistName.trim() });
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
      const detail = await getSetlist(setlistId);
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

    setIsSaving(true);
    setErrorMessage('');
    try {
      await updateSetlist(activeSetlistId, { name: editSetlistName.trim() });
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

  async function handleAddSongToSetlist(event) {
    event.preventDefault();

    if (!activeSetlistId || !selectedSongId) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await addSetlistItem(activeSetlistId, Number(selectedSongId));
      setSelectedSongId('');
      await refreshSetlists(activeSetlistId);
    } catch (error) {
      setErrorMessage(error.message || 'Falha ao adicionar musica ao repertorio.');
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

  if (isLoading) {
    return (
      <main className="shell">
        <section className="card">
          <p>Carregando dados...</p>
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
            <p>Semana 4: pedidos do publico em tempo real.</p>
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
            <button type="button" onClick={handleConnectSpotify} disabled={isSaving}>
              Conectar Spotify
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={handleRefreshSpotifyPlaylists}
              disabled={isSaving || !spotifyStatus.connected}
            >
              Atualizar playlists
            </button>
          </div>
          <form className="form-inline" onSubmit={handleImportSpotifyPlaylist}>
            <select
              value={selectedSpotifyPlaylistId}
              onChange={(event) => setSelectedSpotifyPlaylistId(event.target.value)}
              required
              disabled={!spotifyStatus.connected}
            >
              <option value="">Selecione uma playlist</option>
              {spotifyPlaylists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} ({playlist.tracks_total})
                </option>
              ))}
            </select>
            <button type="submit" disabled={isSaving || !selectedSpotifyPlaylistId}>
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

            <ul className="list compact">
              {songs.map((song) => (
                <li key={song.id}>
                  <span>
                    {song.title}
                    {song.artist ? ` - ${song.artist}` : ''}
                  </span>
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
                    disabled={isSaving}
                  >
                    Excluir
                  </button>
                </form>

                <form className="form-inline" onSubmit={handleAddSongToSetlist}>
                  <select
                    value={selectedSongId}
                    onChange={(event) => setSelectedSongId(event.target.value)}
                    required
                  >
                    <option value="">Selecione uma musica</option>
                    {songsNotInSetlist.map((song) => (
                      <option key={song.id} value={song.id}>
                        {song.title}
                        {song.artist ? ` - ${song.artist}` : ''}
                      </option>
                    ))}
                  </select>
                  <button disabled={isSaving || songsNotInSetlist.length === 0}>Adicionar ao set</button>
                </form>

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
