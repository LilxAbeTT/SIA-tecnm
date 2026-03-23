---
description: Diagnosticar, barrer y corregir bugs de SIA por flujo, vista, modulo o servicio, incluyendo validacion, hallazgos pendientes y siguientes mejoras
---
# Workflow: Solucionar Bugs y Barrer Modulos en SIA (`/solucionar_bug_sia`)

## Objetivo

Este workflow existe para resolver bugs de forma completa en SIA, no solo para "parchar un boton".

Debe servir tanto para:

- arreglar un bug puntual y reproducible
- investigar un error sin causa clara
- revisar un flujo roto de punta a punta
- hacer un barrido amplio de un modulo completo para encontrar multiples bugs
- corregir varios bugs relacionados sin romper otras vistas o roles
- cerrar con pendientes tecnicos, siguientes revisiones y mejoras recomendadas

SIA mezcla `index.html`, `app.js`, `router.js`, Web Components, modulos IIFE, globals `window.*`, servicios Firebase y reglas de seguridad. Por eso, un bug puede nacer en:

- el punto de carga del archivo
- una exportacion publica faltante
- un `onclick` roto
- un listener mal atado o duplicado
- el DOM renderizado en otro momento
- el servicio incorrecto o una firma inconsistente
- permisos, `firestore.rules` o roles
- estado stale, listeners zombie, timers o race conditions

Antes de tocar codigo, toma como referencia `.agents/project-map.md`.

---

## Uso

Ejemplos de invocacion:

- `@solucionar_bug_sia En biblioteca, al solicitar un libro el modal se queda congelado`
- `@solucionar_bug_sia Revisa todo admin medi, encuentra bugs y corrige los que tengan riesgo bajo o medio`
- `@solucionar_bug_sia Hay errores al navegar entre /aula y /dashboard, investiga y arregla la causa raiz`
- `@solucionar_bug_sia Haz un barrido completo de reportes-biblio: detecta bugs, corrigelos y deja mejoras sugeridas`
- `@solucionar_bug_sia En cafeteria admin el guardado falla a veces; rastrea si el problema esta en UI, servicio o reglas`

---

## Regla Madre

Nunca declares "bug resuelto" solo porque ya no ves el error en una linea.

Debes identificar:

1. donde nace el fallo
2. en que capa se manifiesta
3. que flujo o rol queda afectado
4. cual es la correccion minima y correcta
5. que validacion demuestra que no rompiste lo adyacente

---

## FASE 0: Definir el Alcance Real

Antes de investigar o editar:

1. Lee `.agents/project-map.md`.
2. Determina el tipo de pedido:
   - `bug-puntual`
   - `bug-flujo`
   - `bug-modulo-completo`
   - `bug-datos-servicio`
   - `bug-permisos-seguridad`
   - `bug-rendimiento-estabilidad`
   - `regresion`
3. Ubica el alcance tecnico:
   - vista o `viewId`
   - rol afectado
   - modulo estudiante o admin
   - servicio(s) involucrados
   - coleccion(es) Firebase involucradas
   - archivos de soporte: `router.js`, `app.js`, `index.html`, componentes, estilos, reglas
4. Aclara internamente si el usuario pidio:
   - solo diagnostico
   - diagnostico + correccion
   - barrido de bugs + correccion + backlog de mejoras

Si el bug involucra varios archivos, no bases la solucion en un solo archivo.

---

## FASE 1: Ubicacion y Trazabilidad Completa

Debes rastrear el flujo real del bug de afuera hacia adentro.

### 1. Punto de entrada

Ubica como se carga la pieza afectada:

- `public/core/router.js` si es vista lazy-loaded
- `public/index.html` si es script global o shell
- `public/app.js` si el flujo nace en bootstrap, auth, menu, dashboard o shell

### 2. Superficie visible

Ubica el DOM real:

- `id` del contenedor o la vista
- HTML estatico en `index.html`
- HTML renderizado por strings dentro del modulo
- Web Component relacionado si existe
- botones, tabs, modales, formularios y `data-*` que participan

### 3. Punto exacto de disparo

Rastrea donde se ejecuta la accion:

- `onclick="Modulo.metodo()"`
- `addEventListener(...)`
- `dispatchEvent` / `CustomEvent`
- cambio de hash o navegacion
- `onSnapshot`, timers, observers o callbacks asincronos

### 4. Capa de datos

Si el bug toca lectura/escritura:

- ubica el servicio de `public/services/`
- verifica quien arma el payload
- revisa firma de entrada y forma de retorno
- revisa si el modulo esta metiendo logica de Firebase que deberia vivir en el servicio

### 5. API publica real

En arquitectura SIA, revisa siempre:

- `return { ... }` del IIFE
- `window.Modulo = ...`
- namespaces hijos como `window.AdminMedi.Ui`
- wrappers legacy usados por HTML inline

Si una funcion es llamada desde el HTML o desde otro modulo, debe seguir existiendo con el mismo nombre o con un wrapper compatible.

---

## FASE 2: Reproducir y Aislar

Antes de corregir, aterriza el fallo.

Debes documentar para ti mismo:

1. paso exacto que dispara el bug
2. comportamiento esperado
3. comportamiento actual
4. si el bug es:
   - siempre reproducible
   - intermitente
   - dependiente de rol
   - dependiente de datos vacios o incompletos
   - dependiente de timing o doble inicializacion
5. si existe regresion probable por cambios recientes en:
   - HTML o `id`s
   - API publica del modulo
   - servicio
   - router o load order
   - reglas de Firestore

Si no puedes reproducir visualmente, igual debes aislar la causa por lectura de codigo y declarar la suposicion con honestidad.

---

## FASE 3: Diagnostico por Capa

No diagnostiques "a ojo". Revisa estas capas en este orden hasta encontrar la causa raiz.

### A. Carga y bootstrap

Busca problemas como:

- archivo no cargado
- orden de carga incorrecto
- dependencia que aun no existe al ejecutar
- `init()` que no corre o corre dos veces
- vista incorrecta para el rol activo

### B. API publica, globals y handlers inline

Busca problemas como:

- funcion no exportada en `return { ... }`
- typo en `window.Modulo`
- `onclick` apuntando a un metodo inexistente
- wrapper legacy roto
- renombre parcial de una funcion sin migrar todos los callers

Esta es una de las causas mas frecuentes en SIA.

### C. DOM, render y listeners

Busca problemas como:

- selector incorrecto
- `id` duplicado o cambiado
- listener atado antes de que exista el nodo
- `innerHTML` que destruye listeners previos
- modal/tab que re-renderiza y deja referencias stale
- boton que se puede pulsar varias veces mientras sigue la promesa anterior

### D. Estado y ciclo de vida

Busca problemas como:

- `_ctx` nulo o incompleto
- datos privados stale entre cambios de vista
- flags o caches nunca reseteados
- `onSnapshot` sin cleanup
- timers o intervals activos al salir de la vista
- doble render o doble submit

### E. Datos y servicios

Busca problemas como:

- servicio equivocado
- firma rota entre modulo y servicio
- `await` faltante
- `undefined`, `null` o arrays vacios no contemplados
- consulta que ya no coincide con la forma actual de los documentos
- filtro hecho en UI cuando deberia vivir en servicio
- logica Firebase escrita en el modulo por "salir del paso"

### F. Permisos, roles y reglas

Busca problemas como:

- UI deja intentar una accion que el rol no puede hacer
- mismatch entre `role`, `permissions`, `allowedViews` y vista cargada
- operacion valida en UI pero rechazada por `firestore.rules`
- modulo admin usado por un rol que en realidad carga otra variante

Si el bug parece "no guarda" o "no carga" sin razon visible, revisa tambien `firestore.rules` y `storage.rules`.

### G. UX, feedback y resiliencia

Busca problemas como:

- falta de `try/catch`
- error tragado silenciosamente
- falta de `showToast(...)`
- boton sin estado loading / disabled
- formulario que no valida antes de guardar
- error de backend que deja la UI trabada

### H. Regresiones adyacentes

Despues de detectar la causa, revisa si el mismo patron puede estar rompiendo:

- variante estudiante y admin
- mobile y desktop
- tabs hermanas del mismo modulo
- modales y acciones relacionadas
- otras llamadas al mismo servicio

---

## FASE 4: Corregir en la Capa Correcta

La correccion debe vivir donde realmente pertenece.

### Regla de ubicacion

- si el problema es de consulta, payload, transformacion o escritura: corrige el servicio
- si el problema es de render, estado local o listeners: corrige el modulo o componente
- si el problema es de carga: corrige `router.js`, `index.html` o `app.js`
- si el problema es de permisos reales: corrige tambien reglas si aplica

### Reglas obligatorias al corregir

1. No metas logica de Firebase en un modulo si ya existe un servicio para ello.
2. No exportes funciones nuevas en `window.*` salvo que realmente deban ser publicas.
3. Si el HTML llama `Modulo.metodo()`, preserva esa API o agrega wrapper compatible.
4. Si el bug es asincrono, agrega:
   - `try/catch`
   - feedback visual
   - estado loading o disabled
   - guardas contra doble submit
5. Si el bug nace por datos incompletos, agrega null safety y defaults sensatos.
6. Si el bug es una regresion por re-render, revisa tambien listeners y cleanup.
7. No mezcles una refactorizacion grande con un bug fix pequeno salvo que sea estrictamente necesario para corregir la causa raiz.

---

## FASE 5: Modo Barrido de Modulo Completo

Si el usuario pide "revisa todo el modulo", "encuentra todos los bugs" o "haz limpieza completa", usa este modo.

### 1. Arma el inventario del modulo

Debes listar:

- archivo orquestador
- submodulos
- servicios usados
- componentes implicados
- colecciones Firebase
- reglas o configuraciones tocadas
- variantes de rol

### 2. Divide el modulo por subflujos

Como minimo revisa:

- entrada al modulo e `init`
- carga inicial de datos
- estados vacios / loading / error
- busquedas, filtros, tabs y paginacion
- crear, editar, guardar, eliminar, cancelar
- modales y cierres
- navegacion interna o retorno
- exports, impresiones o descargas si existen
- permisos por rol
- cleanup de listeners y timers

### 3. Registra hallazgos por severidad

Clasifica cada bug como:

- `critico`: rompe el flujo principal, expone datos o deja la vista inutilizable
- `alto`: rompe una accion importante o genera datos incorrectos
- `medio`: falla parcial, edge case visible o regresion localizada
- `bajo`: error menor, mensaje roto, falta de feedback o detalle visual funcional

### 4. Decide que corregir en la misma pasada

Debes corregir de inmediato:

- bloqueadores claros
- bugs de riesgo bajo o medio con causa identificada
- bugs repetidos con la misma causa raiz

Debes dejar como pendiente explicitado:

- cambios de alto riesgo estructural
- bugs que dependan de reglas, datos remotos o decisiones funcionales no confirmadas
- refactors grandes detectados durante el barrido

### 5. Cierra con backlog de mejoras

Al terminar un barrido de modulo, siempre redacta:

- bugs corregidos
- bugs pendientes
- deuda tecnica detectada
- siguientes revisiones recomendadas
- mejoras no criticas pero valiosas

No prometas "encontre todos los bugs". Debes hablar de:

- bugs confirmados
- bugs probables
- zonas revisadas
- zonas no verificadas

---

## FASE 6: Verificacion Paranoica

Nunca cierres el trabajo sin validar tanto el camino feliz como el de error.

### Checklist minimo

1. La vista sigue cargando.
2. El modulo correcto se sigue inicializando para el rol correcto.
3. La API publica y los `onclick` no se rompieron.
4. El flujo principal funciona.
5. El flujo de error muestra feedback y no deja la UI colgada.
6. No introdujiste listeners duplicados ni variables stale.
7. Si tocaste servicio, revisaste todas las llamadas a esa funcion.
8. Si tocaste reglas o permisos, revisaste la ruta completa cliente -> servicio -> Firestore.
9. Si cambiaste estructura de archivos o responsabilidades, actualizaste `.agents/project-map.md`.

### Verificaciones extra recomendadas

- buscar referencias con `rg` al metodo tocado
- revisar `return { ... }` y `window.*`
- revisar llaves, cierres y bloques del IIFE
- revisar que el HTML renderizado siga apuntando a `id`s reales
- revisar que no haya `catch` vacios ni errores silenciados

---

## Formato de Entrega Esperado

Cuando este workflow termine, el resultado debe dejar claro:

### Si fue bug puntual

- causa raiz
- archivo(s) corregidos
- que cambio se hizo
- como se valido
- riesgo residual

### Si fue barrido de modulo

- alcance revisado
- lista de bugs corregidos
- lista de bugs pendientes o no confirmados
- riesgos o zonas no verificadas
- siguientes revisiones sugeridas
- mejoras tecnicas recomendadas

---

## Definition of Done

Este workflow solo esta realmente terminado si:

- la causa raiz fue identificada o acotada con evidencia tecnica
- la correccion se hizo en la capa correcta
- no se rompio la API publica existente
- el flujo principal y el flujo de error quedaron cubiertos
- si hubo barrido de modulo, los hallazgos quedaron priorizados
- quedo documentada la deuda residual y las siguientes mejoras

---

## Anti-Patrones Prohibidos

- parchar la UI cuando el problema real esta en el servicio o en reglas
- meter consultas Firebase directas en un modulo por rapidez
- exportar todo al `window` para "hacer que funcione"
- declarar resuelto un bug sin rastrear `router`, HTML, listeners y servicio cuando aplica
- corregir un `onclick` rompiendo compatibilidad con otras llamadas
- mezclar un refactor gigante no pedido dentro de un arreglo pequeno
- decir "todo bien" sin revisar estados vacios, errores y cleanup
- afirmar que se reviso "todo el modulo" si solo se leyo un archivo

---

## Prompt Recomendado de Uso

Usa este workflow para investigar y resolver bugs en SIA siguiendo la arquitectura real del proyecto.

Primero:

- revisa `.agents/project-map.md`
- ubica vista, rol, modulo, servicio y punto de carga real
- rastrea DOM, listeners, `onclick`, `window.*` y dependencias
- identifica la causa raiz por capas: carga, API publica, DOM, estado, servicio, reglas y UX

Despues:

- corrige en la capa correcta
- valida flujo principal y flujo de error
- si el alcance es un modulo completo, haz barrido de bugs por subflujo
- entrega bugs corregidos, pendientes, riesgos y siguientes mejoras recomendadas
