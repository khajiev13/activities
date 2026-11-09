class ServiceException(Exception):
    def __init__(self, code: int, message: str, http_status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


class AuthError(ServiceException):
    def __init__(self, message: str = "Not authenticated") -> None:
        super().__init__(101, message, 401)


class InvalidCodeError(ServiceException):
    def __init__(self, message: str = "Invalid or expired code") -> None:
        super().__init__(102, message, 401)


class PhoneRequiredError(ServiceException):
    def __init__(self, message: str = "phone_required") -> None:
        super().__init__(103, message, 403)


class ForbiddenError(ServiceException):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(104, message, 403)


class ForeignContactError(ServiceException):
    def __init__(self, message: str = "Contact belongs to another user") -> None:
        super().__init__(105, message, 400)


class ValidationError(ServiceException):
    def __init__(self, message: str = "Invalid input") -> None:
        super().__init__(201, message, 422)


class RateLimitedError(ServiceException):
    def __init__(self, message: str = "Too many requests", *, retry_after: int) -> None:
        super().__init__(202, message, 429)
        self.retry_after = retry_after


class NotFoundError(ServiceException):
    def __init__(self, message: str = "Not found") -> None:
        super().__init__(300, message, 404)


class ConflictError(ServiceException):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__(400, message, 409)
