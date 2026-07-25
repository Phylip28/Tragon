# DATABASE.md

Living document tracking the normalized PostgreSQL schema for Tragón. This is a work in progress — fields and relationships are being defined first; `NOT NULL`, `ON DELETE` behavior, and indexes will be finalized in a later pass.

## Status

- [x] Fields and relationships defined
- [ ] `NOT NULL` constraints
- [ ] `ON DELETE` behavior (cascade / restrict / soft-delete)
- [ ] Indexes
- [ ] Unique constraints beyond PK

## Decisions Log

| #   | Decision                                                                                                                                 | Rationale                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Drop `api_key` table                                                                                                                     | No authentication in the MVP; the table only existed due to a security assumption that doesn't apply yet.                                                                                                                                                                                                                                  |
| 2   | Drop `session_slug` table                                                                                                                | No bot session tracking; restaurant is accessed directly via its slug.                                                                                                                                                                                                                                                                     |
| 3   | Extract `payment_method` into its own table                                                                                              | A restaurant can accept more than one payment method (cash, Bre-b, and future methods). Normalizes what was flat fields on `restaurant`.                                                                                                                                                                                                   |
| 4   | Drop `notification_channel` / `whatsapp_number` from `restaurant`                                                                        | YAGNI for MVP — only Telegram is used today. Re-introduce when WhatsApp integration is actually built.                                                                                                                                                                                                                                     |
| 5   | Keep `telegram_chat_id` as-is                                                                                                            | It's an internal Telegram identifier assigned on first bot contact, not the restaurant's phone number. Can't be substituted.                                                                                                                                                                                                               |
| 6   | Remove `restaurant_id` from `category`... **rejected**                                                                                   | Categories are restaurant-specific catalog data (not shared), and `category` relates to `product`, not to `order`. FK to `restaurant` stays.                                                                                                                                                                                               |
| 7   | Remove `sort_order` from `category` and `product`                                                                                        | Storing a static sort order isn't useful long-term. Manual ordering + menu sections (e.g. "Más pedidos", "Para chuparse los dedos") will be handled by a dedicated requirement/feature instead (see `restaurant-admin` Requirement 5).                                                                                                     |
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

## Tables

### `restaurant`

| Field            | Type               | Description                        |
| ---------------- | ------------------ | ---------------------------------- |
| id               | UUID PK            | Internal identifier                |
| slug             | VARCHAR(50) UNIQUE | Immutable public identifier        |
| name             | VARCHAR(200)       | Restaurant name                    |
| logo_url         | TEXT               | Logo URL in S3                     |
| address_line     | TEXT               | Physical address                   |
| latitude         | DECIMAL            | Restaurant location latitude       |
| longitude        | DECIMAL            | Restaurant location longitude      |
| telegram_chat_id | VARCHAR(100)       | Telegram chat ID for notifications |
| delivery_fee     | INTEGER            | Delivery fee amount                |
| created_at       | TIMESTAMPTZ        | Creation timestamp                 |

### `payment_method`

| Field         | Type            | Description                                           |
| ------------- | --------------- | ----------------------------------------------------- |
| id            | UUID PK         |                                                       |
| restaurant_id | FK → restaurant | Owning restaurant                                     |
| type          | VARCHAR(30)     | e.g. `cash`, `transfer`                               |
| key_value     | VARCHAR(200)    | e.g. Bre-b key (nullable, only applies to some types) |
| is_active     | BOOLEAN         |                                                       |

### `category`

| Field         | Type            | Description |
| ------------- | --------------- | ----------- |
| id            | UUID PK         |             |
| restaurant_id | FK → restaurant |             |
| name          | VARCHAR(200)    |             |
| is_active     | BOOLEAN         |             |

### `product`

| Field       | Type          | Description               |
| ----------- | ------------- | ------------------------- |
| id          | UUID PK       |                           |
| category_id | FK → category |                           |
| name        | VARCHAR(200)  |                           |
| description | TEXT          | Ingredients / description |
| photo_url   | TEXT          | Photo URL in S3           |
| base_price  | INTEGER       |                           |
| is_active   | BOOLEAN       |                           |

### `topping`

| Field       | Type         | Description |
| ----------- | ------------ | ----------- |
| id          | UUID PK      |             |
| product_id  | FK → product |             |
| name        | VARCHAR(200) |             |
| extra_price | INTEGER      |             |
| is_active   | BOOLEAN      |             |

### `order`

| Field               | Type                | Description                                                         |
| ------------------- | ------------------- | ------------------------------------------------------------------- |
| id                  | UUID PK             |                                                                     |
| reference_number    | VARCHAR(20) UNIQUE  | Human-readable reference number                                     |
| restaurant_id       | FK → restaurant     |                                                                     |
| delivery_type       | VARCHAR(30)         | `delivery`, `pickup`, `dine_in`                                     |
| address_line        | TEXT                | Resolved delivery address (if delivery)                             |
| latitude            | DECIMAL             | Delivery location latitude (if delivery)                            |
| longitude           | DECIMAL             | Delivery location longitude (if delivery)                           |
| payment_method_id   | FK → payment_method | Payment method chosen for this order                                |
| cash_denomination   | INTEGER             | Bill denomination (if cash)                                         |
| subtotal            | INTEGER             |                                                                     |
| delivery_fee        | INTEGER             |                                                                     |
| total               | INTEGER             |                                                                     |
| status              | VARCHAR(30)         | `received`, `confirmed`, `in_preparation`, `completed`, `cancelled` |
| created_at          | TIMESTAMPTZ         |                                                                     |
| updated_at          | TIMESTAMPTZ         | Last modification timestamp                                         |
| updated_description | TEXT                | Short note describing the last change                               |

### `order_item`

| Field      | Type         | Description                                          |
| ---------- | ------------ | ---------------------------------------------------- |
| id         | UUID PK      |                                                      |
| order_id   | FK → order   |                                                      |
| product_id | FK → product |                                                      |
| notes      | TEXT         | Special instructions for this item (e.g. "no onion") |
| unit_price | INTEGER      | Product price captured at order time                 |

### `order_item_topping`

| Field         | Type            | Description                          |
| ------------- | --------------- | ------------------------------------ |
| id            | UUID PK         |                                      |
| order_item_id | FK → order_item |                                      |
| topping_id    | FK → topping    |                                      |
| extra_price   | INTEGER         | Topping price captured at order time |

## Open Items

- `NOT NULL` constraints per field.
- `ON DELETE` behavior — likely soft-delete (`is_active`) for `restaurant` rather than hard delete, consistent with `category`/`product`/`topping`.
- Indexes: `category(restaurant_id)`, `product(category_id)`, `order(restaurant_id, created_at)`, `order(status)`.
- Menu ordering / sections (e.g. "Más pedidos", "Para chuparse los dedos") — schema pending definition of the new `restaurant-admin` requirement covering drag-and-drop ordering and menu sections.
