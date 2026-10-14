import hmac
import hashlib
import json
import time
from urllib.parse import parse_qsl, unquote
from typing import Dict, Any, Optional

def validate_init_data(init_data_raw: str, bot_token: str, max_age_seconds: int = 86400) -> Optional[Dict[str, Any]]:
    """
    Validates Telegram WebApp initData string using HMAC-SHA-256.
    
    Security spec:
    1. Parse raw query string into key-value pairs.
    2. Extract 'hash' value.
    3. Sort remaining pairs alphabetically by key and format as 'key=value\\n'.
    4. Compute secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token).
    5. Compute calculated_hash = HMAC_SHA256(key=secret_key, msg=data_check_string).
    6. Verify that calculated_hash matches 'hash' securely.
    7. Optionally ensure auth_date is not older than max_age_seconds (replay attack defense).
    
    Returns:
        dict: Parsed and validated payload including parsed 'user' dict, or None if invalid.
    """
    if not init_data_raw or not bot_token:
        return None

    try:
        # Parse query string preserving original URL encoding if already decoded or raw
        parsed_data = dict(parse_qsl(init_data_raw, keep_blank_values=True))
        
        received_hash = parsed_data.pop("hash", None)
        if not received_hash:
            return None

        # Build data-check-string (sorted alphabetically by key)
        data_check_list = [f"{k}={v}" for k, v in sorted(parsed_data.items())]
        data_check_string = "\n".join(data_check_list)

        # Compute HMAC secret key: HMAC_SHA256(key=b"WebAppData", data=bot_token.encode())
        secret_key = hmac.new(
            b"WebAppData",
            bot_token.encode("utf-8"),
            hashlib.sha256
        ).digest()

        # Compute HMAC signature for data_check_string
        computed_hash = hmac.new(
            secret_key,
            data_check_string.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(computed_hash, received_hash):
            return None

        # Check auth_date expiration
        auth_date = int(parsed_data.get("auth_date", 0))
        if auth_date <= 0 or (time.time() - auth_date > max_age_seconds):
            # Expired session
            return None

        # If user field is present, parse it from JSON string
        if "user" in parsed_data:
            try:
                parsed_data["user"] = json.loads(parsed_data["user"])
            except json.JSONDecodeError:
                pass

        return parsed_data

    except Exception as e:
        print(f"[Auth Error] Failed to validate initData: {e}")
        return None
