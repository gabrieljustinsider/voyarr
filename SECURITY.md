# Security Policy

## Supported Versions

Voyarr provides security updates for the current major and minor release versions.

| Version | Supported          |
| ------- | ------------------ |
| 1.13.x  | :white_check_mark: |
| 1.12.x  | :white_check_mark: |
| 1.8.x   | :white_check_mark: |
| < 1.8   | :x:                |

## Architecture Security

Voyarr handles sensitive credentials for third-party media providers and secures user authentication pools:
- **Database Encryption:** All provider passwords and proxy details are encrypted at rest in the PostgreSQL database using AES-256-GCM.
- **Password Manager Integrations:** Tokens for 1Password Connect and Bitwarden are encrypted identically to provider passwords.
- **Master Key:** A `MASTER_KEY` environment variable is required to start the application. This key is never stored in the database and resides only in RAM during runtime.
- **Secure String User IDs:** User profiles employ randomly generated, non-enumerable UUID identifiers prefixed with `"usr_"` (e.g., `usr_d1f3b8...`) rather than auto-incremented integer keys, preventing user scanning, enumeration, or ID harvesting.
- **Passwordless Passkeys (WebAuthn):** Natively supports enterprise-grade passwordless authentication using standard browser WebAuthn credentials. Fully integrated with standard browser dialogs and password managers (1Password, Bitwarden, Apple iCloud Keychain, Google Password Manager) using modern WebAuthn Conditional UI (autofill mediation).
- **Single Sign-On (SSO) Linking:** Users can link third-party identity providers (Google, GitHub, Discord) for secure fast-access OAuth login. Built-in lockout safeguards prevent unlinking an SSO provider if it is the user's last remaining authentication method.
- **User Authentication & RBAC:** Native user registration features a secure bootstrapping workflow. The very first registration request on a fresh database automatically creates an `"admin"` user. Thereafter, registration is completely locked down and requires either an Admin bearer token (JWT) or the `MASTER_KEY` passed via the `X-Voyarr-Api-Key` HTTP header.
- **CORS:** Cross-Origin Resource Sharing is restricted via the `CORS_ORIGINS` environment variable to prevent unauthorized web clients from interacting with your local API.
- **SSRF Protection:** All URL proxying and synchronization mechanisms rigorously evaluate hostnames and IP addresses to prevent Server-Side Request Forgery against internal infrastructure.

## Reporting a Vulnerability

If you discover a security vulnerability within Voyarr, please do not disclose it publicly. 

Instead, please send an email to the repository maintainers or open a private security advisory on GitHub if the repository settings allow it. We attempt to respond to all vulnerability reports within 48 hours.
