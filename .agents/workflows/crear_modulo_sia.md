---
description: Implementar cambios completos en SIA respetando la arquitectura real del proyecto: modulos, submodulos, servicios, componentes, router, shell, estilos y reglas
---
# Workflow: Implementar Cambios en SIA (`/crear_modulo_sia`)

## Objetivo

Usa este workflow cuando el usuario quiera construir, extender, editar o mejorar casi cualquier parte de SIA.

Debe servir para:

- crear una vista nueva completa
- mejorar una funcion puntual
- editar un modulo existente
- agregar o dividir submodulos
- mover logica a `public/services/`
- crear o ajustar Web Components
- tocar `router.js`, `app.js`, `main.js`, `index.html` o estilos
- cablear permisos, reglas, indices o Cloud Functions cuando el cambio lo requiera

Aunque el nombre historico sea `/crear_modulo_sia`, este workflow ya no se limita a `public/modules/<nombre>.js`.

SIA no es una SPA convencional. Mezcla:

- `public/index.html` con muchos `view-*`, modales y `onclick`
- `public/app.js` con bootstrap, auth, shell, `ModuleManager` y `window.ModuleStateManager`
- `public/core/router.js` con lazy-load por vista y rol
- modulos globales `window.*`
- submodulos namespaced
- Web Components
- servicios Firebase expuestos como globals

Por eso, antes de editar, debes decidir **en que capa vive realmente el cambio**.

Antes de tocar codigo, toma como referencia `.agents/project-map.md`.

---

## Regla Madre

No implementes "desde un solo archivo".

Primero debes reconstruir el flujo real:

1. como entra el usuario al feature
2. como se carga el codigo
3. que API publica se espera
4. que DOM o `view-*` existe
5. que servicio mueve los datos
6. que rol o permiso puede usarlo

Si no sigues ese recorrido, es facil romper rutas, `onclick`, roles, scripts lazy-loaded o globals existentes.

---

## FASE 0: Contexto Minimo Obligatorio

Antes de proponer o editar:

1. Lee `.agents/project-map.md`.
2. Clasifica el pedido en una o varias categorias:
   - `nueva-vista`
   - `modulo-existente`
   - `submodulo`
   - `componente-ui`
   - `servicio-datos`
   - `shell-core-router`
   - `estilos-layout`
   - `reglas-functions-seguridad`
   - `feature-end-to-end`
3. Ubica el punto de entrada real:
   - `public/core/router.js`
   - `public/app.js`
   - `public/main.js`
   - `public/index.html`
   - `public/components/`
   - `public/modules/`
   - `public/services/`
4. Identifica el patron de carga:
   - lazy-load en `_loadModuleDependencies(viewId)`
   - script boot-time desde `index.html`
   - import ES module desde `main.js`
   - `customElements.define(...)`
5. Identifica la API publica que ya existe o que debera existir:
   - `window.Modulo`
   - `window.Modulo.metodo`
   - `init(ctx)`
   - `initStudent(ctx)`
   - `initAdmin(ctx)`
   - `initPublic(...)`
6. Identifica dependencias reales:
   - servicios `window.*Service`
   - helpers `window.SIA.*`
   - `Store`
   - `Notify`
   - `window.ModuleStateManager`
   - `ctx.ModuleManager`

No asumas archivos inexistentes.

Ejemplos de supuestos falsos que este workflow debe evitar:

- `public/core/ModuleStateManager.js` no existe; hoy vive en `public/app.js` y se expone como `window.ModuleStateManager`
- la fuente real de Firebase no es `../config/firebase.js`; en este proyecto manda `public/services/firebase.js`, `window.SIA` y el `ctx` que arma el router

---

## FASE 1: Elegir la Capa Correcta

Antes de escribir una sola linea, decide donde debe vivir el cambio.

- `public/modules/`
  Usa esto para logica de una vista o pantalla concreta.

- `public/modules/<area>/` o `public/modules/admin-<area>/`
  Usa esto cuando el modulo ya esta dividido y debes respetar ese split existente.

- `public/components/`
  Usa esto para UI reusable o piezas de shell basadas en Custom Elements.

- `public/services/`
  Usa esto para Firestore, Auth, Storage, Cloud Functions, payloads, normalizacion y transformacion de datos.

- `public/core/`
  Usa esto para router, estado global y helpers base del shell.

- `public/app.js`
  Usa esto para bootstrap global, auth flow, shell, drawers, dashboard, `ModuleManager`, `window.ModuleStateManager` o wiring transversal.

- `public/index.html`
  Usa esto cuando debas crear un `view-*`, un modal global, un contenedor real, una accion inline o ajustar el boot order.

- `public/styles/` o `public/styles.css`
  Usa esto para estilos. Respeta el archivo tematico ya existente si aplica.

- raiz del proyecto
  Usa `firestore.rules`, `storage.rules`, `firestore.indexes.json` y `functions/` cuando el cambio toque permisos reales o backend.

Regla clave:

**No mandes todo a `public/modules/<nombre>.js` por costumbre.**

---

## FASE 2: Elegir el Patron Correcto del Area

SIA usa varios patrones validos. Debes continuar el que ya usa el area afectada.

### Patron A: Modulo global IIFE

Ejemplo mental:

```javascript
if (!window.MiModulo) {
  window.MiModulo = (function () {
    let _ctx = null;

    async function init(ctx) {
      _ctx = ctx;
    }

    return { init };
  })();
}
```

### Patron B: Orquestador + submodulos namespaced

Ejemplos reales del repo:

- `window.AdminMedi.Ui`
- `window.AdminMedi.Agenda`
- `window.AdminMedi.Chat`
- `window.AdminMedi.Consultas`
- `window.AdminMedi.Tools`

### Patron C: Orquestador delegado

Ejemplo real:

- `window.Foro` delega a submodulos estudiante/admin y helpers shared

### Patron D: Web Component

Ejemplos reales:

- `sia-student-dashboard`
- `sia-navbar`
- `sia-admin-navbar`
- `vocacional-landing`

### Patron E: Core ES module

Ejemplo real:

- `public/main.js`
- `public/core/router.js`
- `public/core/state.js`

### Regla de compatibilidad

Si el area ya expone `window.Modulo.metodo`, debes preservarlo.

No rompas:

- `onclick="Modulo.metodo()"`
- llamadas desde otros modulos
- firmas `init(...)`
- wrappers `initStudent`, `initAdmin`, `initPublic`

Si quieres refactorizar internamente, hazlo sin romper la API publica esperada.

---

## FASE 3: Reconstruir el Flujo Real Antes de Editar

Antes de implementar, responde internamente estas preguntas:

1. Que accion carga o dispara el feature
   - ruta
   - boton
   - navbar
   - drawer
   - dashboard card
   - `CustomEvent`

2. Que archivo crea o muestra el DOM real
   - `index.html`
   - string templates dentro del modulo
   - Web Component

3. Que archivo inicia la logica
   - `router.js`
   - `app.js`
   - modulo global
   - componente

4. Que servicio mueve los datos
   - `window.XService`
   - `window.SIA`
   - Cloud Function

5. Que permisos participan
   - `allowedViews`
   - `permissions`
   - `role`
   - `window.SIA.canAccessView(...)`
   - `window.SIA.getHomeView(...)`
   - `window.SIA.canAdmin...(...)`

6. Que riesgo de ciclo de vida existe
   - doble init
   - listeners duplicados
   - `onSnapshot` sin cleanup
   - timers vivos al salir
   - estado stale

No pases a editar mientras no tengas ubicados esos puntos.

---

## FASE 4: Implementacion Segun el Tipo de Cambio

### A. Si vas a crear una vista nueva o un modulo completo

Debes revisar y cablear, cuando aplique:

1. `public/index.html`
   - crear o reutilizar el contenedor `view-*`
   - agregar modales o secciones reales si el feature lo requiere

2. `public/core/router.js`
   - `routes`
   - `handleLocation()`
   - `_loadModuleDependencies(viewId)`
   - `_dispatchViewEvent(viewId)`
   - `_updateBreadcrumbs(viewId)`
   - `_canAccess(...)` si el flujo depende de acceso especial

3. `public/services/firebase.js`
   - `ALL_KNOWN_VIEWS`
   - `getPermissionViews(...)`
   - `DEFAULT_STANDARD_VIEWS`
   - `getEffectiveAllowedViews(...)`
   - `getHomeView(...)`
   - `canAccessView(...)`
   - helpers `canAdmin...(...)` si la vista tiene variante admin

4. `public/app.js`
   - dashboard, drawers, accesos rapidos o wiring global si el nuevo feature debe aparecer ahi

5. carga de dependencias
   - servicios primero
   - submodulos despues
   - orquestador al final

6. API publica del modulo
   - exponer `window.Modulo`
   - definir `init(...)` o la firma que el router realmente espera

7. accesos visibles
   - smart cards
   - navbar
   - bottom nav
   - speed dial
   - panel departamental
   - deep links o notificaciones

### B. Si vas a mejorar funciones o editar un modulo existente

Debes:

- rastrear todas las llamadas a la funcion con `rg`
- preservar nombres publicos usados por HTML o por otros modulos
- respetar el split actual del area
- mover logica repetida a helpers o submodulos solo si reduce riesgo
- evitar refactors gigantes si el pedido es pequeno, salvo que el cambio sea imposible sin ordenar primero

Si el archivo ya es un orquestador, mantenlo como orquestador.

### C. Si el cambio requiere crear o mover logica a un servicio

Debes:

- usar `public/services/`
- exportar de forma compatible con el repo, normalmente `window.XService`
- trabajar con `ctx.db`, `ctx.auth`, `ctx.storage`, `window.SIA` y `firebase.functions()` segun el area
- dejar la UI consumiendo el servicio, no escribiendo Firestore por su cuenta
- filtrar, paginar y limitar consultas
- revisar si necesitas indices o reglas

No impongas un patron de imports que el area actual no usa.

### D. Si el cambio encaja mejor como Web Component

Debes:

- crearlo en `public/components/`
- extender `HTMLElement`
- usar `connectedCallback()` y `disconnectedCallback()`
- limpiar listeners, observers, intervals y timeouts
- registrar con `customElements.define(...)`
- integrarlo por import o por carga existente del shell

No conviertas a Web Component un modulo entero si el area ya vive mejor como modulo global o lazy-loaded.

### E. Si el cambio toca shell, auth, dashboard o router

Debes leer juntos:

- `public/app.js`
- `public/main.js`
- `public/core/router.js`
- `public/index.html`

Casos especiales del proyecto que no debes tratar como "un modulo mas":

- `view-dashboard` vive entre `index.html`, `app.js` y componentes
- registro vive entre `public/modules/register.js`, `public/components/register-wizard.js`, `public/app.js` e `index.html`
- vistas publicas como vocacional, encuesta publica o QA secret login tienen tratamiento especial en router

### F. Si el cambio es principalmente de estilos o layout

Debes:

- respetar Bootstrap y clases existentes antes de inventar CSS nuevo
- revisar `id`s, `data-*`, modales y listeners antes de mover markup
- preferir el archivo tematico correcto en `public/styles/`
- validar desktop y mobile

### G. Si el cambio toca permisos, reglas o backend

Debes revisar tambien:

- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`
- `functions/`

La UI no basta si la operacion depende de permisos reales.

---

## FASE 5: Reglas Obligatorias Durante la Implementacion

1. Preserva `id`s, `data-*`, `onclick` y metodos publicos esperados.

2. Si renderizas HTML dinamico:
   - usa `textContent` cuando puedas
   - usa `escapeHtml` u otra sanitizacion cuando interpolas strings

3. Si agregas acciones async:
   - usa `try/catch`
   - muestra feedback con `showToast(...)` o `Notify` cuando aplique
   - evita doble submit
   - deshabilita botones si la accion puede repetirse

4. Si abres listeners o streams:
   - usa `ctx.ModuleManager.addSubscription(...)` o cleanup equivalente
   - limpia `onSnapshot`, intervals, observers y timeouts

5. Si el modulo necesita persistir estado entre vistas:
   - usa `window.ModuleStateManager`
   - no inventes otro state manager paralelo sin necesidad

6. Si el cambio toca roles:
   - valida acceso en UI y en la capa real de datos cuando corresponda
   - revisa `allowedViews`, `permissions`, `role` y helpers `window.SIA.*`

7. Si agregas archivos nuevos:
   - cablealos en el lugar correcto
   - `router.js` para lazy-load por vista
   - `index.html` solo si deben existir desde el arranque

8. Si el area ya usa submodulos:
   - no colapses todo otra vez en un solo archivo

9. Si el cambio es amplio o altera estructura:
   - actualiza `.agents/project-map.md`

10. No expongas mas globals a `window` de los necesarios.

---

## FASE 6: Verificacion Obligatoria

Antes de cerrar, verifica como minimo:

1. que el flujo cargue desde su punto de entrada real
2. que la ruta o accion visible siga llegando al feature correcto
3. que el orden de carga no se haya roto
4. que `window.Modulo`, `init(...)` y handlers inline sigan funcionando
5. que el rol correcto vea la variante correcta del modulo
6. que `allowedViews`, home view y permisos sigan coherentes
7. que las llamadas async tengan feedback y manejo de error
8. que no hayas dejado listeners, timers o snapshots zombie
9. que la UI funcione en mobile y desktop cuando aplique
10. que no hayas agregado consultas Firebase innecesarias
11. que reglas, indices o functions esten alineados si el cambio las necesita
12. que `project-map.md` quede actualizado si cambiaste estructura relevante

Si no puedes verificar algo, debes decirlo explicitamente al final.

---

## Definition of Done

Este workflow solo queda bien si:

- se eligio la capa correcta para cada parte del cambio
- la implementacion respeta la arquitectura real del area
- no se rompieron rutas, globals, `onclick` ni firmas publicas
- los datos quedaron del lado correcto, preferentemente en servicios
- el acceso por rol y vista sigue siendo coherente
- el feature nuevo o modificado quedo cableado de punta a punta
- la verificacion final cubre flujo feliz, flujo de error y riesgos residuales

---

## Anti-Patrones Prohibidos

- asumir que todo cambio nuevo debe vivir en `public/modules/<nombre>.js`
- crear una vista nueva sin tocar `index.html`, `router.js` y permisos cuando realmente hace falta
- romper un `onclick` por renombrar una funcion publica sin wrapper compatible
- meter consultas Firestore en UI por rapidez cuando deben vivir en `public/services/`
- cargar en `index.html` algo que debia ser lazy-loaded por `router.js`
- crear un state manager paralelo ignorando `window.ModuleStateManager`
- asumir imports o archivos Firebase que el repo no usa
- mezclar refactor gigante no pedido dentro de un ajuste pequeno sin necesidad real
- decir "ya quedo" habiendo leido solo un archivo

---

## Prompt Recomendado de Uso

```text
Implementa [PEDIDO] siguiendo .agents/workflows/crear_modulo_sia.md.

Obligatorio:
- leer primero .agents/project-map.md
- decidir la capa correcta del cambio
- revisar como se carga hoy: router.js, app.js, main.js, index.html, componente, modulo o servicio
- respetar globals, ids, handlers inline y firmas publicas existentes
- usar servicios para datos cuando corresponda
- cablear rutas, permisos, estilos, reglas o functions si el cambio lo requiere
- verificar flujo real de entrada, acceso por rol y manejo de errores
```

## Prompts Utiles por Tipo de Pedido

### Crear una vista nueva

```text
Crea el feature [NOMBRE] siguiendo .agents/workflows/crear_modulo_sia.md.
Quiero la vista completa, con contenedor real, ruta, lazy-load, modulo(s), servicio(s), permisos y accesos visibles si aplican.
No asumas un patron unico: usa la arquitectura real del area.
```

### Mejorar un modulo existente

```text
Mejora [RUTA/FEATURE] siguiendo .agents/workflows/crear_modulo_sia.md.
Primero rastrea como entra el flujo, que API publica expone y que archivos lo cargan.
Luego implementa la mejora sin romper handlers inline ni globals existentes.
```

### Implementar algo end-to-end

```text
Implementa [FEATURE] de punta a punta siguiendo .agents/workflows/crear_modulo_sia.md.
Si el cambio requiere tocar modulo, servicio, router, index, estilos, reglas o functions, hazlo en la capa correcta y deja todo cableado.
```
