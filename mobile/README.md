# SetLive Frontend

Base React para o MVP com foco nas Semanas 1 e 2:
- fluxo de autenticacao (login/cadastro)
- armazenamento local de tokens
- restauracao de sessao ao abrir o app
- criacao de musicas
- criacao e edicao de repertorios
- ordenacao e remocao de musicas no repertorio

## Executar

1. `cd mobile`
2. `npm install`
3. `npm run dev`

## Configuracao

A URL da API esta em `src/config/api.js`.
Para trocar o endpoint sem editar codigo, use `VITE_API_ROOT` (exemplo: `http://localhost:8000/api`).
