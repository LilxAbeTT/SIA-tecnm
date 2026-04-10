# Plan Maestro: Modulo Comunidad Social SIA

## Estado

- Documento de especificacion funcional y tecnica
- No implementado aun
- Cerrado para iniciar desarrollo por fases

## Objetivo

Construir un nuevo modulo dentro de SIA llamado `Comunidad` que funcione como una red social interna del campus, con experiencia mobile-first, publicaciones sociales, comentarios, respuestas, reacciones, avisos de la comunidad, moderacion y una base escalable para mensajeria y grupos en fases posteriores.

La comunidad debe servir para casos reales del campus como:

- objetos perdidos
- promociones o ventas entre usuarios
- preguntas a la comunidad
- avisos creados por la propia comunidad
- publicaciones generales con texto o imagenes
- conversaciones privadas en fases posteriores

## Decision de arquitectura

### Decision principal

Crear un modulo nuevo e independiente llamado `Comunidad`.

### Motivo

No conviene reutilizar el modulo `Foro` como base principal porque hoy ya esta especializado en eventos del campus:

- registro a eventos
- tickets
- codigos QR
- asistencia
- recursos por evento
- feedback post-evento
- Cloud Functions y reglas enfocadas a eventos

Tampoco conviene reutilizar la "comunidad" de `Aula` porque esa experiencia es academica y cerrada por clase, no abierta ni social.

### Resultado esperado

Mantener:

- `Foro` = Eventos
- `Aula` = Comunidad academica por clase
- `Comunidad` = Red social interna del campus

## Decisiones cerradas antes de desarrollar

### Acceso al modulo

- El acceso a `Comunidad` sera general para cualquier usuario autenticado que tenga permiso de entrar a SIA.
- Esto incluye estudiantes, docentes y personal.
- La experiencia base sigue siendo social y mobile-first, pero no exclusiva para estudiantes.

### Identidad dentro del modulo

- El rol global del usuario en SIA no se modifica.
- Un `student` sigue siendo `student` fuera y dentro del sistema general.
- `Comunidad` manejara distinciones visuales y estados internos propios sin alterar el perfil global.
- Si el autor es docente o personal, debe verse claramente que no es estudiante.
- Si el autor es una cuenta oficial o administrativa, debe verse todavia mas claro.

### Alcance real del MVP

- Fase 1 se enfocara en feed social, publicaciones, comentarios, respuestas, reacciones, filtros, reportes basicos, onboarding e integracion completa con SIA.
- Mensajeria privada no entra en Fase 1.
- Grupos no entran en Fase 1.
- Favoritos no son prioridad del MVP.
- Estados como `resuelto` o `vendido` no son prioridad inicial.

### Tipos de publicacion definitivos

- `general`
- `perdido_encontrado`
- `venta_promocion`
- `pregunta`
- `aviso_comunidad`

Decisiones asociadas:

- `grupo` no es tipo de publicacion; grupo sera una entidad propia en una fase posterior.
- `imagen_video` no es tipo de publicacion; la media sera un atributo de la publicacion.
- Cada tipo tendra badge, color y tratamiento visual propio.

## Supuestos base

- Nombre del modulo: `Comunidad`
- View ID: `view-comunidad`
- Ruta SPA: `/comunidad`
- Global estudiante: `window.Comunidad`
- Global admin: `window.AdminComunidad`
- Namespace compartido: `window.ComunidadModule`
- El admin inicial sera `superadmin` o un perfil con `permissions.comunidad = 'admin'`
- El bloqueo sera dentro del modulo Comunidad, no bloqueo total de SIA
- La version inicial debe ser funcional, visual y real-time, pero cuidando costo de lecturas y mantenimiento
- La primera fase debe quedar lista para reutilizar el patron arquitectonico de otros modulos del shell actual

## Objetivos del producto

1. Hacer que la comunidad sea muy facil de usar desde celular.
2. Permitir publicar y descubrir contenido social en tiempo real.
3. Distinguir claramente a estudiantes, docentes, personal y cuentas oficiales.
4. Separar claramente el espacio social de eventos, aula y avisos institucionales.
5. Dar herramientas reales de moderacion para mantener orden y seguridad.
6. Dejar una base escalable para futuras mejoras sin acoplarse mal a `Foro`.

## Principios de UX

### Uso general

- Mobile-first real
- Feed rapido y claro
- Acciones visibles con pocos toques
- Publicar debe ser facil y corto
- Tiempo real solo donde el usuario perciba valor

### Identidad visual

- Cada tarjeta debe mostrar quien publica y desde que contexto lo hace
- Estudiante: mostrar carrera
- Docente: badge visible de docente y, si aplica, carrera o area
- Personal: badge visible de personal y departamento o area
- Cuenta oficial: badge especial de cuenta oficial o admin

### Visual

- Atractivo, moderno y mas social que institucional
- Diferente a `Foro` para evitar confusion
- Debe sentirse mas vivo y dinamico
- Debe conservar compatibilidad con el shell actual de SIA
- Los tipos de publicacion deben distinguirse visualmente con color de contorno, badge o acento estable

### Admin

- Panel claro de moderacion
- Ver reportes, usuarios bloqueados, publicaciones ocultas y actividad reciente
- Acciones rapidas para bloquear, ocultar, fijar y revisar

## Alcance funcional propuesto

### Acceso e identidad

- entrada general para usuarios autenticados
- distincion visual por tipo de autor
- carrera visible cuando el autor sea estudiante
- area o departamento visible cuando el autor sea docente o personal
- soporte para cuentas oficiales o administrativas

### Publicaciones

Tipos de publicacion:

- `general`
- `perdido_encontrado`
- `venta_promocion`
- `pregunta`
- `aviso_comunidad`

Formato de contenido para `general`:

- `plain`
- `bullets`

Campos funcionales sugeridos:

- titulo opcional
- texto principal
- modo de contenido
- bullets opcionales
- tipo
- autor
- tipo de autor dentro de Comunidad
- carrera o area visible
- alcance
- carrera objetivo
- grupo objetivo para fases posteriores
- imagenes o media
- estado
- timestamps
- metricas basicas

Acciones previstas:

- crear
- editar propia publicacion
- eliminar propia publicacion
- comentar
- responder comentarios
- reaccionar
- compartir enlace interno
- reportar publicacion

Acciones que se dejan fuera del MVP:

- favoritos
- estados `resuelto` y `vendido`
- archivado automatico por flujo de negocio

### Alcances de visibilidad

- `global`
- `career`
- `group`
- `members_only`

Uso por fase:

- Fase 1: `global` y `career`
- Fase 4: `group` y `members_only`

Ejemplos:

- Global: "Se me perdio una credencial"
- Carrera: "Vendo libro de calculo para ISC"
- Grupo social: "Grupo de futbol rapido"
- Solo miembros: conversacion o contenido interno de un grupo creado en el modulo

### Comentarios y respuestas

- comentarios en tiempo real dentro del post abierto
- respuestas a comentarios
- reacciones ligeras
- conteos agregados
- sanitizacion de contenido
- cierre de comentarios por moderacion en Fase 2

### Avisos de comunidad

No son avisos institucionales.

Deben permitir:

- publicaciones fijadas por admin dentro de Comunidad
- anuncios del propio ecosistema social
- reglas de convivencia
- avisos temporales de dinamicas o recordatorios

### Mensajeria

- conversaciones privadas usuario a usuario
- unread count
- ultimo mensaje
- notificaciones in-app
- push opcional reutilizando el pipeline actual de notificaciones

Nota:

- esta capacidad se mueve a Fase 3

### Grupos creados dentro del modulo

Tipos:

- grupo libre por interes
- grupo de carrera
- grupo privado por invitacion

Acciones:

- crear grupo
- unirse o solicitar acceso
- salir del grupo
- publicar dentro del grupo
- ver miembros
- moderar miembros si es owner, moderador o admin

Nota:

- grupos se mueven a Fase 4

### Moderacion

Panel admin con:

- feed moderado
- cola de reportes
- usuarios bloqueados del modulo
- usuarios silenciados del modulo
- publicaciones ocultas
- publicaciones fijadas
- metricas basicas
- configuraciones del modulo

Acciones admin:

- bloquear usuario de Comunidad
- desbloquear usuario
- silenciar usuario
- quitar silencio
- ocultar publicacion
- restaurar publicacion
- fijar publicacion
- cerrar comentarios
- revisar reportes

## Roles y estados dentro de Comunidad

### Regla principal

- Los roles globales del sistema no cambian.
- `Comunidad` usara roles y estados locales al modulo.

### Roles del modulo

- `participant`: acceso normal al modulo
- `moderator`: moderacion operativa
- `admin`: control completo del modulo

### Roles de grupo

- `owner`
- `moderator`
- `member`
- `pending`

### Estados del usuario dentro del modulo

- `active`
- `muted`
- `blocked`

### Implicaciones

- un usuario `blocked` en Comunidad sigue pudiendo usar SIA fuera del modulo
- un usuario `muted` puede leer, pero no publicar, comentar ni reaccionar mientras dure la sancion
- un `moderator` o `admin` no altera el `role` global guardado en `usuarios`

## Fases recomendadas

## Fase 1 - Base social MVP

Objetivo: dejar el modulo operativo, visible en SIA y listo para uso social basico.

Incluye:

- nueva vista `view-comunidad`
- ruta `/comunidad`
- lazy-load real
- acceso general para usuarios autenticados
- distincion visual de identidad por tipo de usuario
- feed principal
- crear publicaciones
- editar y eliminar publicacion propia
- comentarios
- respuestas
- reacciones
- reportar publicacion
- filtros por tipo
- filtros por alcance disponible
- tiempo real del feed visible
- detalle de post
- tutorial del modulo
- estilos propios
- backend minimo
- reglas e indices minimos

No incluye aun:

- mensajeria privada
- grupos
- favoritos
- panel admin completo
- recomendaciones inteligentes
- estados de negocio como `resuelto` o `vendido`

## Fase 2 - Moderacion y seguridad

Incluye:

- panel admin de moderacion
- cola de reportes
- bloqueo por modulo
- silenciado por modulo
- ocultar publicaciones
- restaurar publicaciones
- fijar avisos
- cerrar comentarios
- reglas y limites anti-spam
- logs basicos de acciones admin
- configuracion visible del modulo

## Fase 3 - Mensajeria social

Incluye:

- conversaciones privadas usuario a usuario
- lista de conversaciones
- tiempo real del hilo abierto
- unread count
- notificaciones y push

## Fase 4 - Grupos sociales

Incluye:

- crear grupos
- unirse
- miembros
- posts por grupo
- privacidad de grupo
- roles de grupo
- posible chat grupal posterior

## Fase 5 - Optimizacion y engagement

Incluye:

- favoritos
- feed "para ti"
- mejores publicaciones
- recomendaciones por carrera o intereses
- mejoras de paginacion y cache

## Integracion con la arquitectura real de SIA

## Archivos que se deberan tocar

### Shell y navegacion principal

- `public/index.html`
- `public/core/router.js`
- `public/services/firebase.js`
- `public/app.js`
- `public/main.js`

### Modulo nuevo

- `public/modules/comunidad.js`
- `public/modules/admin.comunidad.js`
- `public/modules/comunidad/comunidad.shared.js`
- `public/modules/comunidad/comunidad.student.js`
- `public/modules/comunidad/comunidad.admin.js`

### Servicios nuevos

- `public/services/comunidad-service.js`
- `public/services/comunidad-chat-service.js`

### Componentes del shell que probablemente requieren registro

- `public/components/navbar.js`
- `public/components/admin-navbar.js`
- `public/components/student-dashboard.js`
- `public/components/superadmin-switcher.js`

### Backend y seguridad

- `functions/comunidad.js`
- `functions/index.js`
- `firestore.rules`
- `firestore.indexes.json`

### Estilos

- `public/styles/13-comunidad.css`

### Documentacion interna

- `.agents/project-map.md`

## Integracion por capa

### `public/index.html`

Agregar:

- contenedor `div#view-comunidad`
- estructura vacia tipo otras vistas lazy-loaded

### `public/core/router.js`

Agregar:

- ruta `view-comunidad: '/comunidad'`
- resolucion de subruta
- carga lazy de scripts del modulo
- inicializacion de `window.Comunidad.init(ctx)` o `window.AdminComunidad.init(ctx)`
- breadcrumbs

### `public/services/firebase.js`

Agregar:

- `view-comunidad` en `ALL_KNOWN_VIEWS`
- inclusion en `DEFAULT_STANDARD_VIEWS` para student, docente y personal
- inclusion opcional en perfiles con `permissions.comunidad`
- helper `canAdminComunidad(profile)`
- actualizacion de `getPermissionViews`
- actualizacion de `getRoleDerivedViews`
- soporte en `canAccessView`

### `public/app.js`

Agregar:

- tarjeta/modulo visible en drawer y dashboard
- metadata de icono y descripcion
- acceso desde buscador global
- keywords relacionadas
- soporte en mapas de rutas, modulos e iconos

### `public/components/*`

Agregar donde aplique:

- icono del modulo en navbar
- tarjeta del modulo en dashboard
- acceso visible para perfiles permitidos
- soporte para admin workspace cuando corresponda

## Patron de implementacion recomendado

### Estudiante

`public/modules/comunidad.js`

- orquestador liviano
- expone `window.Comunidad`
- delega a `window.ComunidadModule.Student`

`public/modules/comunidad/comunidad.student.js`

- estado interno del feed
- tabs
- filtros
- stream del feed
- composer
- detalle del post
- comentarios
- respuestas
- acciones del usuario
- onboarding

### Admin

`public/modules/admin.comunidad.js`

- orquestador liviano
- expone `window.AdminComunidad`
- delega a `window.ComunidadModule.Admin`

`public/modules/comunidad/comunidad.admin.js`

- cola de reportes
- bloqueos
- silencios
- posts ocultos
- posts fijados
- configuracion basica

### Shared

`public/modules/comunidad/comunidad.shared.js`

- escapeHtml
- escapeAttr
- labels
- mapeos de tipos
- mapeos de identidad
- formateo de fechas
- helpers de roles
- helpers de toasts
- sanitizacion visual
- helpers de estilos por tipo de post

## Modelo de datos propuesto

## Colecciones principales

### `comunidad_posts`

Documento sugerido:

```json
{
  "authorId": "uid",
  "authorName": "Nombre",
  "authorPhotoURL": "",
  "authorRoleKind": "student",
  "authorRoleLabel": "Alumno",
  "authorCareer": "ISC",
  "authorArea": "",
  "type": "perdido_encontrado",
  "contentMode": "plain",
  "title": "Se me perdio una chamarra",
  "text": "La deje cerca del edificio B",
  "bullets": [],
  "scope": "global",
  "careerTargets": ["ISC"],
  "groupId": "",
  "media": [],
  "tags": ["perdido", "chamarra"],
  "status": "active",
  "commentsEnabled": true,
  "pinned": false,
  "hiddenByAdmin": false,
  "hiddenReason": "",
  "reportCount": 0,
  "reactionCount": 0,
  "commentCount": 0,
  "lastActivityAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Notas:

- `authorRoleKind` puede ser `student`, `docente`, `personal`, `official` o `admin`
- `contentMode` define si el contenido usa texto simple o lista corta
- `bullets` solo se usa si `contentMode = 'bullets'`

### `comunidad_comments`

```json
{
  "postId": "post_1",
  "authorId": "uid",
  "authorName": "Nombre",
  "authorPhotoURL": "",
  "authorRoleKind": "student",
  "authorCareer": "ISC",
  "authorArea": "",
  "text": "Yo vi algo similar",
  "parentCommentId": null,
  "replyCount": 0,
  "reactionCount": 0,
  "status": "active",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `comunidad_reactions`

ID determinista sugerido:

- `targetId_userId`

Campos:

- targetType (`post` o `comment`)
- targetId
- userId
- reaction
- createdAt

### `comunidad_groups`

```json
{
  "name": "Compra y venta ISC",
  "description": "Grupo para intercambiar material y avisos",
  "type": "career",
  "career": "ISC",
  "privacy": "public",
  "ownerId": "uid",
  "memberCount": 0,
  "postCount": 0,
  "status": "active",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `comunidad_group_members`

```json
{
  "groupId": "group_1",
  "userId": "uid",
  "role": "member",
  "status": "active",
  "joinedAt": "timestamp"
}
```

### `comunidad_conversations`

```json
{
  "participants": ["uid1", "uid2"],
  "participantNames": ["Ana", "Luis"],
  "lastMessage": "Hola",
  "lastMessageAt": "timestamp",
  "unreadBy": {
    "uid1": 0,
    "uid2": 1
  },
  "status": "active",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### `comunidad_messages`

Subcoleccion de `comunidad_conversations/{convId}/messages`

Campos:

- senderId
- senderName
- text
- media opcional
- read
- createdAt

### `comunidad_reports`

```json
{
  "targetType": "post",
  "targetId": "post_1",
  "reason": "spam",
  "details": "Promocion enganosa",
  "reportedBy": "uid",
  "status": "open",
  "createdAt": "timestamp",
  "reviewedAt": null,
  "reviewedBy": null,
  "resolution": ""
}
```

### `comunidad_user_states`

Estado por usuario dentro del modulo:

- estado del modulo
- rol del modulo
- razon de bloqueo o silencio
- onboarding del modulo
- preferencias

Ejemplo:

```json
{
  "userId": "uid",
  "moduleRole": "participant",
  "status": "active",
  "mutedUntil": null,
  "mutedReason": "",
  "blockedReason": "",
  "blockedAt": null,
  "blockedBy": null,
  "prefs": {
    "showGlobal": true,
    "showCareer": true
  },
  "onboarding": {
    "tour_v1": true
  },
  "updatedAt": "timestamp"
}
```

Nota:

- si favoritos se implementan mas adelante, deben ir en coleccion o subcoleccion propia, no como arreglo creciente en este documento

## Estrategia de tiempo real

Usar tiempo real solo donde genere valor claro:

- feed principal visible
- detalle del post abierto
- comentarios del post abierto
- conversacion activa de mensajes
- panel admin con reportes abiertos

Evitar streams innecesarios para:

- historicos largos
- listas secundarias no visibles
- busquedas globales
- perfiles de grupos no abiertos

### Recomendacion tecnica

- `onSnapshot` solo en vistas activas
- cleanup obligatorio con `ctx.ModuleManager.addSubscription(...)`
- paginacion para feed historico
- limites por consulta
- orden por `lastActivityAt` o `createdAt`
- `load more` o scroll incremental

## Backend propuesto

## Archivo nuevo

- `functions/comunidad.js`

## Export en backend

Agregar en `functions/index.js`:

```js
Object.assign(exports, require('./comunidad'));
```

## Funciones recomendadas

### Fase 1

- `comunidadCreatePost`
- `comunidadUpdatePost`
- `comunidadDeletePost`
- `comunidadCreateComment`
- `comunidadReactToTarget`
- `comunidadReportContent`

### Fase 2

- `comunidadModeratePost`
- `comunidadBlockUser`
- `comunidadUnblockUser`
- `comunidadMuteUser`
- `comunidadUnmuteUser`

### Fase 3

- `comunidadCreateOrGetConversation`
- `comunidadSendMessage`
- `comunidadNotifyNewMessage`

### Fase 4

- `comunidadCreateGroup`
- `comunidadJoinGroup`
- `comunidadLeaveGroup`

### Que debe ir por Cloud Functions

- acciones de moderacion
- bloqueos y silencios
- validaciones sensibles
- envio de notificaciones
- conteos agregados complejos
- operaciones multi-documento delicadas
- escritura principal de posts y comentarios si se quiere mantener mas control

### Que puede ir directo desde cliente

Solo operaciones simples y seguras si las reglas quedan muy bien cerradas:

- leer feed
- leer comentarios
- reacciones ligeras

Recomendacion:

- posts, reportes, moderacion y mensajeria mejor por Function o con validaciones muy cuidadas

## Seguridad y reglas

## Firestore Rules

Se deberan agregar reglas para:

- lectura segun alcance del post
- escritura solo de usuarios autenticados y no bloqueados ni silenciados del modulo
- comentarios solo si el post sigue activo y comentarios habilitados
- reacciones solo una por usuario y target
- reportes solo por usuarios autenticados
- grupos con privacidad publica o privada
- conversaciones solo para participantes
- mensajes solo para participantes
- panel admin solo para `superadmin` o `permissions.comunidad = 'admin'`

## Politicas funcionales recomendadas

- usuario bloqueado en Comunidad no puede publicar, comentar, reaccionar ni mandar mensajes
- usuario silenciado puede seguir leyendo pero no interactuar
- ambos pueden seguir usando SIA fuera del modulo
- admin puede ocultar una publicacion sin borrarla
- borrado fuerte solo para casos excepcionales
- conservar evidencia minima para moderacion

## Seguridad de contenido

- sanitizar cualquier texto interpolado
- limitar tamanos de texto
- limitar numero de imagenes por post
- validar mime type y peso de archivos
- rate limit por usuario para reducir spam
- impedir edicion de authorId, authorRoleKind, scope, createdAt y campos sensibles

## Indices esperados

En `firestore.indexes.json` probablemente se necesitaran indices para:

- `comunidad_posts` por `status + scope + lastActivityAt`
- `comunidad_posts` por `status + type + createdAt`
- `comunidad_posts` por `status + careerTargets + lastActivityAt`
- `comunidad_comments` por `postId + createdAt`
- `comunidad_reports` por `status + createdAt`
- `comunidad_group_members` por `userId + joinedAt`
- `comunidad_conversations` por `participants + updatedAt`

## Experiencia estudiante propuesta

## Pantalla principal

Secciones sugeridas:

- hero corto
- composer rapido
- tabs o chips:
  - Todo
  - Mi carrera
  - Preguntas
  - Perdidos
  - Ventas
  - Avisos
- feed de publicaciones
- acceso a tutorial

Nota:

- acceso a mensajes se agrega cuando entre Fase 3

## Composer

Debe permitir:

- texto rapido
- escoger tipo de publicacion
- escoger alcance
- seleccionar modo de contenido simple o bullets
- adjuntar imagen
- publicar sin demasiados pasos

## Tarjeta de post

Debe mostrar:

- autor
- badge de identidad
- carrera o area
- tipo
- tiempo relativo
- alcance
- contenido
- media
- conteos
- comentar
- reaccionar
- reportar

## Tutorial

Debe incluir:

- boton para repetir tutorial
- primera ejecucion por usuario
- guardar estado en preferencias de usuario
- pasos enfocados en:
  - publicar
  - filtrar
  - comentar
  - reportar

Patron a seguir:

- igual al usado por Biblio y Medi con `sia-onboarding-tour`

## Experiencia admin propuesta

## Vista admin de Comunidad

Tabs sugeridas:

- Feed moderado
- Reportes
- Usuarios bloqueados
- Usuarios silenciados
- Configuracion

## Capacidades admin

- revisar publicaciones recientes
- ver posts reportados
- ocultar o restaurar
- fijar avisos
- bloquear usuarios del modulo
- desbloquear
- silenciar usuarios del modulo
- quitar silencio
- cerrar comentarios
- monitorear actividad reciente

## Configuracion basica del modulo

Ejemplos:

- activar o pausar publicaciones de cierto tipo
- limite de media
- reglas visibles de convivencia
- mensajes de bienvenida del modulo

## Notificaciones

Reutilizar el pipeline actual:

- escribir documentos en `usuarios/{uid}/notificaciones`
- dejar que `functions/index.js` siga enviando push FCM

Eventos sugeridos:

- nueva respuesta a mi post
- nuevo comentario en mi post
- nuevo mensaje privado
- accion admin relevante
- reporte resuelto si aplica

## Rendimiento y optimizacion

## Recomendaciones

- paginacion desde el inicio
- no renderizar feed infinito sin limites
- cache temporal para listas secundarias
- imagenes comprimidas
- previews ligeros
- consultas con `limit`
- counters agregados en documento para no recalcular todo

## Riesgos principales

- si se intenta montar sobre `Foro`, el modelo se ensucia
- si todo es real-time sin control, suben mucho las lecturas
- si la moderacion no existe desde Fase 2, el modulo se puede degradar rapido
- si el bloqueo se hace a nivel app y no a nivel modulo, la UX sera demasiado agresiva
- si se mezclan eventos y red social en una sola vista, el usuario se confundira
- si no se congela desde el inicio la identidad visual del autor, el modulo se volvera inconsistente

## Definition of Done por fase

## DoD Fase 1

- existe `view-comunidad`
- carga lazy correcta
- visible en dashboard y drawer
- usuarios autenticados pueden entrar segun permisos
- la tarjeta de post distingue visualmente al autor
- feed principal funciona
- usuario puede publicar
- comentarios y respuestas funcionan
- reacciones funcionan
- reportes basicos funcionan
- tutorial funcional
- mobile-first usable

## DoD Fase 2

- admin puede ver reportes
- admin puede ocultar post
- admin puede bloquear usuario del modulo
- admin puede silenciar usuario del modulo
- reglas y backend protegen acciones sensibles

## DoD Fase 3

- mensajeria privada estable
- tiempo real del hilo activo
- notificaciones y unread count

## DoD Fase 4

- grupos se pueden crear y moderar
- posts por grupo respetan privacidad
- roles de grupo funcionan

## Roadmap de implementacion sugerido

1. Cableado base de vista, permisos y navegacion
2. Servicio de datos base y colecciones
3. Feed estudiante
4. Composer y publicaciones
5. Comentarios y respuestas
6. Tutorial y estados del modulo
7. Reglas e indices
8. Panel admin minimo
9. Mensajeria privada
10. Grupos
11. Optimizacion y refinamiento visual

## Recomendacion final

La mejor ruta para SIA es crear `Comunidad` como modulo independiente y dejar a `Foro` exclusivamente para eventos. Eso evita deuda tecnica, mantiene la semantica correcta del sistema y permite construir una experiencia social real, moderna y escalable sin romper la arquitectura ya existente.

## Siguiente paso de desarrollo

Arrancar con la Fase 1 usando estos entregables minimos:

- `view-comunidad`
- ruta `/comunidad`
- `public/services/comunidad-service.js`
- `public/modules/comunidad/comunidad.shared.js`
- `public/modules/comunidad/comunidad.student.js`
- `public/modules/comunidad.js`
- permisos y acceso en `firebase.js`
- carga lazy en `router.js`
- tarjeta de acceso en `app.js`
- estilos base propios del modulo
