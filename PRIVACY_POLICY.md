# Privacy Policy for Voyarr

**Last Updated:** June 14, 2026

This Privacy Policy describes how your personal information is handled in the Voyarr software. As Voyarr is a self-hosted application, it's important to understand that we, the developers of Voyarr, do not collect or have access to your data. Your data remains on your own server.

## 1. The Self-Hosted Principle

Voyarr is designed to be run on your own hardware or a server you control. This means:

*   **We Do Not Collect Personal Information:** We do not collect, store, or process any of your personal information, media files, or metadata on our servers.
*   **You Are in Control:** You are the data controller for your instance of Voyarr. You are responsible for securing your server, your data, and access to your application.

## 2. Information Handled by the Software (On Your Server)

The Voyarr software, running on your server, stores and processes the following types of information:

*   **Provider Credentials:** Usernames, passwords, and API keys for third-party websites you configure. This information is always encrypted at rest in your database using AES-256-GCM. It can only be decrypted at runtime using your `MASTER_KEY`, which is stored only in your server's memory and is never saved to disk by Voyarr.
*   **Password Manager Tokens:** Connection tokens for 1Password and Bitwarden are similarly encrypted at rest via AES-256-GCM and stored in the secure Vault.
*   **User Accounts:** If you utilize the Multi-User RBAC system, hashed passwords for your created users are stored in the database.
*   **Configuration Data:** Settings, download rules, schedules, provider configurations, and other operational data are stored in your database.
*   **Media Metadata:** Information about media files, such as titles, performers, tags, and file hashes (ohash/phash), is stored in your database. This data is either generated from your local files, or securely collected from third-party sites at your explicit direction (via configured administrative scraping tools).
*   **Session & API Keys:** Session cookies for providers and API keys you generate for third-party access are stored in your database.

## 3. Browser Extension

The official Voyarr browser extension stores the following information in your browser's local storage, not on our servers:

*   **Your Voyarr API URL:** The address of your self-hosted Voyarr instance.
*   **Your Extension Secret Key:** The secret key required to authenticate the extension with your backend.

This information is used solely to connect the extension to your personal Voyarr instance.

## 4. Third-Party Services

When you configure Voyarr to interact with third-party services (such as media providers, StashDB, ThePornDB, etc.), Voyarr will send and receive information from these services as required for its operation. Your interaction with these services is subject to their respective privacy policies and terms of service.

## 5. Data Security

You are responsible for the security of the machine running Voyarr. We strongly recommend:

*   Using a strong, unique `MASTER_KEY` and `SECRET_KEY`.
*   Securing physical and network access to your server.
*   Keeping your operating system and all related software up to date.

## 6. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in the software's functionality. We will notify you of any changes by posting the new Privacy Policy in the project's repository.

## 7. Contact Us

If you have any questions about this Privacy Policy, please open an issue on our GitHub repository.