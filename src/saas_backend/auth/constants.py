import os
from dotenv import load_dotenv

_ = load_dotenv()


def get_secret():
    return os.getenv("JWT_SECRET", "cQMmaBUdU4M2i6CcPufbsr+ZJkmtux9wH8Y0ZaxQEKA=")


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 120))

# Header-based auth configuration (for proxy auth like Authentik / Firefly-III style)
# When enabled, standard username/password login and self-registration are disabled.
HEADER_AUTH_ENABLED = os.getenv("HEADER_AUTH_ENABLED", "false").lower() in [
    "1",
    "true",
    "yes",
]

# Upstream headers provided by the auth proxy (case-insensitive on incoming HTTP)
# Defaults target common Authentik headers; override as needed.
HEADER_AUTH_USERNAME_HEADER = os.getenv(
    "HEADER_AUTH_USERNAME_HEADER", "X-Authentik-Username"
)
HEADER_AUTH_EMAIL_HEADER = os.getenv("HEADER_AUTH_EMAIL_HEADER", "X-Authentik-Email")

# Optional external logout URL (e.g., https://authentik.example.tld/application/o/<app>/end-session/)
HEADER_AUTH_LOGOUT_URL = os.getenv("HEADER_AUTH_LOGOUT_URL", "")
