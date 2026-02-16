# SetLive Frontend

Base React para o MVP com foco nas Semanas 1, 2 e 3:
- autenticacao (login/cadastro)
- gestao de musicas e repertorios
- ordenacao persistida das musicas no set
- conexao com Spotify via OAuth
- importacao de playlist Spotify para repertorio

## Executar

1. `cd mobile`
2. `npm install`
3. `npm run dev`

## Configuracao

A API base fica em `src/config/api.js`.
Para trocar endpoint sem alterar codigo, use `VITE_API_ROOT` (exemplo: `http://localhost:8000/api`).

Para OAuth Spotify local, o frontend usa `window.location.origin/callback`.
Configure no Spotify Dashboard um redirect exatamente igual ao endereco que voce abre no navegador, por exemplo:
- `http://127.0.0.1:5173/callback`

Opcionalmente, fixe o redirect no frontend via:
- `VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback`
