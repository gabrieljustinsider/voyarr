# Security Policy

## Supported Versions

Voyarr provides security updates for the current major release version.

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:                |

## Architecture Security

Voyarr handles sensitive credentials for third-party media providers. 
- **Database Encryption:** All provider passwords are encrypted at rest in the PostgreSQL database using AES-256-GCM.
- **Master Key:** A `MASTER_KEY` environment variable is required to start the application. This key is never stored in the database and resides only in RAM during runtime.
- **CORS:** Cross-Origin Resource Sharing is restricted via the `CORS_ORIGINS` environment variable to prevent unauthorized web clients from interacting with your local API.

## Reporting a Vulnerability

If you discover a security vulnerability within Voyarr, please do not disclose it publicly. 

Instead, please send an email to the repository maintainers or open a private security advisory on GitHub if the repository settings allow it. We attempt to respond to all vulnerability reports within 48 hours.
