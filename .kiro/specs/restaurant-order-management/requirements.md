# Documento de Requerimientos

## Introducción

Tragón es un sistema de automatización de toma de pedidos para restaurantes. Este documento define los requerimientos del MVP del flujo completo de pedidos, excluyendo IA e inventario. El sistema integra un bot de mensajería (Telegram), un frontend en Astro, un backend en Django REST Framework y PostgreSQL como base de datos. Soporta múltiples restaurantes identificados por slug único y cubre el ciclo completo: recepción del cliente via bot → exploración del menú → selección de productos → confirmación de pedido → notificación al restaurante.

---

## Glosario

- **Bot**: Servicio de mensajería (Telegram por defecto, WhatsApp preparado) que recibe mensajes de clientes y genera links de acceso al menú.
- **Slug**: Identificador único, corto y no consecutivo asociado a un restaurante o a una sesión de pedido.
- **Frontend**: Aplicación Astro desplegada en Docker en AWS que sirve la interfaz de usuario al cliente.
- **Backend**: Aplicación Django + DRF desplegada en Docker en AWS que expone la API REST.
- **API**: Interfaz REST expuesta por el Backend, autenticada mediante API Key.
- **Restaurante**: Entidad que usa el sistema para gestionar su menú y recibir pedidos.
- **Cliente**: Usuario final que realiza un pedido a través del Bot y el Frontend.
- **Menú**: Conjunto de categorías y productos disponibles para un Restaurante en un momento dado.
- **Categoría**: Agrupación de productos del Menú (ej: hamburguesas, pizzas, empanadas).
- **Producto**: Ítem del Menú que pertenece a una Categoría. Tiene nombre, foto y precio base.
- **Topping**: Complemento opcional añadible a un Producto con precio adicional.
- **Pedido**: Conjunto de ítems seleccionados por un Cliente con tipo de entrega y método de pago.
- **Ítem de Pedido**: Línea de un Pedido que referencia un Producto con sus Toppings e indicaciones especiales.
- **Tipo de Entrega**: Modalidad de entrega: domicilio, recoger en establecimiento o consumir en el local.
- **Domicilio**: Tipo de entrega con envío a dirección del Cliente en Colombia.
- **Panel de Gestión**: Sección del Frontend restringida al Restaurante para administrar su Menú.
- **Notificación**: Mensaje enviado al chat del Restaurante (Telegram/WhatsApp) con el detalle del Pedido confirmado.
- **API Key**: Credencial utilizada para autenticar las peticiones entre el Frontend y el Backend.
- **RDS**: Servicio de base de datos PostgreSQL gestionado en AWS.
- **Secrets Manager**: Servicio de AWS para almacenar y recuperar secretos del Frontend y del Backend por separado.
- **Bre-b**: Sistema de pagos por transferencia bancaria en Colombia.

---

## Requerimientos

### Requerimiento 1 — Acceso inicial vía Bot

**User Story:** Como Cliente, quiero recibir un link de acceso al menú cuando le escribo al bot del restaurante, para poder realizar mi pedido desde el navegador.

#### Criterios de Aceptación

1. WHEN el Bot recibe un mensaje de un Cliente, THE Bot SHALL generar un link único que incluye el slug del Restaurante y un slug de sesión corto no consecutivo.
2. WHEN el Bot genera el link, THE Bot SHALL responder al Cliente con el link generado en el mismo chat.
3. WHEN el Cliente accede al link generado, THE Frontend SHALL mostrar el Menú del Restaurante correspondiente al slug de sesión.
4. IF el slug de sesión no existe o ha expirado, THEN THE Frontend SHALL mostrar un mensaje de error indicando que el link no es válido.
5. THE Bot SHALL estar habilitado para Telegram por defecto.
6. WHERE WhatsApp está habilitado en la configuración del Restaurante, THE Bot SHALL soportar el envío del link también por WhatsApp.

---

### Requerimiento 2 — Pantalla principal: Menú

**User Story:** Como Cliente, quiero ver el menú del restaurante organizado por categorías con fotos y nombres, para explorar y seleccionar los productos que deseo pedir.

#### Criterios de Aceptación

1. WHEN el Cliente accede al Frontend con un slug válido, THE Frontend SHALL mostrar el Menú del Restaurante separado por Categorías.
2. THE Frontend SHALL mostrar cada Producto con su foto y nombre dentro de su Categoría.
3. WHEN el Cliente presiona la foto o el nombre de un Producto, THE Frontend SHALL navegar a la pantalla de detalle del Producto seleccionado.
4. WHILE el Cliente tiene al menos un Ítem de Pedido seleccionado, THE Frontend SHALL mostrar en la parte inferior de la pantalla el contador total de productos seleccionados.
5. THE Frontend SHALL mostrar en la parte inferior de la pantalla los botones "Cancelar pedido" y "Pagar" en todo momento durante la navegación del Menú.
6. WHEN el Cliente presiona "Cancelar pedido", THE Frontend SHALL vaciar todos los Ítems del Pedido y regresar al estado inicial del Menú.

---

### Requerimiento 3 — Pantalla de detalle del producto

**User Story:** Como Cliente, quiero ver el detalle de un producto con sus ingredientes, toppings y campo de indicaciones especiales, para personalizar mi pedido antes de añadirlo.

#### Criterios de Aceptación

1. WHEN el Frontend muestra la pantalla de detalle, THE Frontend SHALL mostrar la foto, nombre e ingredientes del Producto seleccionado.
2. THE Frontend SHALL mostrar todos los Toppings disponibles del Producto con sus precios adicionales.
3. THE Frontend SHALL mostrar un campo de texto libre para que el Cliente ingrese indicaciones especiales (ej: sin cebolla, carne bien cocida).
4. WHEN el Cliente presiona "Aceptar", THE Frontend SHALL añadir el Ítem de Pedido al Pedido con los Toppings seleccionados y las indicaciones especiales ingresadas, y SHALL regresar a la pantalla principal.
5. WHEN el Cliente presiona "Cancelar", THE Frontend SHALL descartar los cambios y regresar a la pantalla principal sin modificar el Pedido.
6. THE Frontend SHALL permitir al Cliente añadir el mismo Producto múltiples veces con diferentes Toppings e indicaciones especiales, generando un Ítem de Pedido independiente por cada adición.

---

### Requerimiento 4 — Flujo de pago: tipo de entrega

**User Story:** Como Cliente, quiero indicar cómo quiero recibir mi pedido, para que el restaurante pueda procesarlo correctamente.

#### Criterios de Aceptación

1. WHEN el Cliente presiona "Pagar", THE Frontend SHALL mostrar las opciones de Tipo de Entrega: domicilio, recoger en establecimiento y consumir en el local.
2. WHEN el Cliente selecciona "domicilio", THE Frontend SHALL mostrar un formulario de dirección adaptado para el formato de direcciones de Colombia.
3. THE Frontend SHALL incluir en el formulario de dirección los campos: tipo de vía, número de vía, número de cruce, número de predio, barrio, ciudad y detalles adicionales.
4. WHEN el Cliente selecciona "recoger en establecimiento" o "consumir en el local", THE Frontend SHALL mostrar la dirección del Restaurante y un mini mapa con su ubicación.
5. IF el Cliente selecciona "domicilio" y no completa los campos obligatorios del formulario de dirección, THEN THE Frontend SHALL impedir el avance al siguiente paso y SHALL resaltar los campos faltantes.

---

### Requerimiento 5 — Flujo de pago: método de pago

**User Story:** Como Cliente, quiero elegir entre pago en efectivo o transferencia, para completar mi pedido según el método que prefiera.

#### Criterios de Aceptación

1. WHEN el Cliente avanza desde la selección de Tipo de Entrega, THE Frontend SHALL mostrar un modal con las opciones de método de pago: efectivo y transferencia.
2. WHEN el Cliente selecciona "efectivo", THE Frontend SHALL mostrar el total del Pedido, el valor del domicilio separado (si aplica) y un campo para que el Cliente indique el valor del billete con el que pagará.
3. WHEN el Cliente selecciona "transferencia", THE Frontend SHALL mostrar la llave Bre-b del Restaurante, el valor a pagar, el valor del domicilio separado (si aplica) y la instrucción de enviar el comprobante al chat.
4. WHEN el Frontend muestra la llave Bre-b, THE Frontend SHALL incluir un botón que copie la llave al portapapeles del dispositivo del Cliente.
5. IF el Cliente selecciona "efectivo" y no ingresa el valor del billete, THEN THE Frontend SHALL impedir la confirmación del Pedido y SHALL resaltar el campo faltante.

---

### Requerimiento 6 — Confirmación del pedido

**User Story:** Como Cliente, quiero confirmar mi pedido para que el restaurante lo reciba con todos los detalles.

#### Criterios de Aceptación

1. WHEN el Cliente confirma el Pedido, THE Backend SHALL persistir el Pedido en la base de datos PostgreSQL con todos sus Ítems, Toppings, indicaciones especiales, Tipo de Entrega, datos de dirección si aplica y método de pago.
2. WHEN el Backend persiste el Pedido, THE Backend SHALL enviar una Notificación al chat del Restaurante con el detalle completo del Pedido.
3. THE Notificación SHALL incluir: lista de Ítems con Toppings e indicaciones especiales, Tipo de Entrega, dirección de entrega si aplica, método de pago y total.
4. WHEN el Backend envía la Notificación, THE Backend SHALL usar el canal de mensajería configurado para el Restaurante (Telegram por defecto).
5. IF el envío de la Notificación falla, THEN THE Backend SHALL registrar el error en el log del sistema y SHALL devolver al Frontend una respuesta de éxito de todos modos, dado que el Pedido ya fue persistido.
6. WHEN el Pedido es confirmado exitosamente, THE Frontend SHALL mostrar una pantalla de confirmación con el resumen del Pedido y el número de referencia.

---

### Requerimiento 7 — API REST del Backend

**User Story:** Como desarrollador del sistema, quiero una API REST bien definida, autenticada y robusta, para que el Frontend pueda consumir los datos del Menú y gestionar Pedidos de forma segura.

#### Criterios de Aceptación

1. THE API SHALL autenticar todas las peticiones mediante API Key incluida en el encabezado HTTP de la solicitud.
2. IF una petición llega sin API Key válida, THEN THE API SHALL rechazar la petición con un código de respuesta HTTP 401.
3. THE API SHALL aplicar throttling a las peticiones por API Key para prevenir abuso, con un límite configurable por Restaurante.
4. THE API SHALL devolver listas de recursos con paginación, incluyendo los campos `count`, `next` y `previous` en la respuesta.
5. WHEN el Frontend solicita el Menú de un Restaurante, THE API SHALL devolver las Categorías con sus Productos y Toppings asociados, filtrados por el slug del Restaurante.
6. WHEN el Frontend envía un Pedido, THE API SHALL validar que todos los Productos e Ítems referenciados pertenezcan al Restaurante del slug correspondiente.
7. IF la validación del Pedido falla, THEN THE API SHALL devolver un código de respuesta HTTP 400 con un mensaje descriptivo del error.

---

### Requerimiento 8 — Soporte multi-restaurante

**User Story:** Como operador del sistema, quiero que múltiples restaurantes coexistan en la misma instancia, para que cada uno gestione su menú y pedidos de forma aislada.

#### Criterios de Aceptación

1. THE Backend SHALL identificar cada Restaurante mediante un slug único e inmutable.
2. THE Backend SHALL asegurar que los datos de Menú, Productos, Pedidos y configuraciones de un Restaurante no sean accesibles desde el slug de otro Restaurante.
3. THE API SHALL filtrar automáticamente todos los recursos por el Restaurante asociado a la API Key de la petición.
4. THE Backend SHALL permitir configurar por Restaurante: nombre, logo, dirección, llave Bre-b, canal de notificaciones y valor de domicilio.

---

### Requerimiento 9 — Panel de gestión del menú

**User Story:** Como administrador del Restaurante, quiero gestionar mi menú desde el Frontend sin necesidad de acceder a Django Admin, para actualizar productos, precios, fotos y categorías de forma autónoma.

#### Criterios de Aceptación

1. THE Frontend SHALL incluir un Panel de Gestión accesible desde una ruta dedicada y protegida del Restaurante.
2. WHEN el administrador accede al Panel de Gestión, THE Frontend SHALL mostrar las Categorías y Productos actuales del Restaurante.
3. THE Panel de Gestión SHALL permitir crear, editar y eliminar Categorías.
4. THE Panel de Gestión SHALL permitir crear, editar y eliminar Productos, incluyendo nombre, foto, precio base e ingredientes.
5. THE Panel de Gestión SHALL permitir crear, editar y eliminar Toppings asociados a Productos, incluyendo nombre y precio adicional.
6. WHEN el administrador sube una foto de Producto, THE Backend SHALL almacenar la imagen y devolver una URL accesible desde el Frontend.
7. THE Backend SHALL exponer endpoints de API protegidos para todas las operaciones de gestión del Menú descritas en este requerimiento.

---

### Requerimiento 10 — Django Admin y configuración de infraestructura

**User Story:** Como administrador técnico del sistema, quiero que Django Admin esté habilitado y la infraestructura esté correctamente configurada, para poder gestionar datos directamente y garantizar operaciones seguras.

#### Criterios de Aceptación

1. THE Backend SHALL habilitar Django Admin para todos los modelos del sistema.
2. THE Backend SHALL leer los secretos de conexión a RDS y las credenciales de terceros desde AWS Secrets Manager al iniciar la aplicación.
3. THE Frontend SHALL leer sus propios secretos (API Key, configuración) desde una fuente separada de la del Backend en AWS Secrets Manager.
4. THE Backend SHALL estar empaquetado y desplegado en un contenedor Docker en AWS.
5. THE Frontend SHALL estar empaquetado y desplegado en un contenedor Docker en AWS.
6. THE Backend SHALL usar PostgreSQL en AWS RDS como base de datos principal.
