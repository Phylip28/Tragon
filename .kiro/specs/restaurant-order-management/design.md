# Diseño Técnico — Tragón: Gestión de Pedidos de Restaurante

## Introducción

Este documento describe el diseño técnico completo (alto y bajo nivel) del MVP de Tragón. El sistema automatiza la toma de pedidos para restaurantes mediante un bot de mensajería (Telegram), un frontend en Astro y un backend en Django REST Framework con PostgreSQL en AWS RDS.

**Stack tecnológico:**
- Frontend: Astro (SSR), Docker en AWS
- Backend: Django 4.x + Django REST Framework, instalado con `uv`, Docker en AWS
- Base de datos: PostgreSQL en AWS RDS
- Mensajería: Telegram Bot API (por defecto), WhatsApp (preparado, deshabilitado)
- Secretos: AWS Secrets Manager (namespaces separados: frontend / backend)
- Autenticación API: API Key en header HTTP (`X-Api-Key`)
- Pago: Bre-b (transferencia bancaria Colombia)
- Almacenamiento de imágenes: AWS S3

---

## Arquitectura de Alto Nivel

```
Cliente (navegador)
        │
        ▼
[Telegram Bot]  ──── genera link ───▶  [Frontend — Astro / Docker]
                                               │
                              HTTP REST + API Key
                                               │
                                               ▼
                                     [Backend — Django DRF / Docker]
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                    [PostgreSQL            [AWS S3]         [Telegram API]
                     AWS RDS]           (imágenes)         (notificaciones)
                          │
                    [AWS Secrets Manager]
                    (secretos backend)

[AWS Secrets Manager]
(secretos frontend)
```


### Flujo principal de un pedido

```
1. Cliente escribe al bot de Telegram del restaurante
2. Bot genera slug de sesión → construye URL → responde con link
3. Cliente abre link en navegador → Astro SSR renderiza el menú
4. Cliente navega menú, agrega ítems, selecciona toppings e indicaciones especiales
5. Cliente elige tipo de entrega y método de pago
6. Frontend POST /orders → Backend valida, persiste pedido
7. Backend envía notificación Telegram al restaurante
8. Frontend muestra pantalla de confirmación con número de referencia
```

---

## Diseño de la Base de Datos

### Modelo entidad-relación (simplificado)

```
Restaurant ──< Category ──< Product ──< Topping
Restaurant ──< Order ──< OrderItem ──< OrderItemTopping
Restaurant ──< SessionSlug
```

### Tablas

#### `restaurant`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | Identificador interno |
| slug | VARCHAR(50) UNIQUE NOT NULL | Identificador público inmutable |
| name | VARCHAR(200) | Nombre del restaurante |
| logo_url | TEXT | URL del logo en S3 |
| address | TEXT | Dirección física |
| breb_key | VARCHAR(200) | Llave Bre-b para transferencias |
| notification_channel | VARCHAR(20) | `telegram` o `whatsapp` |
| telegram_chat_id | VARCHAR(100) | Chat ID del restaurante en Telegram |
| whatsapp_number | VARCHAR(20) | Número WhatsApp (si aplica) |
| delivery_fee | DECIMAL(10,2) | Valor del domicilio |
| created_at | TIMESTAMPTZ | Fecha de creación |


#### `api_key`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| restaurant | FK → restaurant | Restaurante propietario |
| key_hash | VARCHAR(128) | Hash SHA-256 de la API Key |
| throttle_rate | VARCHAR(50) | Ej: `100/day`, `10/minute` |
| is_active | BOOLEAN | Estado de la clave |
| created_at | TIMESTAMPTZ | |

#### `session_slug`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| restaurant | FK → restaurant | |
| slug | VARCHAR(20) UNIQUE | Slug de sesión corto no consecutivo |
| telegram_user_id | VARCHAR(100) | ID del usuario en Telegram |
| expires_at | TIMESTAMPTZ | Expiración del link |
| created_at | TIMESTAMPTZ | |

#### `category`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| restaurant | FK → restaurant | |
| name | VARCHAR(200) | |
| sort_order | INTEGER | Orden de aparición |
| is_active | BOOLEAN | |

#### `product`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| category | FK → category | |
| name | VARCHAR(200) | |
| description | TEXT | Ingredientes / descripción |
| photo_url | TEXT | URL S3 de la foto |
| base_price | DECIMAL(10,2) | |
| sort_order | INTEGER | |
| is_active | BOOLEAN | |


#### `topping`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| product | FK → product | |
| name | VARCHAR(200) | |
| extra_price | DECIMAL(10,2) | |
| is_active | BOOLEAN | |

#### `order`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| reference_number | VARCHAR(20) UNIQUE | Número de referencia legible |
| restaurant | FK → restaurant | |
| session_slug | FK → session_slug | |
| delivery_type | VARCHAR(30) | `delivery`, `pickup`, `dine_in` |
| address_street_type | VARCHAR(50) | Tipo de vía (si domicilio) |
| address_road_number | VARCHAR(50) | Número de vía |
| address_cross_number | VARCHAR(50) | Número de cruce |
| address_building_number | VARCHAR(50) | Número de predio |
| address_neighborhood | VARCHAR(100) | Barrio |
| address_city | VARCHAR(100) | Ciudad |
| address_details | TEXT | Detalles adicionales |
| payment_method | VARCHAR(30) | `cash`, `transfer` |
| cash_denomination | DECIMAL(10,2) | Valor del billete (si efectivo) |
| subtotal | DECIMAL(10,2) | |
| delivery_fee | DECIMAL(10,2) | |
| total | DECIMAL(10,2) | |
| status | VARCHAR(30) | `pending`, `confirmed`, `cancelled` |
| notification_sent | BOOLEAN | |
| notification_error | TEXT | Error de notificación si hubo fallo |
| created_at | TIMESTAMPTZ | |

#### `order_item`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| order | FK → order | |
| product | FK → product | |
| product_snapshot | JSONB | Snapshot del producto al momento del pedido |
| special_instructions | TEXT | |
| unit_price | DECIMAL(10,2) | |
| total_price | DECIMAL(10,2) | base + toppings |

#### `order_item_topping`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| order_item | FK → order_item | |
| topping | FK → topping | |
| topping_snapshot | JSONB | Snapshot del topping |
| extra_price | DECIMAL(10,2) | |


---

## Diseño del Backend (Django DRF)

### Estructura de módulos

```
tragon_backend/
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── restaurants/      # Modelo Restaurant, APIKey, configuración
│   ├── catalog/          # Category, Product, Topping
│   ├── orders/           # Order, OrderItem, OrderItemTopping
│   ├── sessions/         # SessionSlug — generación y validación
│   ├── notifications/    # Envío de notificaciones Telegram/WhatsApp
│   └── bot/              # Handler del bot Telegram (webhook)
└── manage.py
```

### Gestión de secretos al arranque

```python
# config/settings/production.py
import boto3, json

def get_secret(secret_name: str) -> dict:
    client = boto3.client("secretsmanager")
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

_secrets = get_secret("tragon/backend")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": _secrets["DB_HOST"],
        "NAME": _secrets["DB_NAME"],
        "USER": _secrets["DB_USER"],
        "PASSWORD": _secrets["DB_PASSWORD"],
        "PORT": _secrets.get("DB_PORT", 5432),
    }
}

TELEGRAM_BOT_TOKEN = _secrets["TELEGRAM_BOT_TOKEN"]
AWS_S3_BUCKET = _secrets["S3_BUCKET"]
```

### Autenticación por API Key

```python
# apps/restaurants/authentication.py
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import hashlib

class APIKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        raw_key = request.headers.get("X-Api-Key")
        if not raw_key:
            return None  # permite que otros backends manejen
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        try:
            api_key = APIKey.objects.select_related("restaurant").get(
                key_hash=key_hash, is_active=True
            )
        except APIKey.DoesNotExist:
            raise AuthenticationFailed("API Key inválida.")
        return (api_key.restaurant, api_key)
```


### Throttling por restaurante

```python
# apps/restaurants/throttling.py
from rest_framework.throttling import BaseThrottle

class RestaurantAPIKeyThrottle(BaseThrottle):
    def get_cache_key(self, request, view):
        if hasattr(request, "auth") and request.auth:
            return f"throttle_apikey_{request.auth.id}"
        return None

    def get_rate(self):
        if hasattr(self.request, "auth") and self.request.auth:
            return self.request.auth.throttle_rate
        return "100/day"
```

### Endpoints de la API REST

#### Menú público

| Método | Path | Descripción |
|---|---|---|
| GET | `/api/v1/menu/{restaurant_slug}/` | Devuelve categorías + productos + toppings del restaurante |
| GET | `/api/v1/menu/{restaurant_slug}/categories/` | Lista paginada de categorías |
| GET | `/api/v1/menu/{restaurant_slug}/products/{product_id}/` | Detalle de producto con toppings |

#### Sesión

| Método | Path | Descripción |
|---|---|---|
| POST | `/api/v1/sessions/` | Crea un SessionSlug (llamado por el bot) |
| GET | `/api/v1/sessions/{session_slug}/` | Valida y devuelve restaurante asociado |

#### Pedidos

| Método | Path | Descripción |
|---|---|---|
| POST | `/api/v1/orders/` | Crea y persiste un pedido completo |
| GET | `/api/v1/orders/{reference_number}/` | Consulta un pedido por número de referencia |

#### Gestión del menú (Panel de administración)

| Método | Path | Descripción |
|---|---|---|
| GET/POST | `/api/v1/manage/categories/` | Listar / crear categorías |
| GET/PUT/PATCH/DELETE | `/api/v1/manage/categories/{id}/` | Editar / eliminar categoría |
| GET/POST | `/api/v1/manage/products/` | Listar / crear productos |
| GET/PUT/PATCH/DELETE | `/api/v1/manage/products/{id}/` | Editar / eliminar producto |
| GET/POST | `/api/v1/manage/products/{id}/toppings/` | Listar / crear toppings |
| GET/PUT/PATCH/DELETE | `/api/v1/manage/toppings/{id}/` | Editar / eliminar topping |
| POST | `/api/v1/manage/products/{id}/photo/` | Subir foto → S3 → devuelve URL |

#### Webhook del Bot

| Método | Path | Descripción |
|---|---|---|
| POST | `/api/v1/bot/telegram/webhook/` | Recibe updates de Telegram |


### Formato de respuesta del menú

```json
{
  "restaurant": {
    "slug": "la-fogata",
    "name": "La Fogata",
    "logo_url": "https://s3.../logo.png"
  },
  "categories": [
    {
      "id": "uuid",
      "name": "Hamburguesas",
      "sort_order": 1,
      "products": [
        {
          "id": "uuid",
          "name": "Hamburguesa Clásica",
          "description": "Carne, lechuga, tomate, queso",
          "photo_url": "https://s3.../hamburguesa.jpg",
          "base_price": "18000.00",
          "toppings": [
            { "id": "uuid", "name": "Bacon extra", "extra_price": "3000.00" },
            { "id": "uuid", "name": "Doble queso", "extra_price": "2000.00" }
          ]
        }
      ]
    }
  ]
}
```

### Formato de payload para crear pedido

```json
{
  "session_slug": "abc123",
  "delivery_type": "delivery",
  "address": {
    "street_type": "Calle",
    "road_number": "45",
    "cross_number": "23",
    "building_number": "12",
    "neighborhood": "Laureles",
    "city": "Medellín",
    "details": "Apartamento 301, portero nocturno"
  },
  "payment_method": "cash",
  "cash_denomination": 50000,
  "items": [
    {
      "product_id": "uuid",
      "topping_ids": ["uuid", "uuid"],
      "special_instructions": "Sin cebolla, carne bien cocida"
    }
  ]
}
```

### Lógica de creación de pedido

```python
# apps/orders/services.py
from django.db import transaction
from .models import Order, OrderItem, OrderItemTopping
from apps.notifications.tasks import send_order_notification

@transaction.atomic
def create_order(restaurant, session_slug, validated_data):
    # 1. Validar que todos los productos pertenezcan al restaurante
    product_ids = [item["product_id"] for item in validated_data["items"]]
    products = Product.objects.filter(id__in=product_ids, category__restaurant=restaurant)
    if products.count() != len(product_ids):
        raise ValidationError("Uno o más productos no pertenecen a este restaurante.")

    # 2. Calcular totales
    subtotal = sum(compute_item_total(item, products) for item in validated_data["items"])
    delivery_fee = restaurant.delivery_fee if validated_data["delivery_type"] == "delivery" else 0
    total = subtotal + delivery_fee

    # 3. Persistir pedido
    order = Order.objects.create(
        restaurant=restaurant,
        session_slug=session_slug,
        reference_number=generate_reference(),
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        total=total,
        **extract_order_fields(validated_data),
    )

    # 4. Crear ítems y toppings
    for item_data in validated_data["items"]:
        order_item = OrderItem.objects.create(order=order, ...)
        for topping_id in item_data.get("topping_ids", []):
            OrderItemTopping.objects.create(order_item=order_item, ...)

    # 5. Intentar enviar notificación (no bloquea si falla)
    try:
        send_order_notification(order)
    except Exception as e:
        order.notification_error = str(e)
        order.save(update_fields=["notification_error"])

    return order
```


### Servicio de notificaciones

```python
# apps/notifications/backends.py
from abc import ABC, abstractmethod

class NotificationBackend(ABC):
    @abstractmethod
    def send_order_notification(self, order) -> None: ...

class TelegramBackend(NotificationBackend):
    def send_order_notification(self, order) -> None:
        message = format_order_message(order)
        telegram_api.send_message(
            chat_id=order.restaurant.telegram_chat_id,
            text=message,
        )

class WhatsAppBackend(NotificationBackend):
    def send_order_notification(self, order) -> None:
        # Preparado pero deshabilitado en el MVP
        raise NotImplementedError("WhatsApp no habilitado en esta instancia.")

def get_notification_backend(restaurant) -> NotificationBackend:
    if restaurant.notification_channel == "whatsapp":
        return WhatsAppBackend()
    return TelegramBackend()
```

### Formato del mensaje de notificación

```
🍽 *Nuevo pedido — La Fogata*
📋 Referencia: #TRG-20240115-001

*Ítems:*
• Hamburguesa Clásica
  - Bacon extra (+$3.000)
  - Sin cebolla
• Pizza Margherita × 2

💰 Subtotal: $55.000
🛵 Domicilio: $5.000
💵 *Total: $60.000*

📦 Entrega: Domicilio
📍 Calle 45 # 23-12, Apt 301, Laureles, Medellín
💳 Pago: Efectivo — billete de $100.000
```

### Generación de SessionSlug

```python
# apps/sessions/utils.py
import secrets, string

SLUG_ALPHABET = string.ascii_lowercase + string.digits
SLUG_LENGTH = 8

def generate_session_slug() -> str:
    """Genera un slug de 8 caracteres usando secrets.choice para no-consecutividad."""
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(SLUG_LENGTH))
```

El slug de sesión tiene TTL de 24 horas. Una tarea periódica (cron o management command) limpia sesiones expiradas.

### Subida de imágenes a S3

```python
# apps/catalog/services.py
import boto3, uuid

def upload_product_photo(restaurant_slug: str, file_obj) -> str:
    s3 = boto3.client("s3")
    key = f"restaurants/{restaurant_slug}/products/{uuid.uuid4()}.jpg"
    s3.upload_fileobj(
        file_obj, settings.AWS_S3_BUCKET, key,
        ExtraArgs={"ContentType": "image/jpeg", "ACL": "public-read"},
    )
    return f"https://{settings.AWS_S3_BUCKET}.s3.amazonaws.com/{key}"
```


---

## Diseño del Bot de Telegram

### Flujo del webhook

```python
# apps/bot/handlers.py
from telegram import Update
from apps.sessions.utils import generate_session_slug
from apps.sessions.models import SessionSlug

def handle_message(update: Update, restaurant: Restaurant):
    slug = generate_session_slug()
    SessionSlug.objects.create(
        restaurant=restaurant,
        slug=slug,
        telegram_user_id=str(update.effective_user.id),
    )
    link = f"https://{settings.FRONTEND_HOST}/menu/{restaurant.slug}/{slug}"
    update.message.reply_text(
        f"👋 ¡Hola! Aquí está tu link para hacer tu pedido:\n{link}"
    )
```

El bot se registra como webhook en Telegram apuntando a `/api/v1/bot/telegram/webhook/`. El secreto del token se valida en el header `X-Telegram-Bot-Api-Secret-Token`.

---

## Diseño del Frontend (Astro SSR)

### Estructura de rutas

```
src/
├── pages/
│   ├── menu/
│   │   └── [restaurantSlug]/
│   │       └── [sessionSlug].astro     # Página principal del menú
│   ├── manage/
│   │   └── [restaurantSlug]/
│   │       └── index.astro             # Panel de gestión (ruta protegida)
│   └── 404.astro
├── components/
│   ├── menu/
│   │   ├── MenuPage.tsx                # Página del menú (React island)
│   │   ├── CategorySection.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ProductDetail.tsx           # Modal de detalle
│   │   ├── OrderBar.tsx                # Barra inferior con contador y botones
│   │   └── CartStore.ts                # Estado del carrito (nanostores)
│   ├── checkout/
│   │   ├── DeliveryTypeStep.tsx
│   │   ├── AddressForm.tsx
│   │   ├── PaymentMethodStep.tsx
│   │   └── ConfirmationScreen.tsx
│   └── manage/
│       ├── CategoryManager.tsx
│       ├── ProductManager.tsx
│       └── ToppingManager.tsx
└── lib/
    ├── api.ts                          # Cliente HTTP hacia el Backend
    └── secrets.ts                      # Lectura de secretos desde Secrets Manager
```

### Estado del carrito (nanostores)

```typescript
// components/menu/CartStore.ts
import { atom, map } from "nanostores";

export interface CartItem {
  id: string;          // UUID temporal del ítem en el carrito
  productId: string;
  productName: string;
  toppingIds: string[];
  specialInstructions: string;
  unitPrice: number;
  totalPrice: number;
}

export const cartItems = atom<CartItem[]>([]);

export function addItem(item: Omit<CartItem, "id">): void {
  cartItems.set([...cartItems.get(), { ...item, id: crypto.randomUUID() }]);
}

export function clearCart(): void {
  cartItems.set([]);
}

export function totalItemCount(): number {
  return cartItems.get().length;
}
```


### Lectura de secretos en el frontend

```typescript
// lib/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let _cachedSecrets: Record<string, string> | null = null;

export async function getFrontendSecrets(): Promise<Record<string, string>> {
  if (_cachedSecrets) return _cachedSecrets;
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const cmd = new GetSecretValueCommand({ SecretId: "tragon/frontend" });
  const res = await client.send(cmd);
  _cachedSecrets = JSON.parse(res.SecretString!);
  return _cachedSecrets;
}
```

### SSR: carga del menú

```typescript
// pages/menu/[restaurantSlug]/[sessionSlug].astro
---
import { getFrontendSecrets } from "@/lib/secrets";
import { fetchMenu, validateSession } from "@/lib/api";

const { restaurantSlug, sessionSlug } = Astro.params;
const secrets = await getFrontendSecrets();

// Validar sesión
const session = await validateSession(sessionSlug, secrets.BACKEND_API_KEY);
if (!session.valid) {
  return Astro.redirect("/404");
}

// Cargar menú
const menu = await fetchMenu(restaurantSlug, secrets.BACKEND_API_KEY);
---
<MenuPage client:load menu={menu} sessionSlug={sessionSlug} />
```

### Formulario de dirección colombiana

Campos y validación:

```typescript
// components/checkout/AddressForm.tsx
const STREET_TYPES = ["Calle", "Carrera", "Avenida", "Diagonal", "Transversal", "Circular"];

interface ColombianAddress {
  streetType: string;       // obligatorio
  roadNumber: string;       // obligatorio — ej: "45"
  crossNumber: string;      // obligatorio — ej: "23"
  buildingNumber: string;   // obligatorio — ej: "12"
  neighborhood: string;     // obligatorio
  city: string;             // obligatorio
  details: string;          // opcional — ej: "Apto 301"
}

function validateAddress(addr: Partial<ColombianAddress>): string[] {
  const required: (keyof ColombianAddress)[] = [
    "streetType", "roadNumber", "crossNumber", "buildingNumber", "neighborhood", "city"
  ];
  return required.filter(f => !addr[f]?.trim());
}
```

### Cliente HTTP hacia el Backend

```typescript
// lib/api.ts
const BASE_URL = import.meta.env.BACKEND_URL;

async function apiFetch<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new APIError(res.status, body);
  }
  return res.json();
}

export const fetchMenu = (slug: string, key: string) =>
  apiFetch(`/api/v1/menu/${slug}/`, key);

export const validateSession = (slug: string, key: string) =>
  apiFetch(`/api/v1/sessions/${slug}/`, key);

export const createOrder = (payload: OrderPayload, key: string) =>
  apiFetch("/api/v1/orders/", key, { method: "POST", body: JSON.stringify(payload) });
```


---

## Manejo de Errores

| Escenario | Comportamiento |
|---|---|
| SessionSlug inválido o expirado | Frontend redirige a pantalla de error con mensaje claro |
| API Key ausente o inválida | Backend retorna HTTP 401 |
| Producto de otro restaurante en el pedido | Backend retorna HTTP 400 con detalle del campo |
| Campos de dirección incompletos | Frontend bloquea avance y resalta campos faltantes |
| Fallo al enviar notificación Telegram | Backend persiste el pedido, registra el error, retorna 201 |
| Error de S3 al subir foto | Backend retorna HTTP 500 con mensaje de error; el admin reintenta |
| Throttle excedido | Backend retorna HTTP 429 |
| Error de RDS | Backend retorna HTTP 500; la transacción atómica no persiste datos parciales |

---

## Infraestructura y Despliegue

### Estructura de contenedores

```
# docker-compose.yml (desarrollo)
services:
  backend:
    build: ./backend
    environment:
      DJANGO_SETTINGS_MODULE: config.settings.development
    ports: ["8000:8000"]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: tragon
      POSTGRES_USER: tragon
      POSTGRES_PASSWORD: tragon
```

### Dockerfile — Backend

```dockerfile
FROM python:3.12-slim
RUN pip install uv
WORKDIR /app
COPY pyproject.toml .
RUN uv sync --frozen
COPY . .
CMD ["uv", "run", "gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

### Dockerfile — Frontend

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "./dist/server/entry.mjs"]
```

### Separación de secretos en AWS Secrets Manager

| Secret Name | Contenido | Consumidor |
|---|---|---|
| `tragon/backend` | DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, TELEGRAM_BOT_TOKEN, S3_BUCKET | Backend |
| `tragon/frontend` | BACKEND_API_KEY, BACKEND_URL | Frontend |


---

## Propiedades de Correctitud

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero a través de todas las ejecuciones válidas del sistema — esencialmente, un enunciado formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de correctitud verificables automáticamente.*

---

### Propiedad 1: Unicidad de slugs de sesión

*Para cualquier* conjunto de N mensajes recibidos por el bot (de uno o múltiples usuarios), los slugs de sesión generados deben ser distintos entre sí y no deben seguir un patrón secuencial predecible.

**Validates: Requirements 1.1**

---

### Propiedad 2: Links de sesión inválidos producen error

*Para cualquier* slug de sesión que no exista en la base de datos o que haya expirado, el backend debe retornar un error al validarlo (sesión no encontrada / expirada).

**Validates: Requirements 1.4**

---

### Propiedad 3: Aislamiento multi-restaurante

*Para cualquier* par de restaurantes A y B con sus respectivas API Keys, una petición autenticada con la API Key de A no debe retornar ni modificar ningún recurso (categorías, productos, toppings, pedidos) que pertenezca al restaurante B.

**Validates: Requirements 8.1, 8.2, 8.3**

---

### Propiedad 4: El menú devuelve exactamente los datos del restaurante solicitado

*Para cualquier* restaurante con cualquier configuración de menú, la respuesta de `/api/v1/menu/{slug}/` debe contener exactamente todas las categorías activas del restaurante, cada una con exactamente sus productos activos y los toppings activos de cada producto — sin datos de otros restaurantes.

**Validates: Requirements 2.1, 2.2, 7.5**

---

### Propiedad 5: Round-trip de persistencia del pedido

*Para cualquier* pedido válido con cualquier combinación de ítems, toppings, indicaciones especiales, tipo de entrega, datos de dirección y método de pago, los datos recuperados de la base de datos después de la creación deben ser iguales a los datos enviados en el payload original.

**Validates: Requirements 6.1**

---

### Propiedad 6: La notificación incluye todos los campos del pedido

*Para cualquier* pedido confirmado con cualquier combinación de ítems y opciones, el mensaje de notificación generado debe contener: la lista completa de ítems con sus toppings e indicaciones especiales, el tipo de entrega, la dirección si aplica, el método de pago y el total.

**Validates: Requirements 6.3**

---

### Propiedad 7: Resiliencia ante fallo de notificación

*Para cualquier* tipo de error que ocurra durante el envío de la notificación al restaurante, el backend debe: (a) persistir el pedido sin modificaciones, (b) registrar el error, y (c) retornar una respuesta de éxito (HTTP 201) al frontend.

**Validates: Requirements 6.5**

---

### Propiedad 8: Autenticación requerida en todos los endpoints

*Para cualquier* endpoint de la API y *para cualquier* petición que no incluya una API Key válida en el header `X-Api-Key`, la respuesta debe ser HTTP 401.

**Validates: Requirements 7.1, 7.2**

---

### Propiedad 9: Throttling aplicado por API Key

*Para cualquier* API Key con un límite de tasa configurado N, si se realizan N+1 peticiones en el período de tiempo definido, la petición N+1 debe retornar HTTP 429.

**Validates: Requirements 7.3**

---

### Propiedad 10: Validación de propiedad de productos en el pedido

*Para cualquier* pedido que incluya al menos un producto que no pertenezca al restaurante del slug de la sesión, la API debe retornar HTTP 400 con un mensaje descriptivo del error, sin persistir ningún dato del pedido.

**Validates: Requirements 7.6, 7.7**

---

### Propiedad 11: Paginación en endpoints de lista

*Para cualquier* endpoint de lista de la API con cualquier cantidad de resultados (incluyendo cero), la respuesta debe incluir los campos `count`, `next` y `previous`.

**Validates: Requirements 7.4**

---

### Propiedad 12: Round-trip de configuración del restaurante

*Para cualquier* restaurante y cualquier combinación válida de campos de configuración (nombre, logo, dirección, llave Bre-b, canal de notificaciones, valor de domicilio), los datos leídos después de la persistencia deben ser iguales a los datos escritos.

**Validates: Requirements 8.4**

---

### Propiedad 13: Round-trip de CRUD del menú

*Para cualquier* categoría, producto o topping creado a través de los endpoints de gestión, (a) debe aparecer en la consulta posterior de la lista, (b) después de editarlo, la consulta debe reflejar los nuevos valores, y (c) después de eliminarlo, no debe aparecer en la lista.

**Validates: Requirements 9.3, 9.4, 9.5**

---

### Propiedad 14: Adición de ítems al carrito — acumulación independiente

*Para cualquier* producto agregado N veces al carrito (potencialmente con diferentes toppings e indicaciones), el estado del carrito debe contener exactamente N ítems independientes para ese producto, cada uno preservando sus propios toppings e indicaciones especiales.

**Validates: Requirements 3.4, 3.6**

---

### Propiedad 15: Cancelar en pantalla de detalle no modifica el pedido

*Para cualquier* estado del carrito con cualquier número de ítems, si el usuario abre el detalle de un producto, selecciona toppings e indicaciones y presiona "Cancelar", el carrito debe permanecer en exactamente el mismo estado que tenía antes de abrir el detalle.

**Validates: Requirements 3.5**

---

### Propiedad 16: Cancelar pedido vacía el carrito

*Para cualquier* estado del carrito (incluyendo carrito vacío), al presionar "Cancelar pedido", el carrito debe quedar con cero ítems.

**Validates: Requirements 2.6**

---

### Propiedad 17: Validación de formulario de dirección incompleto

*Para cualquier* subconjunto de los campos obligatorios de la dirección que estén vacíos o en blanco, el intento de avanzar al siguiente paso debe ser bloqueado y los campos faltantes deben quedar visualmente resaltados.

**Validates: Requirements 4.5**

---

### Propiedad 18: Inmutabilidad del slug del restaurante

*Para cualquier* restaurante existente, un intento de modificar su slug a través de la API debe ser rechazado o ignorado, preservando el slug original.

**Validates: Requirements 8.1**

