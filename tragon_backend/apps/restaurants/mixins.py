"""ViewSet mixins for the restaurants app."""


class RestaurantScopedMixin:
    """
    Mixin that auto-filters querysets by the authenticated owner's restaurant.

    Expects the model to have a `restaurant` FK field.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_authenticated and hasattr(
            self.request.user, "restaurant"
        ):
            return queryset.filter(restaurant=self.request.user.restaurant)
        return queryset.none()
