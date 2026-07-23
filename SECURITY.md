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
