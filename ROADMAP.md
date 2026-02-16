# Roadmap do MVP - SetLive (8 semanas)

Este roadmap transforma a visão do `README.md` em execução objetiva para concluir o MVP.

## Objetivo do MVP

Entregar um app funcional para músicos com:
- autenticação (e-mail e Spotify)
- criação e gestão de repertórios
- importação de playlists do Spotify (metadados)
- pedidos do público via QR Code em tempo real
- modo palco
- funcionamento offline básico (cache)

## Premissas

- Time: 1 desenvolvedor (solo)
- Stack: Flutter + Django + PostgreSQL + WebSocket
- Ritmo: 8 semanas com foco em entrega contínua

## Definição de pronto (MVP)

O MVP estará pronto quando:
- usuário consegue cadastrar/login e acessar sua conta
- usuário cria, edita e ordena repertório com músicas
- usuário importa playlist do Spotify e converte para repertório
- público envia pedido por QR e o músico recebe em tempo real
- músico abre modo palco com leitura clara de cifra/letra/link
- app funciona com dados essenciais offline
- fluxo principal foi testado ponta a ponta em ambiente de produção

## Roadmap por semana

## Semana 1 - Fundação técnica

Entregas:
- estrutura inicial do backend Django (apps, settings por ambiente)
- banco PostgreSQL configurado com migrations iniciais
- projeto react base com arquitetura definida (camadas e estado)
- autenticação por e-mail (registro/login/logout) no backend
- tela inicial de autenticação no app

Critérios de aceite:
- usuário cria conta e faz login sem erro
- sessão persiste corretamente no app

## Semana 2 - Modelagem de repertórios

Entregas:
- modelos: `User`, `Song`, `Setlist`, `SetlistItem`
- CRUD de repertório (criar, listar, editar, remover)
- adição manual de músicas
- ordenação de músicas no repertório
- primeiras telas de gerenciamento no Flutter

Critérios de aceite:
- usuário consegue montar repertório completo no app
- ordem das músicas é salva e recuperada corretamente

## Semana 3 - Integração Spotify (OAuth + importação)

Entregas:
- login com Spotify (OAuth)
- conexão de conta Spotify ao usuário
- listagem de playlists do usuário
- importação de metadados para repertório (nome, artista, duração)

Critérios de aceite:
- usuário conecta Spotify e importa uma playlist real
- músicas importadas aparecem no repertório sem duplicação indevida

## Semana 4 - Pedidos do público (tempo real)

Entregas:
- geração de link/QR por repertório ativo
- endpoint público para envio de pedidos
- canal WebSocket para atualização em tempo real
- tela do músico com fila de pedidos
- regras básicas anti-spam (limite por IP/sessão)

Critérios de aceite:
- pedido enviado por celular do público aparece em segundos no app do músico
- fila mantém estado consistente após reconexão

## Semana 5 - Modo palco

Entregas:
- tela de modo palco com fonte grande e alto contraste
- navegação rápida entre músicas do repertório
- exibição de links de cifra/letra
- bloqueio de elementos que distraem durante execução

Critérios de aceite:
- músico consegue conduzir set sem voltar para telas de configuração
- leitura em palco é confortável em celular e tablet

## Semana 6 - Offline e resiliência

Entregas:
- cache local de repertórios e músicas acessadas
- fila local para ações pendentes (sync quando voltar internet)
- tratamento de estado offline/online na UI
- estratégia de conflitos simples (última edição válida com aviso)

Critérios de aceite:
- usuário abre repertório sem internet
- alterações feitas offline sincronizam ao reconectar

## Semana 7 - Qualidade e hardening

Entregas:
- testes principais backend (auth, repertório, pedidos)
- testes principais frontend (fluxos críticos)
- observabilidade mínima (logs, erros, métricas básicas)
- revisão de segurança básica (tokens, permissões, rate limit)

Critérios de aceite:
- fluxos críticos passam em testes automatizados
- nenhum bug bloqueante aberto

## Semana 8 - Deploy e validação com usuários

Entregas:
- deploy backend + banco em cloud
- build distribuível do app (beta)
- checklist final de produção
- teste com músicos reais (5 a 10 usuários)
- consolidação de feedback e backlog pós-MVP

Critérios de aceite:
- ambiente estável com uso real
- feedback coletado e priorizado para próxima fase

## Backlog pós-MVP (fora do escopo atual)

- IA para sugestão de repertório
- estatísticas avançadas de performance e pedidos
- modo banda sincronizada
- marketplace
- pagamentos

## Riscos e mitigação

- Integração Spotify atrasar: priorizar importação manual + integração incremental
- Tempo real instável: implementar fallback com polling curto
- Sobrecarga solo dev: limitar escopo estritamente ao fluxo crítico
- Offline complexo: começar com cache de leitura e evoluir para sync completo

## Indicadores de sucesso

- tempo para criar repertório < 5 minutos
- latência de pedido em tempo real < 3 segundos
- taxa de erro em login/importação < 2%
- pelo menos 70% dos testers concluem um set completo sem suporte

## Próximo passo imediato

Iniciar Semana 1 com entregáveis quebrados em tarefas diárias e board Kanban (`Todo`, `Doing`, `Done`).
