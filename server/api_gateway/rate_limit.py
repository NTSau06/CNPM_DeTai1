"""Giới hạn số lần đăng nhập sai để chống dò mật khẩu.

Bộ đếm nằm trong bộ nhớ của tiến trình Gateway nên phù hợp với một instance.
Khi chạy nhiều instance cần chuyển sang kho dùng chung (Redis, SQL Server).
"""
from __future__ import annotations

import threading
import time
from collections import deque


class LoginRateLimiter:
    """Khóa tạm một khóa (IP + email) sau quá nhiều lần thất bại trong một cửa sổ thời gian."""

    def __init__(self, max_failures: int = 5, window_seconds: int = 15 * 60) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._failures.setdefault(key, deque())
        while attempts and attempts[0] <= now - self.window_seconds:
            attempts.popleft()
        if not attempts:
            self._failures.pop(key, None)
            return deque()
        return attempts

    def retry_after(self, key: str) -> int:
        """Trả về số giây phải chờ; 0 nếu khóa chưa bị chặn."""
        now = time.monotonic()
        with self._lock:
            attempts = self._prune(key, now)
            if len(attempts) < self.max_failures:
                return 0
            return max(1, int(attempts[0] + self.window_seconds - now) + 1)

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            self._failures.setdefault(key, deque()).append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)
