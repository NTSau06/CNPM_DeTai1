"""Các lỗi nghiệp vụ dùng chung để báo lỗi xác thực và service."""
class ServiceUnavailableError(Exception):
    """A required downstream service could not complete the request."""


class PlaceValidationError(ValueError):
    """One or more tour stops do not exist in the place catalog."""
