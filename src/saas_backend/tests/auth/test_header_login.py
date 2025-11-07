import os
import hashlib
from fastapi.testclient import TestClient

# Ensure env vars for header-auth BEFORE importing app
os.environ["HEADER_AUTH_ENABLED"] = "true"
os.environ["HEADER_AUTH_USERNAME_HEADER"] = "X-Authentik-Username"
os.environ["HEADER_AUTH_EMAIL_HEADER"] = "X-Authentik-Email"

from saas_backend.app import app  # noqa: E402
from saas_backend.auth.database import get_db  # noqa: E402
from saas_backend.auth.models import User  # noqa: E402

client = TestClient(app)


def test_header_login_provisions_user_once():
    headers = {
        "X-Authentik-Username": "proxyuser",
        "X-Authentik-Email": "proxyuser@example.com",
    }

    # First login should create the user
    r1 = client.post("/header-login", headers=headers)
    assert r1.status_code == 200
    assert r1.json()["message"] == "User logged in via header-auth"
    cookie = r1.cookies.get("access_token")
    assert cookie is not None

    # Second login should reuse existing user
    r2 = client.post("/header-login", headers=headers)
    assert r2.status_code == 200

    db = next(get_db())
    users = db.query(User).filter(User.username == "proxyuser").all()
    assert len(users) == 1, "User should only be provisioned once"


def test_disabled_password_endpoints():
    # /login should be forbidden when header auth enabled
    r = client.post(
        "/login",
        data={"username": "admin", "password": "admin"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 403
    # /register should be forbidden
    r2 = client.post(
        "/register",
        json={"username": "newuser", "password": "pw"},
    )
    assert r2.status_code == 403
