# AfiyaRef production deployment (single VPS)

## 1. Prepare the server

- Ubuntu 22.04+ VPS with Docker + Compose plugin.
- DNS: point `api.afiyaref.ng` (or your domain) at the server. Update `deploy/Caddyfile` to match.

## 2. Configure secrets

```bash
cp .env.example .env.prod
# fill in: POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET (openssl rand -hex 32),
# WHATSAPP_VERIFY_TOKEN, ADMIN_API_KEY (openssl rand -hex 24),
# OPENAI_API_KEY, WHATSAPP_* (after Meta setup), TERMII_* (for live SMS)
export $(cat .env.prod | xargs)   # compose reads these for ${...} interpolation
```

## 3. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
# wait ~15s, then:
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U ${POSTGRES_USER:-afiyaref} -d ${POSTGRES_DB:-afiyaref} \
  < prisma/postgis-init.sql  # from your local checkout, or docker cp it in
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

Seed facilities (from local machine against the server DB, or copy the JSON in):

```bash
DATABASE_URL="postgresql://user:pass@SERVER:5432/afiyaref?schema=public" npm run db:import
```

## 4. Verify

```bash
curl https://api.afiyaref.ng/health
curl https://api.afiyaref.ng/api/nurse/status
```

## 5. WhatsApp cutover (ngrok → production)

1. Meta App dashboard → WhatsApp → Configuration → replace the ngrok callback URL with `https://api.afiyaref.ng/whatsapp/webhook` (same verify token).
2. Set `WHATSAPP_DRY_RUN` unset / `0` (prod compose never sets it, so Meta sends are live once tokens are configured).
3. Send a test message; check `docker compose logs api`.

## 6. Mobile app pointing at production

`mobile/app.json` → `extra.apiUrl`: `https://api.afiyaref.ng`, then `npx expo start` / EAS build.

## Notes

- DB/Redis expose no host ports in prod; reach them via `docker compose exec`.
- Back up `pgdata` volume regularly (`pg_dump` via exec).
- Rotate `ADMIN_API_KEY` and share it with facilities out-of-band (portal login).
