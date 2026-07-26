"""
Custom exception handler for consistent error responses.

Format: {"error": "code", "message": "...", "details": {}}
"""

from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    ValidationError,
)
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """Transform DRF exceptions into consistent JSON error format."""
    response = exception_handler(exc, context)

    if response is None:
        return response

    error_code = "server_error"
    message = "Error interno del servidor."
    details = {}

    if isinstance(exc, ValidationError):
        error_code = "validation_error"
        message = "Los datos proporcionados no son válidos."
        details = (
            response.data
            if isinstance(response.data, dict)
            else {"errors": response.data}
        )
    elif isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        error_code = "authentication_error"
        message = "No se proporcionó autenticación válida."
    elif isinstance(exc, PermissionDenied):
        error_code = "permission_denied"
        message = "No tiene permiso para realizar esta acción."
    elif isinstance(exc, NotFound):
        error_code = "not_found"
        message = "El recurso solicitado no fue encontrado."
    elif response.status_code == status.HTTP_409_CONFLICT:
        error_code = "duplicate_entry"
        message = "El recurso ya existe."
    else:
        # Generic mapping for other HTTP errors
        detail = getattr(exc, "detail", None)
        if detail:
            message = str(detail)

    response.data = {
        "error": error_code,
        "message": message,
        "details": details,
    }

    return response
