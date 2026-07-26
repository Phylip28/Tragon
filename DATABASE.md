# DATABASE.md

Living document tracking the normalized PostgreSQL schema for Tragón. This is a work in progress — constraints are being filled in incrementally.

## Status

- [x] Fields and relationships defined
- [~] `NOT NULL` constraints (in progress, see tables below)
- [~] `ON DELETE` behavior (in progress, see tables below)
- [ ] Indexes
- [x] Unique constraints defined for `payment_method` and `category`

## Decisions Log

| #   | Decision                                                                                                                                 | Rationale                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Drop `api_key` table                                                                                                                     | No authentication in the MVP; the table only existed due to a security assumption that doesn't apply yet.                                                                                                                                                                                                                                  |
| 2   | Drop `session_slug` table                                                                                                                | No bot session tracking; restaurant is accessed directly via its slug.                                                                                                                                                                                                                                                                     |
| 3   | Extract `payment_method` into its own table                                                                                              | A restaurant can accept more than one payment method (cash, Bre-b, and future methods). Normalizes what was flat fields on `restaurant`.                                                                                                                                                                                                   |
| 4   | Drop `notification_channel` / `whatsapp_number` from `restaurant`                                                                        | YAGNI for MVP — only Telegram is used today. Re-introduce when WhatsApp integration is actually built.                                                                                                                                                                                                                                     |
| 5   | Keep `telegram_chat_id` as-is                                                                                                            | It's an internal Telegram identifier assigned on first bot contact, not the restaurant's phone number. Can't be substituted.                                                                                                                                                                                                               |
| 6   | Remove `restaurant_id` from `category`... **rejected**                                                                                   | Categories are restaurant-specific catalog data (not shared), and `category` relates to `product`, not to `order`. FK to `restaurant` stays.                                                                                                                                                                                               |
| 7   | Remove `sort_order` from `category` and `product`                                                                                        | Storing a static sort order isn't useful long-term. Manual ordering is out of scope for MVP; product highlighting is handled via a simple `label` field instead (see decision #19).                                                                                                                                                        |
| 8   | Collapse the 6 address fields on `order` into `address_line` + `latitude` + `longitude`                                                  | `delivery-routing` needs geocoordinates for map/route autocomplete. A single free-text field without coordinates would break that module. Structured Colombian address fields (street type, road number, etc.) are a frontend/UX concern, not necessarily a DB concern — the backend only needs the resolved address string + coordinates. |
| 9   | `payment_method` as its own table, referenced by both `restaurant` (catalog: what it accepts) and `order` (transaction: what was chosen) | These are two different relationships, not a redundancy.                                                                                                                                                                                                                                                                                   |
| 10  | Update `order.status` values                                                                                                             | Aligned with `kitchen-panel` requirements: `received`, `confirmed`, `in_preparation`, `completed`, `cancelled`.                                                                                                                                                                                                                            |
| 11  | Drop `notification_error` from `order`                                                                                                   | Not needed for MVP; failures can be tracked via application logs instead of a dedicated column.                                                                                                                                                                                                                                            |
| 12  | Add `updated_at` and `updated_description` to `order`                                                                                    | Track the last modification to an order and a short note about what changed. Full per-change history (a dedicated `order_status_history` table) is deferred — revisit if audit trail becomes a requirement.                                                                                                                                |
| 13  | Item-level notes (e.g. "no onion") live on `order_item`, not `order`                                                                     | An order can contain multiple items with different instructions each. A single note field at the order level would lose that granularity.                                                                                                                                                                                                  |
| 14  | Drop `product_snapshot` / `topping_snapshot` (JSONB) from `order_item` / `order_item_topping`                                            | Storing a full snapshot of the product/topping is overkill for MVP.                                                                                                                                                                                                                                                                        |
| 15  | Keep `unit_price` on `order_item` and `extra_price` on `order_item_topping`                                                              | Prices must be captured at order time. If the restaurant later changes a product's price, historical orders must still reflect what was actually charged.                                                                                                                                                                                  |
| 16  | Keep `order_item_topping` table                                                                                                          | An order item can have multiple toppings — this is a many-to-many relationship between `order_item` and `topping`. Removing it would require storing toppings as an array/JSON, losing referential integrity.                                                                                                                              |
| 17  | Switch monetary fields from `DECIMAL(10,2)` to `INTEGER`                                                                                 | Colombian Pesos (COP) don't use subunits in practice. Using `INTEGER` (whole pesos) avoids unnecessary decimal precision handling in the application layer.                                                                                                                                                                                |
| 18  | Enforce uniqueness on `payment_method(restaurant_id, type)`                                                                              | Prevents a restaurant from registering the same payment method type twice.                                                                                                                                                                                                                                                                 |
| 19  | Replace `menu_section` / `menu_section_product` with a single nullable `label` field on `product`                                        | The goal is to highlight a specific product (e.g. "Más vendido") without duplicating it across sections, which would confuse clients when choosing. A product shows once in its category, optionally with one highlight label.                                                                                                             |
| 20  | Enforce uniqueness on `category(restaurant_id, name)` instead of a global `UNIQUE` on `name`                                             | A global unique constraint on `name` would prevent two different restaurants from both having a category named "Bebidas". Uniqueness must be scoped per restaurant.                                                                                                                                                                        |
| 21  | `product.category_id` uses `ON DELETE CASCADE`                                                                                           | If a category is deleted, its products are deleted along with it — consistent with categories owning their products.                                                                                                                                                                                                                       |
| 22  | `order.delivery_type` and `order.status` restricted via `CHECK` constraint                                                               | Enforces a fixed set of valid values at the database level, not just in application code.                                                                                                                                                                                                                                                  |

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

| Field         | Type            | Constraints | Description                                           |
| ------------- | --------------- | ----------- | ----------------------------------------------------- |
| id            | UUID PK         |             |                                                       |
| restaurant_id | FK → restaurant |             | Owning restaurant                                     |
| type          | VARCHAR(30)     | NOT NULL    | e.g. `cash`, `transfer`                               |
| key_value     | VARCHAR(200)    |             | e.g. Bre-b key (nullable, only applies to some types) |
| is_active     | BOOLEAN         | NOT NULL    |                                                       |

**Table constraint:** `UNIQUE(restaurant_id, type)`

### `category`

| Field         | Type            | Constraints | Description |
| ------------- | --------------- | ----------- | ----------- |
| id            | UUID PK         |             |             |
| restaurant_id | FK → restaurant |             |             |
| name          | VARCHAR(200)    | NOT NULL    |             |
| is_active     | BOOLEAN         | NOT NULL    |             |

**Table constraint:** `UNIQUE(restaurant_id, name)` — scoped per restaurant, not global.

### `product`

| Field       | Type          | Constraints       | Description                                          |
| ----------- | ------------- | ----------------- | ---------------------------------------------------- |
| id          | UUID PK       |                   |                                                      |
| category_id | FK → category | ON DELETE CASCADE | Deleting a category deletes its products             |
| name        | VARCHAR(200)  | NOT NULL          |                                                      |
| description | TEXT          | NOT NULL          | Ingredients / description                            |
| photo_url   | TEXT          |                   | Photo URL in S3                                      |
| base_price  | INTEGER       | NOT NULL          |                                                      |
| is_active   | BOOLEAN       | NOT NULL          |                                                      |
| label       | VARCHAR(50)   |                   | Optional highlight tag (e.g. "Más vendido", "Nuevo") |

### `topping`

| Field       | Type         | Constraints | Description |
| ----------- | ------------ | ----------- | ----------- |
| id          | UUID PK      |             |             |
| product_id  | FK → product |             |             |
| name        | VARCHAR(200) | NOT NULL    |             |
| extra_price | INTEGER      | NOT NULL    |             |
| is_active   | BOOLEAN      | NOT NULL    |             |

### `order`

| Field               | Type                | Constraints                                                                              | Description                               |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| id                  | UUID PK             |                                                                                          |                                           |
| reference_number    | VARCHAR(20) UNIQUE  |                                                                                          | Human-readable reference number           |
| restaurant_id       | FK → restaurant     |                                                                                          |                                           |
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

| Field      | Type         | Constraints | Description                                          |
| ---------- | ------------ | ----------- | ---------------------------------------------------- |
| id         | UUID PK      |             |                                                      |
| order_id   | FK → order   |             |                                                      |
| product_id | FK → product |             |                                                      |
| notes      | TEXT         |             | Special instructions for this item (e.g. "no onion") |
| unit_price | INTEGER      | NOT NULL    | Product price captured at order time                 |

### `order_item_topping`

| Field         | Type            | Constraints | Description                          |
| ------------- | --------------- | ----------- | ------------------------------------ |
| id            | UUID PK         |             |                                      |
| order_item_id | FK → order_item |             |                                      |
| topping_id    | FK → topping    |             |                                      |
| extra_price   | INTEGER         | NOT NULL    | Topping price captured at order time |

## Open Items

- Remaining `NOT NULL` constraints for fields not yet covered above (e.g. `restaurant.slug`, `restaurant.name`, `order.reference_number`, all FK columns).
- `ON DELETE` behavior for FKs other than `product.category_id` — likely soft-delete (`is_active`) for `restaurant` rather than hard delete, consistent with `category`/`product`/`topping`.
- Indexes: `category(restaurant_id)`, `product(category_id)`, `order(restaurant_id, created_at)`, `order(status)`.
