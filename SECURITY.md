# Security Policy

## Supported Versions

Voyarr provides security updates for the current release series. Older minor versions receive critical security patches only.

| Version | Supported |
|---------|-----------|
| 1.100.x | ✅ |
| 1.9x.x  | ✅ Critical fixes only |
| 1.7x.x  | ✅ Critical fixes only |
| < 1.70  | ❌ |

## Architecture Security

Voyarr handles sensitive credentials for third-party media providers and secures multi-user authentication:

- **Database Encryption**: All provider passwords, proxy details, and API credentials are encrypted at rest using **AES-256-GCM**. Encryption and decryption happen only at runtime using your `MASTER_KEY`, which is never stored in the database and resides only in RAM.
- **Password Manager Integrations**: Connection tokens for 1Password Connect and Bitwarden are encrypted identically to provider credentials via AES-256-GCM and stored in the secure Vault.
- **Master Key**: The `MASTER_KEY` environment variable is required to start the application. It is never written to disk by Voyarr and is rotatable independently of the database.
- **Secure User IDs**: User profiles use randomly generated, non-enumerable UUID identifiers prefixed with `usr_` (e.g., `usr_d1f3b8...`) rather than auto-incremented integer keys, preventing user enumeration, scanning, or ID harvesting.
- **Passkeys (WebAuthn)**: Full enterprise-grade passwordless authentication using browser WebAuthn credentials. Supports Conditional UI (autofill mediation) for seamless passkey discovery without username entry. Compatible with 1Password, Bitwarden, Apple iCloud Keychain, and Google Password Manager. Passkey registrations store only the cryptographic public key and AAGUID — no biometric data is ever transmitted or stored.
- **Single Sign-On (SSO) with Lockout Safeguard**: Users can link Google, GitHub, or Discord accounts for OAuth login. A lockout safeguard prevents unlinking an SSO provider if it is the user's only remaining authentication method.
- **OIDC Support**: Any OpenID Connect-compliant identity provider (Keycloak, Authentik, Azure AD, Okta) can be configured for auto-provisioning on first login.
- **Admin Bootstrap Lock**: The first registration on a fresh database creates an `admin` account. All subsequent registrations require a valid Admin JWT bearer token or the `MASTER_KEY` via the `X-Voyarr-Api-Key` HTTP header.
- **RBAC**: Three-tier role system (Admin, User, Viewer) enforced server-side on every API endpoint.
- **CORS**: Cross-Origin Resource Sharing is restricted via the `CORS_ORIGINS` environment variable. Wildcards are not permitted in production.
- **SSRF Protection**: All URL proxying and synchronization mechanisms rigorously evaluate hostnames and IP addresses against allowlists to prevent Server-Side Request Forgery against internal infrastructure.
- **Trusted Subnet Bypass**: Optional CIDR-based bypass for authenticated access from trusted local networks (must be explicitly configured; disabled by default).
- **Path Sanitization**: Backend file-serving endpoints normalize and validate paths to prevent directory traversal attacks. Stack traces are suppressed in all production API error responses.
- **autoComplete Attributes**: All authentication form fields carry correct `autocomplete` attribute values (`username webauthn`, `current-password`, `new-password`) to ensure browser password managers and passkey autofill work correctly and securely.
- **External API Keys**: Machine-generated API keys use high-entropy random tokens. Keys are shown once on creation and stored only as a hashed value.
- **VR Headset / DeoVR Device Pairing**: Temporary 6-digit numeric codes generated from the desktop Account Security panel for passwordless authentication on VR headsets. Codes are single-use, expire after 5 minutes, are stored in server memory only (not persisted to disk), and are cryptographically bound to the generating user's session. Authentication via a pairing code creates a standard JWT session indistinguishable from a password-based login. The legacy device pairing flow (headset displays a code, desktop approves it) also uses an in-memory store with the same expiry and single-use constraints.
- **DeoVR Native Sign-In**: The DeoVR scene feed endpoint (`POST /deovr`) accepts the same JWT-based authentication as the web application. Password verification uses the same Argon2 password hashing as the standard login endpoint. Pairing code authentication bypasses password entry entirely — the code is validated against the in-memory pairing store and a JWT is issued on success.

## Deployment & Secrets Workflow

Secrets are stored in 1Password and injected at deploy time. Never paste `op://` references or resolved secrets into the Portainer UI.

- `.env` (gitignored, mode `600`) — holds `op://` references (e.g. `DATABASE_URL=op://vault/item/field`), not literal secrets. Quotes around values are intentional: they protect `&`-containing URLs through the shell `eval`/`source` paths and are stripped by Docker Compose at runtime.
- `.env.portainer` (gitignored, mode `600`) — generated from `.env` with `op inject -i .env -o .env.portainer`; holds the *resolved* values used when (re)building the stack's environment in Portainer.
- Stack environment in Portainer is populated from the resolved `.env.portainer` via the repo's push script. Resolving references inside Portainer's editor (or pasting `.env` verbatim) fails with a 500 error.

### Pending Hardening Items (manual, require NAS access)

1. **Portainer is served over plaintext HTTP** at `http://10.0.0.32:9000`. Use `https://10.0.0.32:9443` and disable the HTTP port at the Portainer container level on the NAS.
2. **1Password Connect is served over plaintext HTTP** (`OP_CONNECT_HOST: http://10.0.0.32:32785`). Configure TLS on the Connect server and update the vault field accordingly.
3. **`CORS_ORIGINS` in production includes `http://localhost:3000`** (dev-only origin). Remove it from the production vault value once nothing local calls the API.

### Audit Trail

- All Dependabot alerts (52) are resolved or auto-dismissed; zero open.
- No real credentials are committed; git secret scans only match `${VAR:-default}` interpolation templates and placeholders.
- Shared Portainer API keys are revoked after use; never reuse a key shared in chat/shell history.

## Reporting a Vulnerability

If you discover a security vulnerability in Voyarr, **do not disclose it publicly**.

Please use one of the following responsible disclosure channels:

1. **GitHub Security Advisories**: Open a private security advisory on the repository (Settings → Security → Advisories).
2. **Direct contact**: Email the repository maintainers directly (listed in the GitHub profile).

We aim to acknowledge all vulnerability reports within **48 hours** and provide a remediation timeline within **7 business days**.

Please include:
- A description of the vulnerability and affected component
- Steps to reproduce (proof-of-concept if available)
- Potential impact assessment
- Any suggested mitigations
