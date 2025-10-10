import base64
import hashlib
import json
import secrets
import uuid

# AAGUID Metadata dictionary mapping standard authenticators
AAGUID_METADATA = {
    # Apple
    "dd25717e-f4e8-4d51-bf50-c8cd72ca5397": {
        "name": "iCloud Keychain",
        "provider": "Apple Inc.",
        "icon": "apple",
        "description": "Apple iCloud Keychain synchronized credential manager.",
    },
    "ad15717e-f4e8-4d51-bf50-c8cd72ca5397": {
        "name": "Apple Device Authenticator",
        "provider": "Apple Inc.",
        "icon": "apple",
        "description": "Apple hardware-bound local device biometric authenticator (Touch ID / Face ID).",
    },
    # Google
    "ea9b8d66-4d01-1d21-3f4b-8cef2a7e4b2d": {
        "name": "Google Password Manager",
        "provider": "Google LLC",
        "icon": "google",
        "description": "Google Password Manager cloud-synchronized passkey storage.",
    },
    "ad5698b0-8fcc-47e1-8848-038287d1591f": {
        "name": "Android Device Authenticator",
        "provider": "Google LLC",
        "icon": "google",
        "description": "Android hardware-bound biometric/PIN lock screen authenticator.",
    },
    # Yubico
    "cb69481e-8c17-43cf-9f70-d0047600011e": {
        "name": "YubiKey 5 Series",
        "provider": "Yubico AB",
        "icon": "yubico",
        "description": "YubiKey 5 NFC hardware security key.",
    },
    "0532244f-cb66-4b82-aa81-4340d87a4190": {
        "name": "YubiKey FIPS",
        "provider": "Yubico AB",
        "icon": "yubico",
        "description": "YubiKey FIPS series hardware token.",
    },
    # Windows Hello / Microsoft
    "6028b012-b13c-497f-aa92-f04b12345678": {
        "name": "Windows Hello",
        "provider": "Microsoft Corporation",
        "icon": "windows",
        "description": "Microsoft Windows Hello hardware-bound biometric or PIN authenticator.",
    },
    "ad5698b0-8fcc-47e1-8848-038287d15910": {
        "name": "Microsoft Authenticator",
        "provider": "Microsoft Corporation",
        "icon": "windows",
        "description": "Microsoft Authenticator mobile app synchronized credential store.",
    },
}

# Geolocation lookup for offline environments
MOCK_LOCATIONS = [
    "New York, NY, USA",
    "Los Angeles, CA, USA",
    "Chicago, IL, USA",
    "London, Greater London, UK",
    "Paris, Île-de-France, France",
    "Berlin, Brandenburg, Germany",
    "Tokyo, Kanto, Japan",
    "Sydney, NSW, Australia",
    "Toronto, ON, Canada",
    "Singapore, SG",
]


def resolve_ip_location(ip_address: str) -> str:
    """Deterministically maps any IP to a premium mock offline location."""
    if not ip_address or ip_address in ("127.0.0.1", "localhost", "::1"):
        return "Local Host (Development)"
    
    # Hash the IP deterministically to select a location
    ip_hash = int(hashlib.md5(ip_address.encode()).hexdigest(), 16)
    idx = ip_hash % len(MOCK_LOCATIONS)
    return MOCK_LOCATIONS[idx]


def generate_registration_options(user_id: str, username: str) -> dict:
    """Generates options for navigator.credentials.create in frontend."""
    challenge = base64.b64encode(secrets.token_bytes(32)).decode("utf-8").replace("=", "")
    
    return {
        "challenge": challenge,
        "rp": {
            "name": "Voyarr Media Server",
            "id": "localhost",
        },
        "user": {
            "id": user_id,
            "name": username,
            "displayName": username.capitalize(),
        },
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},    # ES256
            {"type": "public-key", "alg": -257},  # RS256
        ],
        "timeout": 60000,
        "authenticatorSelection": {
            "authenticatorAttachment": "cross-platform",
            "residentKey": "required",
            "userVerification": "preferred",
        },
        "attestation": "none",
    }


def generate_assertion_options(allowed_credentials: list) -> dict:
    """Generates options for navigator.credentials.get in frontend."""
    challenge = base64.b64encode(secrets.token_bytes(32)).decode("utf-8").replace("=", "")
    
    return {
        "challenge": challenge,
        "timeout": 60000,
        "rpId": "localhost",
        "allowCredentials": [
            {"type": "public-key", "id": cred_id} for cred_id in allowed_credentials
        ],
        "userVerification": "preferred",
    }


def verify_client_data_challenge(client_data_json_b64: str, expected_challenge: str) -> bool:
    """Decodes clientDataJSON and verifies that the challenge matches."""
    try:
        # Pad base64 standardly
        padded = client_data_json_b64 + "=" * (-len(client_data_json_b64) % 4)
        decoded_bytes = base64.b64decode(padded)
        client_data = json.loads(decoded_bytes.decode("utf-8"))
        
        client_challenge = client_data.get("challenge")
        # Remove padding from challenges during comparison if needed
        clean_expected = expected_challenge.replace("=", "")
        clean_client = client_challenge.replace("=", "")
        
        return clean_expected == clean_client
    except Exception:
        return False


def get_aaguid_metadata(aaguid: str) -> dict:
    """Resolves standard brand name, provider, and icon SVGs from aaguid."""
    if not aaguid:
        return {
            "name": "Generic Authenticator",
            "provider": "Unknown Manufacturer",
            "icon": "key",
            "description": "Standard hardware security token or platform authenticator.",
        }
    
    clean_guid = aaguid.lower().strip()
    return AAGUID_METADATA.get(
        clean_guid,
        {
            "name": "Universal Passkey Token",
            "provider": "FIDO Alliance",
            "icon": "key",
            "description": f"Standard compliant FIDO2 credential. AAGUID: {clean_guid}",
        },
    )


def verify_assertion_signature(
    public_key_der_b64: str,
    authenticator_data_b64: str,
    client_data_json_b64: str,
    signature_b64: str,
) -> bool:
    """Verifies a WebAuthn assertion signature in pure Python using cryptography."""
    try:
        from cryptography.hazmat.primitives.asymmetric import ec, rsa, padding
        from cryptography.hazmat.primitives import hashes, serialization

        # Pad and decode base64 standardly
        def clean_decode(b64_str: str) -> bytes:
            b64_str = b64_str.replace("-", "+").replace("_", "/")
            padded = b64_str + "=" * (-len(b64_str) % 4)
            return base64.b64decode(padded)

        pubkey_bytes = clean_decode(public_key_der_b64)
        auth_data_bytes = clean_decode(authenticator_data_b64)
        client_data_bytes = clean_decode(client_data_json_b64)
        sig_bytes = clean_decode(signature_b64)
        
        # Load public key
        public_key = serialization.load_der_public_key(pubkey_bytes)
        
        # Hash client data
        client_data_hash = hashlib.sha256(client_data_bytes).digest()
        
        # Verification data is authenticatorData || hash(clientDataJSON)
        verify_data = auth_data_bytes + client_data_hash
        
        # Verify signature based on key type
        if isinstance(public_key, ec.EllipticCurvePublicKey):
            public_key.verify(sig_bytes, verify_data, ec.ECDSA(hashes.SHA256()))
        elif isinstance(public_key, rsa.RSAPublicKey):
            public_key.verify(sig_bytes, verify_data, padding.PKCS1v15(), hashes.SHA256())
        else:
            return False
        return True
    except Exception as e:
        print(f"WebAuthn signature verification failed: {e}")
        return False

