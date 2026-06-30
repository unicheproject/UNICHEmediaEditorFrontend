# UNICHE Media Editor — Frontend

Vue 3 + Vite + Pinia SPA for the UNICHE Media Editor. Talks to the Media Editor backend for project
data and to the UNICHE Catalogue (authorization authority) for the auth context and organisation
names.

## Develop

```bash
npm install
npm run dev        # http://localhost:5174
npm run typecheck
npm run build
```

## Authentication & runtime config

The app is a Keycloak public client (Authorization Code + PKCE, tokens in memory). Auth bootstraps
before mount (silent SSO); the app shows a sign-in gate until authenticated, then loads the
authorization context and the project picker.

Runtime config is injected via `window.__UNICHE_CONFIG__` (no rebuild per environment):

- **Dev:** `public/config.js` (committed, sensible localhost defaults).
- **Container:** regenerate `/config.js` from env at startup (mirror the Portal's
  `docker/docker-entrypoint.sh`). Keys: `IDP_URL`, `REALM`, `CLIENT_ID=media-editor-web`,
  `AUDIENCE=uniche-platform`, `CATALOGUE_URL`, `MEDIA_EDITOR_API_URL`.

**Invariant:** `IDP_URL` must equal the backend's `IDP_ISSUER_URI` and the browser-visible issuer,
or tokens are rejected.

## Layout of the auth pieces

- `src/platform/auth/` + `src/platform/authz/` — framework-free adapter lifted verbatim from the
  Portal (keycloak-js wrapper; the platform authorization rule + short-TTL `/me/authorization` cache).
- `src/stores/{auth,authz}.ts` — Pinia wrappers; `authz.managedOrganisations` drives the create
  dialog's org picker.
- `src/lib/api.ts` — backend client; injects the bearer and bounces to the IdP on 401. Asset bytes
  are fetched as authenticated blobs (`fetchAssetObjectUrl` / `useAssetObjectUrl` / `<AuthedMedia>`),
  since `GET /assets/{id}/download` now requires a token.
- `src/lib/catalogue.ts` — direct catalogue calls (auth context + org names).

See `../plans/media-editor-auth-and-sync.md` for the full design and the Phase 1/2 split.
