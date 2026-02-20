# Decisoes Tecnicas do Projeto (Semanas 1 a 7)

Este documento consolida as principais decisoes tecnicas tomadas durante a execucao do roadmap do MVP do SetLive, da Semana 1 ate a Semana 7.

## Visao Geral de Arquitetura

- Backend: Django + Django REST Framework
- Autenticacao: JWT (SimpleJWT)
- Banco: PostgreSQL (docker-compose para ambiente local)
- Frontend: React + Vite (SPA)
- Tempo real: Django Channels com WebSocket autenticado por JWT
- Offline no frontend: cache local + fila de mutacoes pendentes

## Decisoes Transversais

- Priorizar entrega incremental por semana, com escopo estrito do fluxo critico.
- Usar API REST para CRUD e WebSocket somente para eventos de pedidos em tempo real.
- Manter o frontend sem dependencia pesada de estado global; logica concentrada na tela principal (`HomePage`).
- Guardar tokens no `localStorage` para simplicidade do MVP (com revisao futura de seguranca para producao).
- Adotar estrategia de degradacao graciosa: quando offline, operar com snapshot local e sincronizar ao reconectar.

## Semana 1 - Fundacao Tecnica

### Decisoes

- Separar backend e frontend em pastas distintas (`backend/`, `mobile/`) para isolamento de stack e deploy.
- Estruturar settings Django por ambiente (`base/dev/prod`) desde o inicio.
- Definir fluxo de auth com JWT via endpoints dedicados (`register`, `login`, `refresh`, `me`, `logout`).
- Iniciar com PostgreSQL como banco principal para alinhamento com ambiente de producao.

### Trade-offs

- JWT em `localStorage` e mais simples de implementar, mas menos robusto que cookie httpOnly contra XSS.
- A complexidade inicial do projeto aumentou com separacao de ambientes, em troca de melhor manutencao.

## Semana 2 - Modelagem de Repertorios

### Decisoes

- Modelar dominio com entidades centrais: `Song`, `Setlist`, `SetlistItem` e ownership por usuario.
- Salvar ordem do set por campo de posicao em `SetlistItem`.
- Proteger CRUD por filtro de ownership (`setlist__user=request.user`).

### Trade-offs

- Reordenacao por posicao exige cuidado em atualizacoes atomicas.
- Estrutura relacional ficou mais verbosa, mas facilitou integridade de dados e permissao por usuario.

## Semana 3 - Integracao Spotify

### Decisoes

- Implementar OAuth Spotify no backend para evitar expor segredo no frontend.
- Persistir conexao Spotify por usuario (`SpotifyConnection`).
- Importar playlist como metadados para `Song`/`Setlist` reaproveitando musicas existentes por `spotify_track_id`.

### Trade-offs

- Integracao externa adicionou pontos de falha (token expirado, rate-limit da API do Spotify).
- Fluxo OAuth no frontend requer tratamento de callback e idempotencia de troca de codigo.

## Semana 4 - Pedidos do Publico em Tempo Real

### Decisoes

- Criar `SetlistPublicLink` com token para compartilhamento do link publico.
- Separar endpoint publico para pedidos (`/public/setlists/<token>/requests/`).
- Publicar eventos de fila via Channels em grupo por setlist.
- Aplicar anti-spam por janela curta e longa usando cache (`SHORT_RATE_WINDOW_SECONDS`, `LONG_RATE_MAX_REQUESTS`).

### Trade-offs

- Rate limit por IP/sessao e simples e barato, mas nao cobre todos os cenarios de abuso.
- Token em URL publica e pratico para QR, mas exige cuidado com revogacao/rotacao futura.

## Semana 5 - Modo Palco

### Decisoes

- Criar modo de execucao dedicado, ocultando configuracoes para reduzir distracao.
- Navegacao rapida entre musicas (anterior/proxima, pulo direto, atalho de teclado).
- Exibir links de cifra/letra com foco em leitura e operacao durante apresentacao.

### Trade-offs

- Centralizar muita logica no `HomePage` acelerou entrega, mas aumentou tamanho do componente.
- Busca de cifra/letra via URL externa e simples, sem garantia de resultado perfeito.

## Semana 6 - Offline e Resiliencia

### Decisoes

- Criar snapshot local (`offlineStorage`) com musicas, repertorios e detalhes do set ativo.
- Introduzir fila de mutacoes pendentes em `localStorage` para sincronizar ao reconectar.
- Implementar sincronizacao automatica em evento `online` com opcao de sync manual.
- Cobrir mutacoes criticas offline: criar musica, criar repertorio, renomear, adicionar/remover/reordenar itens.

### Trade-offs

- Estrategia "last write wins" simplifica conflitos, mas pode sobrescrever mudancas concorrentes.
- Uso de IDs temporarios no frontend reduz bloqueio offline, mas aumenta complexidade da reconciliacao.

## Semana 7 - Qualidade e Hardening

### Decisoes

- Ampliar suite de testes backend para auth, permissoes e pedidos do publico.
- Adicionar testes frontend de fluxo critico de selecao em lote de musicas (Node test runner).
- Introduzir observabilidade minima no backend via middleware:
- `X-Request-Id`
- `X-Response-Time-ms`
- logs estruturados por request (`setlive.request`)
- Revisar seguranca basica:
- default de `SECRET_KEY` com comprimento seguro para JWT HMAC
- reforco de testes de permissao cross-user
- validacao do rate-limit no endpoint publico

### Trade-offs

- Observabilidade minima nao substitui APM (nao ha tracing distribuido nem dashboard de metricas).
- Testes frontend atuais focam utilitarios e fluxo critico de selecao; nao ha E2E ainda.

## Ajustes de UX e Produto Decorrentes

- Link publico ajustado para usar base do frontend (`FRONTEND_PUBLIC_URL`) em vez da porta do backend.
- Pagina publica de pedidos alterada para texto livre (`song_name`) sem expor repertorio ao publico.
- Inclusao de QR Code para divulgacao do link publico.
- Biblioteca de musicas evoluida para busca/paginacao server-side e selecao em lote.
- Reestilizacao completa de UI para visual unificado dark/radiante.

## Riscos Tecnicos Atuais

- `HomePage.jsx` concentra alta complexidade de estado e fluxo.
- Estrategia offline ainda pode ter conflitos em cenarios multi-dispositivo.
- Ausencia de testes E2E de ponta a ponta (browser + backend + websocket).
- JWT em `localStorage` permanece um compromisso de MVP.

## Divida Tecnica Mapeada

- Extrair dominio de offline/sync de `HomePage` para hooks/servicos dedicados.
- Introduzir camada de estado previsivel (ex.: reducer por dominio).
- Criar suite E2E para login, montagem de set, pedido publico, modo palco e fluxo offline.
- Evoluir observabilidade com agregacao de logs e metricas em ambiente cloud.

## Estado ao Final da Semana 7

- Fluxos criticos possuem cobertura automatizada backend e frontend.
- Nao ha bug bloqueante aberto identificado na validacao executada.
- Projeto pronto para foco de deploy e validacao com usuarios reais na Semana 8.

## Atualizacao Pos-Semana 8 - Operacao de Baixo Custo

- Padronizada atualizacao da fila de pedidos do publico por polling no frontend.
- Runtime do backend simplificado para `gunicorn` (WSGI).
- Configuracao de ambiente endurecida com fail-fast para `DJANGO_SETTINGS_MODULE`.
- Registro detalhado em `docs/LOW_COST_OPERATION_DECISIONS.md`.
