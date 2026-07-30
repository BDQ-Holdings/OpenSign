# Railway deployment

The BDQ deployment uses four Railway services in one private environment:

- `gateway`: the only public service; owns `sign.bdqholdings.com`.
- `web`: the OpenSign browser application on private port 3000.
- `api`: the OpenSign/Parse server on private port 8080.
- `MongoDB`: Railway's authenticated MongoDB service with persistent storage.

The gateway keeps the browser and API on one public origin. This is important
because OpenSign derives some signer links from the API request host.

## Build configuration

Each source service uses the repository root as its build context and sets a
service-specific `RAILWAY_DOCKERFILE_PATH`:

| Service | Dockerfile path |
| --- | --- |
| `gateway` | `infra/railway/gateway/Dockerfile` |
| `web` | `infra/railway/client/Dockerfile` |
| `api` | `infra/railway/server/Dockerfile` |

Deploy the `production` branch. It is pinned to a reviewed upstream OpenSign
release instead of following upstream's moving `staging` branch.

## Runtime configuration

`web`:

```env
PORT=3000
NODE_ENV=production
PUBLIC_URL=https://sign.bdqholdings.com
REACT_APP_SERVERURL=https://sign.bdqholdings.com/api/app
GENERATE_SOURCEMAP=false
```

`api`:

```env
PORT=8080
NODE_ENV=production
APP_ID=opensign
PARSE_MOUNT=/app
PUBLIC_URL=https://sign.bdqholdings.com
SERVER_URL=https://sign.bdqholdings.com/api/app
USE_LOCAL=true
SMTP_ENABLE=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=signatures@bdqholdings.com
SMTP_USER_EMAIL=signatures@bdqholdings.com
```

Set `MASTER_KEY`, `MONGODB_URI`, `SMTP_PASS`, `PFX_BASE64`, and `PASS_PHRASE`
as Railway secrets. Never commit their values.

Attach the API upload volume at `/usr/src/app/files/files`. Mounting the parent
`/usr/src/app/files` directory would hide the email templates included in the
image. The volume makes the API a single-replica service; move document storage
to a tested S3-compatible object store before horizontal scaling.

## Public routing

The gateway strips `/api` before forwarding to the Parse server:

```text
https://sign.bdqholdings.com/api/app/* -> api.railway.internal:8080/app/*
https://sign.bdqholdings.com/*         -> web.railway.internal:3000/*
```

Railway terminates origin TLS. Cloudflare provides public DNS, TLS, and edge
security for `sign.bdqholdings.com`.
