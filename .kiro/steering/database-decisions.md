---
inclusion: fileMatch
fileMatchPattern: "**/models.py|**/serializers.py|**/services.py"
---

# Database Decisions — Application-Layer Rules

These are business rules that are enforced in application code (Django serializers/services), not as SQL constraints, because they are conditional on another field's value or require cross-table checks that a simple `CHECK` constraint cannot express. See `DATABASE.md` for the full schema and its DB-level constraints.

## Conditional field requirements on `order`

- `address_line`, `latitude`, and `longitude` are required only WHEN `delivery_type = 'delivery'`. For `pickup` and `dine_in` orders, these fields MUST remain null.
- `cash_denomination` is required only WHEN the referenced `payment_method.type = 'cash'`. For `transfer` and `transfer_with_key`, this field MUST remain null.
- These checks MUST be implemented in the order-creation serializer/service, not assumed to be enforced by the database.

## Public menu display rule

- Products with `category_id IS NULL` (uncategorized, e.g. after their category was deleted) MUST still appear in the public menu.
- THE `client-ordering` menu endpoint SHALL append uncategorized products as a final, unlabeled group after all active categories.
