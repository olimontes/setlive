# Semana 1 - Entrega implementada

Este documento lista como executar e validar o que foi entregue na Semana 1.

## Backend (Django)

### Setup

1. `cd backend`
2. `python -m venv .venv`
3. `./.venv/Scripts/Activate.ps1`
4. `pip install -r requirements.txt`
5. Copie `.env.example` para `.env` e ajuste se necessário.
6. Suba o banco: `docker compose up -d`
7. Rode migrations: `python manage.py migrate`
8. Inicie API: `python manage.py runserver`

### Endpoints

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`
- `POST /api/auth/logout/`

## Frontend (React)

### Setup

1. `cd mobile`
2. `npm install`
3. `npm run dev`

## Critérios de aceite (Semana 1)

- Criar conta via `register` retorna tokens JWT.
- Login via `login` retorna tokens JWT.
- App salva tokens localmente e restaura sessão ao abrir.
- `GET /me` valida sessão ativa.
