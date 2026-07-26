# DATABASE.md

Living document tracking the normalized PostgreSQL schema for Tragón. This is a work in progress — constraints are being filled in incrementally.

## Status

- [x] Fields and relationships defined
- [~] `NOT NULL` constraints (in progress, see tables below)
- [~] `ON DELETE` behavior (in progress, see tables below)
- [ ] Indexes
- [x] Unique constraints defined for `payment_method` and `category`

## Decisions Log

| #   | Decision                                                                                                                                                   | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Drop `api_key` table                                                                                                                                       | No authentication in the MVP; the table only existed due to a security assumption that doesn't apply yet.                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | Drop `session_slug` table                                                                                                                                  | No bot session tracking; restaurant is accessed directly via its slug.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 3   | Extract `payment_method` into its own table                                                                                                                | A restaurant can accept more than one payment method (cash, Bre-b, and future methods). Normalizes what was flat fields on `restaurant`.                                                                                                                                                                                                                                                                                                                                                                              |
| 4   | Drop `notification_channel` / `whatsapp_number` from `restaurant`                                                                                          | YAGNI for MVP — only Telegram is used today. Re-introduce when WhatsApp integration is actually built.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 5   | Keep `telegram_chat_id` as-is                                                                                                                              | It's an internal Telegram identifier assigned on first bot contact, not the restaurant's phone number. Can't be substituted.                                                                                                                                                                                                                                                                                                                                                                                          |
| 6   | Remove `restaurant_id` from `category`... **rejected**                                                                                                     | Categories are restaurant-specific catalog data (not shared), and `category` relates to `product`, not to `order`. FK to `restaurant` stays.                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | Remove `sort_order` from `category` and `product`                                                                                                          | Storing a static sort order isn't useful long-term. Manual ordering is out of scope for MVP; product highlighting is handled via a simple `label` field instead (see decision #19).                                                                                                                                                                                                                                                                                                                                   |
| 8   | Collapse the 6 address fields on `order` into `address_line` + `latitude` + `longitude`                                                                    | `delivery-routing` needs geocoordinates for map/route autocomplete. A single free-text field without coordinates would break that module. Structured Colombian address fields (street type, road number, etc.) are a frontend/UX concern, not necessarily a DB concern — the backend only needs the resolved address string + coordinates.                                                                                                                                                                            |
| 9   | `payment_method` as its own table, referenced by both `restaurant` (catalog: what it accepts) and `order` (transaction: what was chosen)                   | These are two different relationships, not a redundancy.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 10  | Update `order.status` values                                                                                                                               | Aligned with `kitchen-panel` requirements: `received`, `confirmed`, `in_preparation`, `completed`, `cancelled`.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 11  | Drop `notification_error` from `order`                                                                                                                     | Not needed for MVP; failures can be tracked via application logs instead of a dedicated column.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 12  | Add `updated_at` and `updated_description` to `order`                                                                                                      | Track the last modification to an order and a short note about what changed. Full per-change history (a dedicated `order_status_history` table) is deferred — revisit if audit trail becomes a requirement.                                                                                                                                                                                                                                                                                                           |
| 13  | Item-level notes (e.g. "no onion") live on `order_item`, not `order`                                                                                       | An order can contain multiple items with different instructions each. A single note field at the order level would lose that granularity.                                                                                                                                                                                                                                                                                                                                                                             |
| 14  | Drop `product_snapshot` / `topping_snapshot` (JSONB) from `order_item` / `order_item_topping`                                                              | Storing a full snapshot of the product/topping is overkill for MVP.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 15  | Keep `unit_price` on `order_item` and `extra_price` on `order_item_topping`                                                                                | Prices must be captured at order time. If the restaurant later changes a product's price, historical orders must still reflect what was actually charged.                                                                                                                                                                                                                                                                                                                                                             |
| 16  | Keep `order_item_topping` table                                                                                                                            | An order item can have multiple toppings — this is a many-to-many relationship between `order_item` and `topping`. Removing it would require storing toppings as an array/JSON, losing referential integrity.                                                                                                                                                                                                                                                                                                         |
| 17  | Switch monetary fields from `DECIMAL(10,2)` to `INTEGER`                                                                                                   | Colombian Pesos (COP) don't use subunits in practice. Using `INTEGER` (whole pesos) avoids unnecessary decimal precision handling in the application layer.                                                                                                                                                                                                                                                                                                                                                           |
| 18  | Enforce uniqueness on `payment_method(restaurant_id, type)`                                                                                                | Prevents a restaurant from registering the same payment method type twice.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 19  | Replace `menu_section` / `menu_section_product` with a single nullable `label` field on `product`                                                          | The goal is to highlight a specific product (e.g. "Más vendido") without duplicating it across sections, which would confuse clients when choosing. A product shows once in its category, optionally with one highlight label.                                                                                                                                                                                                                                                                                        |
| 20  | Enforce uniqueness on `category(restaurant_id, name)` instead of a global `UNIQUE` on `name`                                                               | A global unique constraint on `name` would prevent two different restaurants from both having a category named "Bebidas". Uniqueness must be scoped per restaurant.                                                                                                                                                                                                                                                                                                                                                   |
| 21  | `product.category_id` uses `ON DELETE SET NULL` (nullable FK)                                                                                              | Deleting a category must NOT delete its products. Products become uncategorized instead of being lost. `category_id` must therefore be nullable.                                                                                                                                                                                                                                                                                                                                                                      |
| 22  | `order.delivery_type` and `order.status` restricted via `CHECK` constraint                                                                                 | Enforces a fixed set of valid values at the database level, not just in application code.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 23  | `payment_method.type` gains a third value: `transfer_with_key`. `key_value` becomes conditionally `NOT NULL` via `CHECK` when `type = 'transfer_with_key'` | Distinguishes a plain transfer (no key needed, e.g. bank account number shared out-of-band) from a key-based transfer (e.g. Bre-b) that requires displaying a key to the client. Only the latter needs `key_value` populated.                                                                                                                                                                                                                                                                                         |
| 24  | Uncategorized products (after a category is deleted, see decision #21) are displayed at the end of the public menu                                         | UX behavior only — no additional schema needed. The public menu query groups by category and appends products with `category_id IS NULL` as a final, unlabeled group.                                                                                                                                                                                                                                                                                                                                                 |
| 25  | `order.restaurant_id` is `NOT NULL`                                                                                                                        | An order must always belong to a restaurant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 26  | `order` address fields (`address_line`, `latitude`, `longitude`) and `cash_denomination` remain nullable at the DB level                                   | The system supports dine-in/pickup orders (no address needed) and non-cash payments (no denomination needed). Making these `NOT NULL` would force irrelevant data entry. Conditional requirement (`address_line` required only when `delivery_type = 'delivery'`; `cash_denomination` required only when the referenced `payment_method.type = 'cash'`) is enforced at the application layer (serializer), not via DB constraint — the second case requires a cross-table check that a simple `CHECK` cannot express. |
| 27  | `order_item.order_id` and `order_item_topping.order_item_id` use `ON DELETE RESTRICT`                                                                      | Orders must never be deleted (historical/operational record). `RESTRICT` is a defense-in-depth safeguard at the DB level, even though the application should never attempt to delete an order in the first place.                                                                                                                                                                                                                                                                                                     |
| 28  | `topping.product_id` uses `ON DELETE CASCADE`                                                                                                              | Unlike category→product, a topping has no independent meaning without its product. Deleting the product deletes its toppings.                                                                                                                                                                                                                                                                                                                                                                                         |

## Tables

### `restaurant`

| Field            | Type               | Constraints | Description                        |
| ---------------- | ------------------ | ----------- | ---------------------------------- |
| id               | UUID PK            |             | Internal identifier                |
| slug             | VARCHAR(50) UNIQUE |             | Immutable public identifier        |
| name             | VARCHAR(200)       |             | Restaurant name                    |
| logo_url         | TEXT               |             | Logo URL in S3                     |
| address_line     | TEXT               | NOT NULL    | Physical address                   |
| latitude         | DECIMAL            |             | Restaurant location latitude       |
| longitude        | DECIMAL            |             | Restaurant location longitude      |
| telegram_chat_id | VARCHAR(100)       | NOT NULL    | Telegram chat ID for notifications |
| delivery_fee     | INTEGER            | NOT NULL    | Delivery fee amount                |
| created_at       | TIMESTAMPTZ        |             | Creation timestamp                 |

### `payment_method`

| Field         | Type            | Constraints                                                  | Description                                                 |
| ------------- | --------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| id            | UUID PK         |                                                              |                                                             |
| restaurant_id | FK → restaurant |                                                              | Owning restaurant                                           |
| type          | VARCHAR(30)     | NOT NULL, CHECK IN (`cash`, `transfer`, `transfer_with_key`) |                                                             |
| key_value     | VARCHAR(200)    |                                                              | Required when `type = 'transfer_with_key'` (e.g. Bre-b key) |
| is_active     | BOOLEAN         | NOT NULL                                                     |                                                             |

**Table constraints:**

- `UNIQUE(restaurant_id, type)`
- `CHECK (type != 'transfer_with_key' OR key_value IS NOT NULL)`

### `category`

| Field         | Type            | Constraints | Description |
| ------------- | --------------- | ----------- | ----------- |
| id            | UUID PK         |             |             |
| restaurant_id | FK → restaurant |             |             |
| name          | VARCHAR(200)    | NOT NULL    |             |
| is_active     | BOOLEAN         | NOT NULL    |             |

**Table constraint:** `UNIQUE(restaurant_id, name)` — scoped per restaurant, not global.

### `product`

| Field       | Type                     | Constraints        | Description                                              |
| ----------- | ------------------------ | ------------------ | -------------------------------------------------------- |
| id          | UUID PK                  |                    |                                                          |
| category_id | FK → category (nullable) | ON DELETE SET NULL | Product becomes uncategorized if its category is deleted |
| name        | VARCHAR(200)             | NOT NULL           |                                                          |
| description | TEXT                     | NOT NULL           | Ingredients / description                                |
| photo_url   | TEXT                     |                    | Photo URL in S3                                          |
| base_price  | INTEGER                  | NOT NULL           |                                                          |
| is_active   | BOOLEAN                  | NOT NULL           |                                                          |
| label       | VARCHAR(50)              |                    | Optional highlight tag (e.g. "Más vendido", "Nuevo")     |

### `topping`

| Field       | Type         | Constraints                 | Description                                |
| ----------- | ------------ | --------------------------- | ------------------------------------------ |
| id          | UUID PK      |                             |                                            |
| product_id  | FK → product | NOT NULL, ON DELETE CASCADE | Toppings don't exist without their product |
| name        | VARCHAR(200) | NOT NULL                    |                                            |
| extra_price | INTEGER      | NOT NULL                    |                                            |
| is_active   | BOOLEAN      | NOT NULL                    |                                            |

### `order`

| Field               | Type                | Constraints                                                                              | Description                               |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| id                  | UUID PK             |                                                                                          |                                           |
| reference_number    | VARCHAR(20) UNIQUE  |                                                                                          | Human-readable reference number           |
| restaurant_id       | FK → restaurant     | NOT NULL                                                                                 |                                           |
| delivery_type       | VARCHAR(30)         | NOT NULL, CHECK IN (`delivery`, `pickup`, `dine_in`)                                     |                                           |
| address_line        | TEXT                |                                                                                          | Resolved delivery address (if delivery)   |
| latitude            | DECIMAL             |                                                                                          | Delivery location latitude (if delivery)  |
| longitude           | DECIMAL             |                                                                                          | Delivery location longitude (if delivery) |
| payment_method_id   | FK → payment_method | NOT NULL                                                                                 | Payment method chosen for this order      |
| cash_denomination   | INTEGER             |                                                                                          | Bill denomination (if cash)               |
| subtotal            | INTEGER             |                                                                                          |                                           |
| delivery_fee        | INTEGER             |                                                                                          |                                           |
| total               | INTEGER             |                                                                                          |                                           |
| status              | VARCHAR(30)         | NOT NULL, CHECK IN (`received`, `confirmed`, `in_preparation`, `completed`, `cancelled`) |                                           |
| created_at          | TIMESTAMPTZ         |                                                                                          |                                           |
| updated_at          | TIMESTAMPTZ         |                                                                                          | Last modification timestamp               |
| updated_description | TEXT                |                                                                                          | Short note describing the last change     |

### `order_item`

| Field      | Type         | Constraints                  | Description                                          |
| ---------- | ------------ | ---------------------------- | ---------------------------------------------------- |
| id         | UUID PK      |                              |                                                      |
| order_id   | FK → order   | NOT NULL, ON DELETE RESTRICT | Orders are never deleted; RESTRICT as a safeguard    |
| product_id | FK → product |                              |                                                      |
| notes      | TEXT         |                              | Special instructions for this item (e.g. "no onion") |
| unit_price | INTEGER      | NOT NULL                     | Product price captured at order time                 |

### `order_item_topping`

| Field         | Type            | Constraints                  | Description                                                     |
| ------------- | --------------- | ---------------------------- | --------------------------------------------------------------- |
| id            | UUID PK         |                              |                                                                 |
| order_item_id | FK → order_item | NOT NULL, ON DELETE RESTRICT | Order items are never deleted directly; RESTRICT as a safeguard |
| topping_id    | FK → topping    |                              |                                                                 |
| extra_price   | INTEGER         | NOT NULL                     | Topping price captured at order time                            |

## Open Items

- Remaining `NOT NULL` constraints for fields not yet covered above (e.g. `restaurant.slug`, `restaurant.name`, `order.reference_number`, all FK columns not already specified).
- `ON DELETE` behavior for `category.restaurant_id` — likely soft-delete (`is_active`) for `restaurant` rather than hard delete.
- Application-layer validation rules (not DB constraints) still to be documented in the relevant module's design:
  - `order.address_line`/`latitude`/`longitude` required only when `delivery_type = 'delivery'`.
  - `order.cash_denomination` required only when the referenced `payment_method.type = 'cash'`.
- Public menu display rule: products with `category_id IS NULL` (uncategorized) are appended at the end of the menu (see decision #24) — needs to be reflected in the `client-ordering` design when built.
- Indexes: `category(restaurant_id)`, `product(category_id)`, `order(restaurant_id, created_at)`, `order(status)`.
