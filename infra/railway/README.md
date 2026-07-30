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
SMTP_ENABLE=false
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USERNAME=resend
SMTP_USER_EMAIL=signatures@bdqholdings.com
```

Set `MASTER_KEY`, `MONGODB_URI`, `PFX_BASE64`, `PASS_PHRASE`, and
`ADMIN_BOOTSTRAP_TOKEN` as secrets on the Railway `api` service. Store a
dedicated, send-only Resend API key in `SMTP_PASS`, then set
`SMTP_ENABLE=true`. Never commit secret values.

## Initial administrator setup

1. Generate a unique, high-entropy setup token and add it as the secret
   `ADMIN_BOOTSTRAP_TOKEN` on the Railway `api` service. Do not add it to the
   `web` service, a `REACT_APP_*` or `VITE_*` variable, or any public runtime
   configuration.
2. Redeploy the API, open `https://sign.bdqholdings.com/addadmin`, and enter the
   same token in the **Administrator setup token** field along with the first
   administrator's details.
3. Confirm that the new administrator can sign in and reach the dashboard.
4. Delete `ADMIN_BOOTSTRAP_TOKEN` from the API service and redeploy it. Create a
   new token rather than restoring the old value if bootstrap access is ever
   deliberately reopened.

The browser validates the token with the API before it creates the Parse user,
which prevents a typo from leaving an orphaned account. The `addadmin` Cloud
Function validates the token again and also requires the authenticated user,
matching email address, and absence of an existing active administrator. The
server checks remain the authorization boundary.

The bootstrap `PFX_BASE64` certificate is private and self-signed. Replace it
with an organization-controlled certificate from a trusted PDF-signing
provider if Adobe trust-chain validation is required.

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
