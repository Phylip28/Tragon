# Plan de Implementación: Tragón — Gestión de Pedidos de Restaurante

## Descripción General

Implementación incremental del MVP de Tragón. El plan sigue el orden natural de dependencias: infraestructura base → modelos → autenticación → menú público → sesiones → bot → pedidos → notificaciones → frontend → panel de gestión → despliegue. Cada tarea construye sobre la anterior y termina con la integración completa del flujo.

## Convención de Ramas y Commits

Cada tarea de nivel superior se implementa en su propia rama Git:

| Tarea | Rama | Commit de merge |
|-------|------|-----------------|
| 1 | `feat/TRA-01/backend-setup` | `feat(backend): project structure and settings` |
| 2 | `feat/TRA-02/database-models` | `feat(backend): all database models and migrations` |
| 3 | `feat/TRA-03/django-admin` | `feat(backend): register all models in django admin` |
| 4 | `feat/TRA-04/api-key-auth` | `feat(backend): api key authentication and throttling` |
| 5 | `feat/TRA-05/catalog-api` | `feat(backend): catalog endpoints and menu public api` |
| 7 | `feat/TRA-07/sessions` | `feat(backend): session slug generation and validation` |
| 8 | `feat/TRA-08/telegram-bot` | `feat(backend): telegram bot webhook and handler` |
| 9 | `feat/TRA-09/notifications` | `feat(backend): notification backends and message formatter` |
| 10 | `feat/TRA-10/orders-api` | `feat(backend): order creation service and api` |
| 12 | `feat/TRA-12/manage-api` | `feat(backend): menu management crud endpoints and s3 upload` |
| 13 | `feat/TRA-13/restaurant-invariants` | `feat(backend): slug immutability and restaurant config validation` |
| 14 | `feat/TRA-14/frontend-setup` | `feat(frontend): astro project structure and secrets` |
| 15 | `feat/TRA-15/cart-store` | `feat(frontend): http client and cart store` |
| 16 | `feat/TRA-16/menu-page` | `feat(frontend): ssr menu page and product components` |
| 17 | `feat/TRA-17/checkout-flow` | `feat(frontend): checkout flow delivery address and payment` |
| 19 | `feat/TRA-19/manage-panel` | `feat(frontend): restaurant menu management panel` |
| 20 | `feat/TRA-20/docker` | `feat(infra): dockerfiles and docker-compose for dev` |
| 21 | `feat/TRA-21/integration` | `feat(infra): url wiring init script and project docs` |

Las tareas de checkpoints (6, 11, 18, 22) no tienen rama propia — se ejecutan en la rama de la tarea anterior antes del merge.

Las sub-tareas marcadas con `*` (property tests) se implementan en la misma rama que su tarea padre.

---

## Tareas

- [ ] 1. Configurar estructura del proyecto backend
  - Crear el directorio `tragon_backend/` con la estructura de módulos: `config/settings/`, `apps/restaurants/`, `apps/catalog/`, `apps/orders/`, `apps/sessions/`, `apps/notifications/`, `apps/bot/`
  - Crear `pyproject.toml` con dependencias: Django 4.x, djangorestframework, psycopg2-binary, boto3, python-telegram-bot, gunicorn, hypothesis
  - Crear `config/settings/base.py`, `development.py` y `production.py` con la lógica de lectura de secretos desde AWS Secrets Manager en producción
  - Registrar todas las apps en `INSTALLED_APPS`
  - Crear `config/urls.py` con el prefijo `/api/v1/`
  - Crear `manage.py` y `config/wsgi.py`
  - _Requerimientos: 10.1, 10.2, 10.4, 10.6_

- [ ] 2. Implementar modelos de base de datos
  - [ ] 2.1 Implementar modelos `Restaurant` y `APIKey` en `apps/restaurants/models.py`
    - Campos UUID como PK, slug único, campos de configuración, `key_hash`, `throttle_rate`, `is_active`
    - _Requerimientos: 8.1, 8.4, 7.1_

  - [ ] 2.2 Implementar modelos `Category`, `Product` y `Topping` en `apps/catalog/models.py`
    - FK encadenadas `Category → Restaurant`, `Product → Category`, `Topping → Product`
    - Campos `sort_order`, `is_active`, `photo_url`, `base_price`, `extra_price`
    - _Requerimientos: 2.1, 2.2, 3.1, 3.2, 9.3, 9.4, 9.5_

  - [ ] 2.3 Implementar modelo `SessionSlug` en `apps/sessions/models.py`
    - Campos: `restaurant FK`, `slug VARCHAR(20) UNIQUE`, `telegram_user_id`, `expires_at`, `created_at`
    - _Requerimientos: 1.1, 1.4_

  - [ ] 2.4 Implementar modelos `Order`, `OrderItem` y `OrderItemTopping` en `apps/orders/models.py`
    - Todos los campos descritos en el diseño: `delivery_type`, campos de dirección, `payment_method`, `cash_denomination`, `subtotal`, `delivery_fee`, `total`, `status`, `notification_sent`, `notification_error`
    - Campos JSONB `product_snapshot` y `topping_snapshot`
    - _Requerimientos: 6.1, 4.1, 4.3, 5.1_

  - [ ] 2.5 Crear y ejecutar migraciones para todos los modelos
    - Generar migraciones con `manage.py makemigrations`
    - _Requerimientos: 10.6_

- [ ] 3. Registrar modelos en Django Admin
  - Crear `admin.py` en cada app registrando todos los modelos del sistema
  - _Requerimientos: 10.1_

- [ ] 4. Implementar autenticación y throttling por API Key
  - [ ] 4.1 Implementar `APIKeyAuthentication` en `apps/restaurants/authentication.py`
    - Leer header `X-Api-Key`, calcular SHA-256, buscar en `APIKey`, retornar `(restaurant, api_key)` o `AuthenticationFailed` con HTTP 401
    - Configurar como backend de autenticación en `settings/base.py`
    - _Requerimientos: 7.1, 7.2_

  - [ ]* 4.2 Escribir property test para autenticación (Propiedad 8)
    - **Propiedad 8: Autenticación requerida en todos los endpoints**
    - **Valida: Requerimientos 7.1, 7.2**
    - Para cualquier endpoint y cualquier petición sin API Key válida, la respuesta debe ser HTTP 401

  - [ ] 4.3 Implementar `RestaurantAPIKeyThrottle` en `apps/restaurants/throttling.py`
    - Usar `throttle_rate` del `APIKey` autenticado como tasa dinámica por restaurante
    - _Requerimientos: 7.3_

  - [ ]* 4.4 Escribir property test para throttling (Propiedad 9)
    - **Propiedad 9: Throttling aplicado por API Key**
    - **Valida: Requerimientos 7.3**
    - Para N+1 peticiones con límite N, la petición N+1 debe retornar HTTP 429

- [ ] 5. Implementar app de catálogo (menú público)
  - [ ] 5.1 Implementar serializers para `Category`, `Product` y `Topping` en `apps/catalog/serializers.py`
    - `MenuSerializer` anidado: categorías → productos → toppings, solo registros `is_active=True`
    - _Requerimientos: 2.1, 2.2, 7.5_

  - [ ] 5.2 Implementar vistas y URLs de menú público
    - `GET /api/v1/menu/{restaurant_slug}/` con filtrado por slug del restaurante
    - `GET /api/v1/menu/{restaurant_slug}/categories/` paginado
    - `GET /api/v1/menu/{restaurant_slug}/products/{product_id}/` con toppings
    - Filtrar automáticamente por el restaurante de la API Key
    - _Requerimientos: 7.5, 8.2, 8.3_

  - [ ]* 5.3 Escribir property test para contenido del menú (Propiedad 4)
    - **Propiedad 4: El menú devuelve exactamente los datos del restaurante solicitado**
    - **Valida: Requerimientos 2.1, 2.2, 7.5**
    - La respuesta debe contener exactamente las categorías/productos/toppings activos del restaurante, sin datos de otros

  - [ ]* 5.4 Escribir property test para aislamiento multi-restaurante (Propiedad 3)
    - **Propiedad 3: Aislamiento multi-restaurante**
    - **Valida: Requerimientos 8.1, 8.2, 8.3**
    - Una petición con API Key del restaurante A no debe retornar ni modificar recursos del restaurante B

  - [ ]* 5.5 Escribir property test para paginación (Propiedad 11)
    - **Propiedad 11: Paginación en endpoints de lista**
    - **Valida: Requerimientos 7.4**
    - Todo endpoint de lista debe incluir `count`, `next` y `previous` en la respuesta

- [ ] 6. Checkpoint — Verificar autenticación y menú
  - Asegurar que todos los tests pasan. Preguntar al usuario si hay dudas antes de continuar.

- [ ] 7. Implementar app de sesiones
  - [ ] 7.1 Implementar `generate_session_slug()` en `apps/sessions/utils.py`
    - Usar `secrets.choice` con alfabeto alfanumérico en minúsculas, longitud 8
    - _Requerimientos: 1.1_

  - [ ]* 7.2 Escribir property test para unicidad de slugs (Propiedad 1)
    - **Propiedad 1: Unicidad de slugs de sesión**
    - **Valida: Requerimientos 1.1**
    - Para N slugs generados, todos deben ser distintos entre sí y sin patrón secuencial predecible

  - [ ] 7.3 Implementar management command para limpiar sesiones expiradas
    - Eliminar `SessionSlug` con `expires_at < now()`, ejecutable como tarea periódica
    - _Requerimientos: 1.4_

  - [ ] 7.4 Implementar vistas y URLs de sesiones
    - `POST /api/v1/sessions/` — crear `SessionSlug` con TTL de 24 horas
    - `GET /api/v1/sessions/{session_slug}/` — validar y devolver restaurante asociado; HTTP 404 si no existe o expirado
    - _Requerimientos: 1.1, 1.4_

  - [ ]* 7.5 Escribir property test para sesiones inválidas (Propiedad 2)
    - **Propiedad 2: Links de sesión inválidos producen error**
    - **Valida: Requerimientos 1.4**
    - Cualquier slug inexistente o expirado debe retornar error (404/400)

- [ ] 8. Implementar bot de Telegram
  - [ ] 8.1 Implementar handler de mensajes en `apps/bot/handlers.py`
    - Recibir `Update` de Telegram, generar `SessionSlug`, construir link y responder al usuario
    - _Requerimientos: 1.1, 1.2, 1.5_

  - [ ] 8.2 Implementar vista webhook en `apps/bot/views.py`
    - `POST /api/v1/bot/telegram/webhook/` — validar header `X-Telegram-Bot-Api-Secret-Token`, despachar a handler
    - _Requerimientos: 1.5_

  - [ ] 8.3 Registrar URLs del bot en `config/urls.py`
    - _Requerimientos: 1.5_

- [ ] 9. Implementar servicio de notificaciones
  - [ ] 9.1 Implementar backends de notificación en `apps/notifications/backends.py`
    - Clase abstracta `NotificationBackend` con método `send_order_notification`
    - `TelegramBackend`: formatear mensaje y enviar via `telegram_api.send_message`
    - `WhatsAppBackend`: stub que lanza `NotImplementedError`
    - `get_notification_backend(restaurant)` como factory
    - _Requerimientos: 6.4, 6.5, 1.6_

  - [ ] 9.2 Implementar `format_order_message(order)` en `apps/notifications/formatters.py`
    - Generar el mensaje con emojis, ítems, toppings, indicaciones, tipo de entrega, dirección, pago y total
    - _Requerimientos: 6.3_

  - [ ]* 9.3 Escribir property test para contenido de notificación (Propiedad 6)
    - **Propiedad 6: La notificación incluye todos los campos del pedido**
    - **Valida: Requerimientos 6.3**
    - Para cualquier pedido confirmado, el mensaje debe contener todos los ítems, toppings, indicaciones, entrega, dirección, pago y total

- [ ] 10. Implementar servicio y API de pedidos
  - [ ] 10.1 Implementar `create_order()` en `apps/orders/services.py`
    - Transacción atómica: validar productos del restaurante, calcular totales, persistir `Order` + `OrderItem` + `OrderItemTopping` con snapshots JSONB, intentar notificación sin bloquear
    - _Requerimientos: 6.1, 6.2, 7.6_

  - [ ]* 10.2 Escribir property test para round-trip de persistencia (Propiedad 5)
    - **Propiedad 5: Round-trip de persistencia del pedido**
    - **Valida: Requerimientos 6.1**
    - Para cualquier pedido válido, los datos recuperados de BD deben ser iguales a los enviados en el payload

  - [ ]* 10.3 Escribir property test para resiliencia ante fallo de notificación (Propiedad 7)
    - **Propiedad 7: Resiliencia ante fallo de notificación**
    - **Valida: Requerimientos 6.5**
    - Ante cualquier error de notificación: pedido persiste, error se registra, respuesta es HTTP 201

  - [ ]* 10.4 Escribir property test para validación de productos (Propiedad 10)
    - **Propiedad 10: Validación de propiedad de productos en el pedido**
    - **Valida: Requerimientos 7.6, 7.7**
    - Un pedido con producto de otro restaurante retorna HTTP 400, sin persistir ningún dato

  - [ ] 10.5 Implementar serializers y vistas de pedidos
    - `OrderCreateSerializer` con validación de `session_slug`, `items`, campos de dirección y pago
    - `POST /api/v1/orders/` — llama a `create_order()`, retorna 201 con referencia
    - `GET /api/v1/orders/{reference_number}/` — consulta por número de referencia
    - _Requerimientos: 6.6, 7.7_

- [ ] 11. Checkpoint — Verificar flujo completo de pedido
  - Asegurar que todos los tests pasan incluyendo los de pedidos y notificaciones. Preguntar al usuario si hay dudas.

- [ ] 12. Implementar endpoints de gestión del menú (Panel Admin)
  - [ ] 12.1 Implementar serializers de gestión en `apps/catalog/serializers.py`
    - `CategoryManageSerializer`, `ProductManageSerializer`, `ToppingManageSerializer`
    - _Requerimientos: 9.3, 9.4, 9.5_

  - [ ] 12.2 Implementar vistas CRUD de categorías, productos y toppings
    - `GET/POST /api/v1/manage/categories/`, `GET/PUT/PATCH/DELETE /api/v1/manage/categories/{id}/`
    - `GET/POST /api/v1/manage/products/`, `GET/PUT/PATCH/DELETE /api/v1/manage/products/{id}/`
    - `GET/POST /api/v1/manage/products/{id}/toppings/`, `GET/PUT/PATCH/DELETE /api/v1/manage/toppings/{id}/`
    - Filtrar siempre por restaurante de la API Key autenticada
    - _Requerimientos: 9.2, 9.3, 9.4, 9.5, 9.7, 8.2_

  - [ ]* 12.3 Escribir property test para CRUD del menú (Propiedad 13)
    - **Propiedad 13: Round-trip de CRUD del menú**
    - **Valida: Requerimientos 9.3, 9.4, 9.5**
    - Crear un recurso → aparece en lista; editarlo → refleja nuevos valores; eliminarlo → no aparece en lista

  - [ ] 12.4 Implementar subida de fotos a S3 en `apps/catalog/services.py`
    - `upload_product_photo(restaurant_slug, file_obj)` → sube a S3, retorna URL pública
    - Vista `POST /api/v1/manage/products/{id}/photo/` que llama al servicio
    - _Requerimientos: 9.6, 9.7_

- [ ] 13. Implementar validación de inmutabilidad del slug e invariantes del restaurante
  - [ ] 13.1 Agregar validación en serializer/vista para rechazar cambios al slug del restaurante
    - _Requerimientos: 8.1_

  - [ ]* 13.2 Escribir property test para inmutabilidad del slug (Propiedad 18)
    - **Propiedad 18: Inmutabilidad del slug del restaurante**
    - **Valida: Requerimientos 8.1**
    - Cualquier intento de modificar el slug debe ser rechazado o ignorado

  - [ ]* 13.3 Escribir property test para round-trip de configuración del restaurante (Propiedad 12)
    - **Propiedad 12: Round-trip de configuración del restaurante**
    - **Valida: Requerimientos 8.4**
    - Para cualquier combinación válida de campos de configuración, los datos leídos tras persistir deben ser iguales a los escritos

- [ ] 14. Configurar proyecto frontend Astro
  - Crear estructura `src/pages/`, `src/components/menu/`, `src/components/checkout/`, `src/components/manage/`, `src/lib/`
  - Configurar `astro.config.mjs` con modo SSR y adaptador de Node
  - Instalar dependencias: `nanostores`, `@nanostores/react`, `@aws-sdk/client-secrets-manager`
  - Crear `src/lib/secrets.ts` con `getFrontendSecrets()` con caché en módulo
  - _Requerimientos: 10.3, 10.5_

- [ ] 15. Implementar cliente HTTP y estado del carrito
  - [ ] 15.1 Implementar `src/lib/api.ts`
    - `apiFetch<T>()` con header `X-Api-Key`, manejo de errores con clase `APIError`
    - Exportar `fetchMenu`, `validateSession`, `createOrder`
    - _Requerimientos: 7.1_

  - [ ] 15.2 Implementar `src/components/menu/CartStore.ts`
    - `cartItems` como atom de nanostores, tipo `CartItem` con UUID temporal
    - Funciones `addItem()`, `clearCart()`, `totalItemCount()`
    - _Requerimientos: 2.4, 2.6, 3.4, 3.6_

  - [ ]* 15.3 Escribir property test para acumulación de ítems en carrito (Propiedad 14)
    - **Propiedad 14: Adición de ítems al carrito — acumulación independiente**
    - **Valida: Requerimientos 3.4, 3.6**
    - Agregar el mismo producto N veces genera exactamente N ítems independientes con sus propios toppings e indicaciones

  - [ ]* 15.4 Escribir property test para cancelar en detalle no modifica carrito (Propiedad 15)
    - **Propiedad 15: Cancelar en pantalla de detalle no modifica el pedido**
    - **Valida: Requerimientos 3.5**
    - Abrir detalle, seleccionar toppings, presionar "Cancelar" → carrito permanece en el mismo estado previo

  - [ ]* 15.5 Escribir property test para cancelar pedido vacía el carrito (Propiedad 16)
    - **Propiedad 16: Cancelar pedido vacía el carrito**
    - **Valida: Requerimientos 2.6**
    - Para cualquier estado del carrito, presionar "Cancelar pedido" resulta en cero ítems

- [ ] 16. Implementar página del menú (SSR + componentes React)
  - [ ] 16.1 Crear `src/pages/menu/[restaurantSlug]/[sessionSlug].astro`
    - Llamar `validateSession` y `fetchMenu` en el servidor, redirigir a 404 si la sesión es inválida
    - Pasar `menu` y `sessionSlug` como props al componente React
    - _Requerimientos: 1.3, 1.4, 2.1_

  - [ ] 16.2 Implementar `MenuPage.tsx`, `CategorySection.tsx` y `ProductCard.tsx`
    - Mostrar menú separado por categorías con foto y nombre de cada producto
    - Al hacer click en foto/nombre, navegar a detalle del producto
    - _Requerimientos: 2.1, 2.2, 2.3_

  - [ ] 16.3 Implementar `OrderBar.tsx`
    - Mostrar contador de productos seleccionados (cuando > 0) y botones "Cancelar pedido" / "Pagar"
    - "Cancelar pedido" llama `clearCart()` y regresa al estado inicial
    - _Requerimientos: 2.4, 2.5, 2.6_

  - [ ] 16.4 Implementar `ProductDetail.tsx` (modal de detalle)
    - Mostrar foto, nombre, descripción/ingredientes, lista de toppings con precios, campo de texto libre para indicaciones especiales
    - Botón "Aceptar" llama `addItem()` y cierra el modal; botón "Cancelar" descarta cambios sin modificar el carrito
    - _Requerimientos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 17. Implementar flujo de pago (checkout)
  - [ ] 17.1 Implementar `DeliveryTypeStep.tsx`
    - Mostrar opciones: domicilio, recoger en establecimiento, consumir en el local
    - Si "recoger" o "consumir en local", mostrar dirección del restaurante y mini mapa
    - _Requerimientos: 4.1, 4.4_

  - [ ] 17.2 Implementar `AddressForm.tsx`
    - Campos: tipo de vía (select con `STREET_TYPES`), número de vía, número de cruce, número de predio, barrio, ciudad, detalles adicionales
    - `validateAddress()` bloquea avance y resalta campos faltantes si hay obligatorios vacíos
    - _Requerimientos: 4.2, 4.3, 4.5_

  - [ ]* 17.3 Escribir property test para validación de dirección incompleta (Propiedad 17)
    - **Propiedad 17: Validación de formulario de dirección incompleto**
    - **Valida: Requerimientos 4.5**
    - Para cualquier subconjunto de campos obligatorios vacíos, el avance debe ser bloqueado y los campos resaltados

  - [ ] 17.4 Implementar `PaymentMethodStep.tsx`
    - Modal con opciones: efectivo y transferencia
    - Efectivo: mostrar total, valor de domicilio separado, campo para billete; bloquear confirmación si billete está vacío
    - Transferencia: mostrar llave Bre-b, valor, domicilio y botón "Copiar llave al portapapeles"
    - _Requerimientos: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 17.5 Implementar `ConfirmationScreen.tsx`
    - Llamar `createOrder()` con el payload completo al confirmar
    - Mostrar resumen del pedido y número de referencia tras confirmación exitosa
    - _Requerimientos: 6.6_

- [ ] 18. Checkpoint — Verificar flujo completo del frontend
  - Asegurar que todos los tests del frontend pasan. Preguntar al usuario si hay dudas.

- [ ] 19. Implementar Panel de Gestión del menú (frontend)
  - [ ] 19.1 Crear `src/pages/manage/[restaurantSlug]/index.astro`
    - Ruta protegida del restaurante, cargar categorías y productos actuales al renderizar
    - _Requerimientos: 9.1, 9.2_

  - [ ] 19.2 Implementar `CategoryManager.tsx`
    - CRUD de categorías: crear, editar nombre y orden, eliminar
    - Llamar endpoints `GET/POST /api/v1/manage/categories/` y `PUT/DELETE /api/v1/manage/categories/{id}/`
    - _Requerimientos: 9.3_

  - [ ] 19.3 Implementar `ProductManager.tsx`
    - CRUD de productos: crear, editar (nombre, descripción, precio base, foto), eliminar
    - Subida de foto con `POST /api/v1/manage/products/{id}/photo/`, mostrar URL devuelta
    - _Requerimientos: 9.4, 9.6_

  - [ ] 19.4 Implementar `ToppingManager.tsx`
    - CRUD de toppings: crear, editar (nombre, precio adicional), eliminar
    - Asociados a un producto seleccionado
    - _Requerimientos: 9.5_

- [ ] 20. Configurar infraestructura Docker
  - [ ] 20.1 Crear `Dockerfile` del backend
    - Imagen base `python:3.12-slim`, instalar `uv`, sincronizar dependencias, CMD con gunicorn
    - _Requerimientos: 10.4_

  - [ ] 20.2 Crear `Dockerfile` del frontend
    - Build multi-stage: `node:20-alpine` builder + imagen final, exponer puerto 3000
    - _Requerimientos: 10.5_

  - [ ] 20.3 Crear `docker-compose.yml` para desarrollo
    - Servicios: `backend` (puerto 8000), `frontend` (puerto 3000), `db` (postgres:16)
    - Variables de entorno para desarrollo local sin Secrets Manager
    - _Requerimientos: 10.4, 10.5, 10.6_

- [ ] 21. Integración final y wiring
  - [ ] 21.1 Conectar todas las URLs en `config/urls.py` del backend
    - Incluir routers de `restaurants`, `catalog`, `orders`, `sessions`, `bot`
    - _Requerimientos: 7.1, 7.5_

  - [ ] 21.2 Verificar que el frontend consume todos los endpoints correctamente
    - Revisar `src/lib/api.ts` y asegurar que las URLs coinciden con las del backend
    - _Requerimientos: 7.5, 6.1_

  - [ ] 21.3 Crear script `init.sh` en la raíz del repositorio
    - Comandos de verificación: levantar servicios Docker, aplicar migraciones, correr tests backend y frontend
    - _Requerimientos: 10.4, 10.5_

  - [ ] 21.4 Crear `PROGRESS.md`, `ARCHITECTURE.md` y `CONSTRAINTS.md`
    - Documentar estado inicial, arquitectura de alto nivel y límites técnicos del proyecto

- [ ] 22. Checkpoint final — Todos los tests deben pasar
  - Ejecutar suite completa de tests backend (pytest + Hypothesis) y frontend. Asegurar que todos los tests pasan, preguntar al usuario si hay dudas antes de considerar el MVP completo.

---

## Notas

- Las sub-tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requerimientos específicos para trazabilidad
- Los checkpoints aseguran validación incremental antes de continuar
- Las property tests validan propiedades universales usando Hypothesis (backend) y pruebas unitarias parametrizadas (frontend)
- Los tests unitarios validan ejemplos específicos y casos borde
- Las transacciones atómicas en pedidos garantizan que no se persisten datos parciales ante fallos

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 1, "tasks": ["2.5", "3"] },
    { "id": 2, "tasks": ["4.1", "15.1", "15.2"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1", "7.1", "14"] },
    { "id": 4, "tasks": ["4.4", "5.2", "7.2", "7.3", "9.1", "15.3", "15.4", "15.5"] },
    { "id": 5, "tasks": ["5.3", "5.4", "5.5", "7.4", "8.1", "9.2", "16.1"] },
    { "id": 6, "tasks": ["7.5", "8.2", "8.3", "9.3", "10.1", "16.2", "16.3"] },
    { "id": 7, "tasks": ["10.2", "10.3", "10.4", "10.5", "12.1", "16.4"] },
    { "id": 8, "tasks": ["12.2", "17.1", "17.2"] },
    { "id": 9, "tasks": ["12.3", "12.4", "13.1", "17.3", "17.4", "17.5"] },
    { "id": 10, "tasks": ["13.2", "13.3", "19.1", "20.1", "20.2"] },
    { "id": 11, "tasks": ["19.2", "19.3", "19.4", "20.3"] },
    { "id": 12, "tasks": ["21.1", "21.2", "21.3", "21.4"] }
  ]
}
```
