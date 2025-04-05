from starlette.middleware.base import BaseHTTPMiddleware # type: ignore
from starlette.requests import Request # type: ignore
from starlette.responses import JSONResponse # type: ignore
import os

class IPWhitelistMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # Fetch allowed IPs from environment (comma-separated)
        allowed_ips = os.getenv("ALLOWED_IPS", "")
        self.allowed_ips = [ip.strip() for ip in allowed_ips.split(",") if ip.strip()]
        print(f"[🔐 IP Whitelist] Allowed IPs: {self.allowed_ips}")

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        if client_ip not in self.allowed_ips:
            print(f"[🔐 BLOCKED] IP {client_ip} is not in the whitelist")
            return JSONResponse(
                {"detail": "Access denied: IP not allowed."},
                status_code=403
            )
        return await call_next(request)