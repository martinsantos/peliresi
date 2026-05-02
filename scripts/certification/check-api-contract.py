#!/usr/bin/env python3
"""Non-destructive API contract checks for SITREP."""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.error
import urllib.request


TARGET_URL = (sys.argv[1] if len(sys.argv) > 1 else os.getenv("TARGET_URL", "https://sitrep.ultimamilla.com.ar")).rstrip("/")
MODE = os.getenv("OPENAPI_CONTRACT_MODE", "baseline")
ADMIN_EMAIL = os.getenv("CERT_ADMIN_EMAIL", "admin@dgfa.mendoza.gov.ar")
ADMIN_PASSWORD = os.getenv("CERT_ADMIN_PASSWORD", "admin123")

FAIL = 0
WARN = 0
TLS_FALLBACK_USED = False


def pass_(label: str) -> None:
    print(f"PASS {label}")


def warn(label: str) -> None:
    global WARN
    WARN += 1
    print(f"WARN {label}")


def fail(label: str) -> None:
    global FAIL
    FAIL += 1
    print(f"FAIL {label}")


def request(path: str, method: str = "GET", token: str | None = None, payload: dict | None = None) -> tuple[int, dict | str]:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(f"{TARGET_URL}{path}", data=data, headers=headers, method=method)
    def open_request(context: ssl.SSLContext | None = None) -> tuple[int, dict | str]:
        with urllib.request.urlopen(req, timeout=15, context=context) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body

    try:
        return open_request()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, body
    except urllib.error.URLError as exc:
        global TLS_FALLBACK_USED
        if isinstance(exc.reason, ssl.SSLCertVerificationError):
            TLS_FALLBACK_USED = True
            return open_request(ssl._create_unverified_context())
        raise


def login() -> str:
    status, body = request(
        "/api/auth/login",
        method="POST",
        payload={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if status != 200 or not isinstance(body, dict):
        fail(f"admin login for contract token returned HTTP {status}")
        return ""
    token = (((body.get("data") or {}).get("tokens") or {}).get("accessToken")) or ""
    if token:
        pass_("admin login returns access token")
    else:
        fail("admin login returns access token")
    return token


def main() -> int:
    print("SITREP API contract checks")
    print(f"Target: {TARGET_URL}")
    print(f"Mode: {MODE}")

    token = login()
    if TLS_FALLBACK_USED:
        warn("Python TLS store could not verify cert; retried with unverified context after curl preflight")

    status, spec = request("/api/docs.json", token=token or None)
    if status != 200 or not isinstance(spec, dict):
        fail(f"/api/docs.json returns JSON OpenAPI spec (HTTP {status})")
        return 1
    pass_("/api/docs.json returns JSON")

    if spec.get("openapi", "").startswith("3."):
        pass_("OpenAPI version is 3.x")
    else:
        fail("OpenAPI version is 3.x")

    paths = spec.get("paths")
    if isinstance(paths, dict) and paths:
        pass_("OpenAPI paths are present")
    else:
        fail("OpenAPI paths are present")
        paths = {}

    required_paths = ["/health", "/auth/login", "/manifiestos", "/catalogos/tipos-residuos"]
    for path in required_paths:
        if path in paths:
            pass_(f"OpenAPI documents {path}")
        elif MODE == "strict":
            fail(f"OpenAPI documents {path}")
        else:
            warn(f"OpenAPI baseline missing {path}")

    checks = [
        ("GET", "/api/health", None, 200, "health"),
        ("GET", "/api/auth/test", None, 200, "auth test"),
        ("GET", "/api/catalogos/tipos-residuos", None, 200, "public catalog"),
        ("GET", "/api/auth/profile", token, 200, "profile"),
    ]
    for method, path, check_token, expected, label in checks:
        status, body = request(path, method=method, token=check_token)
        if status == expected and isinstance(body, dict):
            pass_(f"{label} returns HTTP {expected} JSON")
        else:
            fail(f"{label} returns HTTP {expected} JSON (got {status})")

    if FAIL:
        print(f"RESULT: FAIL ({FAIL})")
        return 1
    print(f"RESULT: PASS ({WARN} warnings)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
