# Documento de Requerimientos — Panel de Cocina en Tiempo Real

## Introducción

El Panel de Cocina es una interfaz interna del restaurante que permite a los operadores (cocineros, cajeros) visualizar y gestionar los pedidos activos del día en tiempo real. El panel se integra sobre el backend Django existente de Tragón, extendido con Django Channels y Redis como capa de comunicación WebSocket. El frontend Astro recibe una nueva ruta `/cocina/[restaurantSlug]/` que opera exclusivamente con los pedidos del restaurante autenticado.

El panel reemplaza la dependencia de notificaciones Telegram para el seguimiento operativo interno, permitiendo que múltiples dispositivos dentro del restaurante (tablet de cocina, tablet de caja) se mantengan sincronizados sin recargar la página.

**Dependencia:** Este feature se implementa después de que el MVP `restaurant-order-management` esté completo. Reutiliza los modelos `Restaurant`, `Order`, `OrderItem`, `OrderItemTopping`, la autenticación por API Key y la estructura de backend/frontend existentes.

---

## Glosario

- **Panel de Cocina**: Interfaz web en tiempo real accesible desde `/cocina/[restaurantSlug]/` que muestra y gestiona los pedidos del restaurante.
- **Operador**: Personal del restaurante (cocinero, cajero) que usa el Panel de Cocina en un dispositivo.
- **Canal WebSocket**: Conexión persistente entre el cliente y el servidor que permite enviar y recibir mensajes sin polling HTTP.
- **Channel Layer**: Capa de mensajería intermediaria (Redis) usada por Django Channels para comunicar grupos de consumidores WebSocket.
- **Grupo de Restaurante**: Identificador lógico de Channel Layer que agrupa todas las conexiones WebSocket activas de un mismo restaurante.
- **Consumer**: Componente de Django Channels que maneja la lógica de un canal WebSocket.
- **Estado del Pedido**: Etapa actual de un pedido dentro del flujo operativo: `nuevo`, `en_preparacion`, `listo`, `entregado`.
- **Tarjeta de Pedido**: Elemento visual del Panel de Cocina que muestra toda la información de un pedido con código de color según su estado.
- **Filtro de Vista**: Preferencia del Operador que determina qué pedidos se muestran en el Panel de Cocina según estado y tipo de entrega.
- **Preferencias de Vista**: Configuración de filtros guardada por dispositivo en `localStorage`.
- **Tiempo Transcurrido**: Contador en vivo que muestra cuánto tiempo ha pasado desde la creación del pedido.
- **ASGI**: Interfaz de servidor asíncrono de Python; reemplaza WSGI para soporte de WebSocket en Django.
- **Redis**: Servidor de estructuras de datos en memoria usado como Channel Layer para Django Channels.
- **Backend**: Aplicación Django + DRF + Channels desplegada en Docker, extendida con ASGI y Redis.
- **Frontend**: Aplicación Astro con la nueva ruta `/cocina/[restaurantSlug]/` que incluye el Panel de Cocina como isla React.
- **API Key**: Credencial existente del sistema Tragón usada para autenticar tanto las peticiones HTTP como la negociación del canal WebSocket.
- **Restaurante**: Entidad existente del sistema identificada por slug único.
- **Pedido**: Entidad existente del sistema extendida con los nuevos estados del flujo operativo.

---

## Requerimientos

### Requerimiento 1 — Estados operativos del pedido

**User Story:** Como Operador del restaurante, quiero que los pedidos tengan estados operativos con código de color, para identificar visualmente la urgencia y el progreso de cada pedido de un solo vistazo.

#### Criterios de Aceptación

1. THE Backend SHALL soportar los estados operativos del pedido: `nuevo`, `en_preparacion`, `listo` y `entregado`.
2. WHEN un pedido es creado mediante el flujo de cliente, THE Backend SHALL asignar automáticamente el estado `nuevo` al pedido.
3. THE Panel de Cocina SHALL mostrar cada Tarjeta de Pedido con un color de fondo distinto según su estado: rojo para `nuevo`, amarillo para `en_preparacion`, verde para `listo` y gris para `entregado`.
4. WHEN el estado de un Pedido cambia, THE Panel de Cocina SHALL actualizar el color de la Tarjeta de Pedido correspondiente en tiempo real sin recargar la página.
5. THE Panel de Cocina SHALL ordenar las Tarjetas de Pedido por hora de llegada de forma ascendente, mostrando los pedidos más antiguos primero.

---

### Requerimiento 2 — Gestión de estados desde el panel

**User Story:** Como Operador del restaurante, quiero avanzar o cancelar el estado de un pedido desde el panel, para que todos los dispositivos del restaurante reflejen el cambio de inmediato.

#### Criterios de Aceptación

1. THE Panel de Cocina SHALL mostrar en cada Tarjeta de Pedido un botón para avanzar al siguiente estado según la secuencia: `nuevo` → `en_preparacion` → `listo` → `entregado`.
2. WHEN el Operador presiona el botón de avance de estado, THE Panel de Cocina SHALL enviar la actualización al Backend y THE Backend SHALL persistir el nuevo estado en la base de datos.
3. WHEN el Backend persiste un cambio de estado, THE Backend SHALL transmitir el evento de actualización a todos los clientes WebSocket conectados al Grupo de Restaurante correspondiente.
4. WHEN el Panel de Cocina recibe un evento de actualización de estado por WebSocket, THE Panel de Cocina SHALL actualizar la Tarjeta de Pedido afectada en todos los dispositivos conectados al mismo Grupo de Restaurante sin recargar la página.
5. THE Panel de Cocina SHALL mostrar en cada Tarjeta de Pedido un botón para cancelar el pedido.
6. WHEN el Operador presiona el botón de cancelar, THE Panel de Cocina SHALL solicitar confirmación antes de enviar la cancelación al Backend.
7. WHEN el Backend recibe una solicitud de cancelación confirmada, THE Backend SHALL persistir el estado `cancelado` en el Pedido y SHALL transmitir el evento de cancelación al Grupo de Restaurante.
8. IF el Pedido ya se encuentra en estado `entregado`, THEN THE Panel de Cocina SHALL deshabilitar el botón de avance de estado para ese Pedido.

---

### Requerimiento 3 — Panel en tiempo real por WebSocket

**User Story:** Como Operador del restaurante, quiero que el panel se actualice automáticamente cuando llegan pedidos nuevos o cuando cambian de estado, para no tener que recargar la página manualmente.

#### Criterios de Aceptación

1. WHEN el Operador accede al Panel de Cocina, THE Panel de Cocina SHALL establecer una conexión WebSocket con el Backend autenticada mediante la API Key del Restaurante.
2. WHEN un nuevo Pedido es creado para el Restaurante, THE Backend SHALL emitir un evento WebSocket al Grupo de Restaurante y THE Panel de Cocina SHALL mostrar la nueva Tarjeta de Pedido sin recargar la página.
3. THE Backend SHALL agrupar todos los consumidores WebSocket del mismo Restaurante en un único Grupo de Restaurante identificado por el slug del Restaurante.
4. THE Panel de Cocina SHALL mostrar únicamente los pedidos del Restaurante autenticado, sin mostrar pedidos de otros restaurantes.
5. IF la conexión WebSocket se interrumpe, THEN THE Panel de Cocina SHALL intentar reconectarse automáticamente con retroceso exponencial, con un intervalo inicial de 1 segundo y un máximo de 30 segundos entre intentos.
6. WHILE la conexión WebSocket está interrumpida, THE Panel de Cocina SHALL mostrar un indicador visual de estado de conexión que informe al Operador que el panel no está en tiempo real.
7. THE Backend SHALL validar la API Key durante el handshake WebSocket y SHALL rechazar la conexión con código de cierre 4001 si la API Key es inválida o ausente.

---

### Requerimiento 4 — Vistas filtrables

**User Story:** Como Operador del restaurante, quiero filtrar los pedidos visibles en el panel por estado y tipo de entrega, para enfocarme en la información relevante para mi rol.

#### Criterios de Aceptación

1. THE Panel de Cocina SHALL permitir al Operador filtrar los pedidos visibles por uno o más estados simultáneamente: `nuevo`, `en_preparacion`, `listo`, `entregado`.
2. THE Panel de Cocina SHALL permitir al Operador filtrar los pedidos visibles por tipo de entrega: domicilio, para recoger y en el local.
3. THE Panel de Cocina SHALL mostrar por defecto todos los pedidos activos del día con estado `nuevo`, `en_preparacion` o `listo`, excluyendo los pedidos con estado `entregado`.
4. WHERE el Operador habilita la opción de mostrar pedidos entregados, THE Panel de Cocina SHALL incluir los pedidos con estado `entregado` en la vista actual.
5. THE Panel de Cocina SHALL guardar las Preferencias de Vista del Operador en `localStorage` del dispositivo y SHALL restaurarlas automáticamente al recargar la página o en visitas posteriores.
6. WHEN el Operador modifica los filtros activos, THE Panel de Cocina SHALL aplicar los nuevos filtros a la vista actual de forma inmediata sin recargar la página.

---

### Requerimiento 5 — Contenido de la Tarjeta de Pedido

**User Story:** Como Operador del restaurante, quiero ver toda la información relevante de cada pedido en su tarjeta, para prepararlo y entregarlo correctamente sin consultar otras fuentes.

#### Criterios de Aceptación

1. THE Tarjeta de Pedido SHALL mostrar el número de referencia del pedido.
2. THE Tarjeta de Pedido SHALL mostrar la lista de ítems del pedido, incluyendo el nombre del producto, los toppings seleccionados y las indicaciones especiales de cada ítem.
3. THE Tarjeta de Pedido SHALL mostrar el tipo de entrega del pedido: domicilio, para recoger o en el local.
4. WHERE el tipo de entrega es domicilio, THE Tarjeta de Pedido SHALL mostrar la dirección de entrega completa.
5. THE Tarjeta de Pedido SHALL mostrar el método de pago del pedido.
6. THE Tarjeta de Pedido SHALL mostrar la hora en que llegó el pedido.
7. THE Panel de Cocina SHALL mostrar un Tiempo Transcurrido en vivo en cada Tarjeta de Pedido, actualizado cada 60 segundos, que indique cuánto tiempo ha pasado desde la creación del pedido.

---

### Requerimiento 6 — Infraestructura WebSocket (Django Channels + Redis)

**User Story:** Como desarrollador del sistema, quiero que el backend soporte comunicación WebSocket mediante Django Channels con Redis como Channel Layer, para habilitar las actualizaciones en tiempo real del Panel de Cocina.

#### Criterios de Aceptación

1. THE Backend SHALL incorporar Django Channels como dependencia y SHALL configurar la aplicación Django para ejecutarse en modo ASGI.
2. THE Backend SHALL configurar Redis como Channel Layer mediante `channels_redis`, con la URL de conexión obtenida desde AWS Secrets Manager en producción.
3. THE Backend SHALL exponer un endpoint WebSocket en la ruta `/ws/cocina/{restaurant_slug}/` que acepte conexiones de clientes autenticados.
4. THE Backend SHALL implementar un Consumer ASGI que gestione el ciclo de vida completo de la conexión WebSocket: apertura, incorporación al Grupo de Restaurante, recepción de mensajes, transmisión al grupo y cierre.
5. WHEN el Backend necesita transmitir un evento a todos los clientes del mismo Restaurante, THE Backend SHALL usar el Channel Layer para enviar el mensaje al Grupo de Restaurante identificado por el slug del Restaurante.
6. THE Backend SHALL agregar Redis al entorno de desarrollo local en `docker-compose.yml` como servicio adicional.
7. IF Redis no está disponible al iniciar el Backend, THEN THE Backend SHALL registrar el error en el log del sistema e impedir el inicio de la aplicación para evitar comportamiento silenciosamente degradado.

---

### Requerimiento 7 — API REST para gestión de estados desde el panel

**User Story:** Como desarrollador del sistema, quiero endpoints REST para que el Panel de Cocina pueda actualizar el estado de los pedidos, para que los cambios persistan en la base de datos y se propaguen por WebSocket.

#### Criterios de Aceptación

1. THE API SHALL exponer un endpoint `PATCH /api/v1/manage/orders/{id}/status/` que permita actualizar el estado de un Pedido a uno de los valores válidos: `en_preparacion`, `listo`, `entregado` o `cancelado`.
2. THE API SHALL autenticar el endpoint de actualización de estado mediante API Key, de la misma forma que los demás endpoints del sistema.
3. THE API SHALL verificar que el Pedido a actualizar pertenezca al Restaurante asociado a la API Key antes de persistir el cambio.
4. IF el Pedido no pertenece al Restaurante de la API Key, THEN THE API SHALL retornar HTTP 403 sin modificar el Pedido.
5. IF el estado solicitado no es un valor válido o la transición de estado no es permitida, THEN THE API SHALL retornar HTTP 400 con un mensaje descriptivo del error.
6. WHEN el estado del Pedido es actualizado exitosamente, THE Backend SHALL emitir el evento de cambio de estado al Grupo de Restaurante por el Channel Layer antes de retornar la respuesta HTTP.
7. THE API SHALL exponer un endpoint `GET /api/v1/manage/orders/` que devuelva los pedidos del Restaurante autenticado con filtros opcionales por estado y tipo de entrega, y que incluya únicamente pedidos del día actual.

---

### Requerimiento 8 — Ruta del Panel de Cocina en el Frontend

**User Story:** Como desarrollador del sistema, quiero una nueva ruta en el frontend Astro que sirva el Panel de Cocina con SSR, para que la página cargue con los pedidos iniciales y luego continúe actualizándose en tiempo real por WebSocket.

#### Criterios de Aceptación

1. THE Frontend SHALL incluir la ruta `/cocina/[restaurantSlug]/` como una página Astro con renderizado SSR.
2. WHEN el Frontend renderiza la ruta del Panel de Cocina, THE Frontend SHALL cargar los pedidos activos del día desde el Backend mediante una petición HTTP al endpoint `GET /api/v1/manage/orders/` como datos iniciales.
3. WHEN el componente del Panel de Cocina se hidrata en el cliente, THE Panel de Cocina SHALL establecer la conexión WebSocket para recibir actualizaciones en tiempo real.
4. THE Frontend SHALL pasar los datos iniciales de pedidos como props al componente React del Panel de Cocina para evitar una pantalla en blanco durante la hidratación.
5. IF la carga inicial de pedidos falla, THEN THE Frontend SHALL mostrar un mensaje de error indicando que no se pudieron cargar los pedidos y SHALL ofrecer un botón para reintentar.
