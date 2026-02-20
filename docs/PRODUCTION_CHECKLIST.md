# Checklist de Producao (MVP)

## Infra

- [ ] Variaveis de ambiente de producao configuradas (`.env.prod`)
- [ ] `DJANGO_SETTINGS_MODULE` definido explicitamente (`config.settings.prod`)
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` com dominio real
- [ ] Banco com backup automatizado
- [ ] Endpoint `/healthz/` respondendo com `ok`

## Seguranca

- [ ] `SECRET_KEY` forte (>= 32 chars)
- [ ] CORS restrito a dominios de frontend
- [ ] Credenciais Spotify em segredo seguro
- [ ] Revisao de permissoes em endpoints privados

## Qualidade

- [ ] Backend tests verdes (`manage.py test`)
- [ ] Frontend tests verdes (`npm run test`)
- [ ] Build frontend ok (`npm run build`)
- [ ] Sem erros bloqueantes abertos

## Operacao

- [ ] Logs coletados (request id + latencia)
- [ ] Runbook de rollback validado
- [ ] Responsavel de plantao definido para janela de beta
