# Operacao de Baixo Custo - SetLive

Este documento registra as mudancas implementadas para manter o SetLive no ar com baixo custo, preservando o fluxo principal do produto para musicos: organizar repertorio, modo palco e receber pedidos do publico.

## Objetivo

- Reduzir custo e complexidade operacional sem quebrar o fluxo de pedidos do publico.
- Priorizar previsibilidade de operacao em ambiente pequeno (MVP/early stage).

## Decisoes aplicadas

### 1) Estrategia unica para fila de pedidos: polling

- Decisao: remover uso ativo de WebSocket no app e manter atualizacao da fila via polling.
- Motivo: operacao mais simples e barata em infra pequena, menos moving parts.
- Impacto no produto: o musico continua recebendo pedidos; a atualizacao ocorre em intervalos curtos em vez de push.

Arquivos alterados:
- `mobile/src/pages/HomePage.jsx`
- `backend/apps/repertoire/views.py`

### 1.1) Polling otimizado para reduzir custo de rede

- Decisao: usar validacao condicional com `ETag/If-None-Match` no endpoint da fila.
- Motivo: quando nao ha mudanca, retornar `304 Not Modified` sem payload.
- Impacto no produto: comportamento igual para o musico, com menor trafego por ciclo de polling.

Arquivos alterados:
- `backend/apps/repertoire/views.py`
- `mobile/src/services/setlistApi.js`

### 1.2) Retry com backoff no polling da fila

- Decisao: trocar polling com `setInterval` fixo por loop com `setTimeout` e backoff exponencial em falhas.
- Motivo: evitar tempestade de requests em instabilidade de rede e reduzir custo em cenarios degradados.
- Parametros: intervalo base de 10s e teto de backoff de 60s.

Arquivo alterado:
- `mobile/src/pages/HomePage.jsx`

### 2) Simplificacao de runtime do backend

- Decisao: trocar servidor `daphne` por `gunicorn` (WSGI).
- Motivo: reduzir dependencia e complexidade de operacao para workload HTTP.
- Impacto: deploy mais simples e previsivel.

Arquivos alterados:
- `backend/entrypoint.sh`
- `backend/requirements.txt`
- `docs/WEEK8_DEPLOY.md`

### 3) Fail-fast de configuracao de ambiente

- Decisao: exigir `DJANGO_SETTINGS_MODULE` explicito em `wsgi.py` e `asgi.py`.
- Motivo: evitar subir em `dev` por acidente em producao.
- Impacto: erro explicito em boot quando configuracao estiver incompleta.

Arquivos alterados:
- `backend/config/wsgi.py`
- `backend/config/asgi.py`

### 4) Remocao de configuracao ociosa de Channels no settings base

- Decisao: remover `channels` de `INSTALLED_APPS`, `ASGI_APPLICATION` e `CHANNEL_LAYERS` do settings base.
- Motivo: alinhar configuracao com estrategia de polling + runtime HTTP.

Arquivo alterado:
- `backend/config/settings/base.py`

## O que nao foi automatizado no codigo (acao de infraestrutura)

1. Banco gerenciado (PostgreSQL managed service)
- Recomendacao para reduzir risco operacional (backup, recovery, manutencao).
- Exige decisao de provedor/plano fora do repositorio.

2. Cache compartilhado (Redis) para multiplas instancias
- So necessario quando houver horizontal scaling e necessidade de rate-limit consistente entre replicas.

## Decisoes tomadas nesta fase (registro consolidado)

1. Manter fila de pedidos com polling, sem WebSocket ativo no app.
2. Ajustar polling para 10 segundos (reduzindo volume de requests).
3. Manter refresh manual da fila via botao "Atualizar fila".
4. Implementar `ETag/If-None-Match` + `304 Not Modified` no endpoint da fila.
5. Implementar cache em memoria no frontend para reaproveitar payload quando vier `304`.
6. Implementar backoff exponencial no polling em caso de falha (base 10s, teto 60s).
7. Simplificar runtime backend para `gunicorn` (WSGI), removendo dependencia operacional de `daphne`/Channels no fluxo ativo.
8. Exigir `DJANGO_SETTINGS_MODULE` explicito para evitar boot acidental com config `dev`.
9. Validar healthcheck em producao com banco gerenciado conectado (`status: ok`, `database: ok`).
10. Adiar implementacao de Redis por decisao do produto neste momento.

## Status atual

- Implementado em codigo: itens 1 a 8.
- Validado: healthcheck de producao com banco ok.
- Adiado: Redis/cache compartilhado.

## Risco e trade-off aceitos

- A fila nao e push em tempo real; depende de intervalo de polling.
- Em troca, a operacao fica mais barata e com menos pontos de falha.

## Rollback rapido

Se precisar voltar para abordagem com push:
- restaurar codigo de WebSocket no frontend (`HomePage.jsx`);
- restaurar emissao de evento no backend (`PublicAudienceRequestCreateView`);
- voltar runtime ASGI (`daphne`) e reintroduzir configuracao de Channels.
