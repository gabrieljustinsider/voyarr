---
description: Universal Identity & Security Schema Requirements
---

# User Management & Identity Federation

This Standard Operating Procedure (SOP) governs how user accounts, primary identifiers, and third-party social integrations are managed across all GameProductions networked applications (Ledger, Foundation, GloBot, etc).

## 1. Primary Identifiers 
Every networked application must support direct, explicit modification of a user's core attributes globally. This applies strict separation of concerns from third-party OAuth inputs.

### Modifiable Core Properties:
- **Username**: Must support alphanumeric aliases, validated strictly for global uniqueness.
- **Primary Email**: Serves as the master fallback for password resets and multi-tenant notifications. Guaranteed uniqueness.
- **Display Name**: Freely mutable alias for non-unique display purposes.
- **Avatar URI**: Remote URL pointing to a federated image asset.
- **Security Options & Passkeys**: Users must be able to rename or revoke security hardware keys unrestrictedly.

## 2. Strict ID Substitution
Primary database identity constraints (`email`, `username`) **MUST** be verified safely at the application routing layer.
Developers must NEVER allow the underlying `SQLITE_CONSTRAINT` exceptions to surface. Endpoints (e.g., `PATCH /profile`) must gracefully intercept duplicate inputs and return an `HTTP 409 Conflict` structured error to maintain UI robustness.

## 3. Social Integration Principles
External provider accounts (e.g., Google, Discord, Dropbox) exist strictly as associative authentication delegates.

### Rules of Association
> [!IMPORTANT]
> The email address associated with a linked account is saved strictly for structural record-keeping. Under absolutely no circumstance will linking a social provider passively overwrite or modify the user's primary account email structure.

### Avatar & Data Synchronization
Users **MUST** be given an explicit choice to synchronize profile metadata from third-party delegates.
- A dedicated endpoint (`POST /profile/sync`) must be universally implemented to execute manual inheritance.
- If a user wishes to align their primary avatar with their Discord avatar, they explicitly invoke this synchronization function. Federated identity attributes must never automatically bleed into the local user space without user authorization.
