import logging
import time
import uuid


logger = logging.getLogger("setlive.request")


class RequestObservabilityMiddleware:
    """Attach basic request metrics and structured request logs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = time.perf_counter()
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        response = self.get_response(request)
        elapsed_ms = (time.perf_counter() - started_at) * 1000

        response["X-Request-Id"] = request_id
        response["X-Response-Time-ms"] = f"{elapsed_ms:.2f}"

        extra = {
            "request_id": request_id,
            "method": request.method,
            "path": request.get_full_path(),
            "status_code": response.status_code,
            "duration_ms": round(elapsed_ms, 2),
        }

        if response.status_code >= 500:
            logger.error("request_error", extra=extra)
        elif response.status_code >= 400:
            logger.warning("request_warning", extra=extra)
        else:
            logger.info("request_ok", extra=extra)

        return response
