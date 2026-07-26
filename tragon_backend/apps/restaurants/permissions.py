"""Custom permission classes for the restaurants app."""

from rest_framework.permissions import BasePermission


class IsRestaurantOwner(BasePermission):
    """Ensures the authenticated user is an Owner who owns a restaurant."""

    message = "No tiene permiso para realizar esta acción."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return hasattr(request.user, "restaurant")
