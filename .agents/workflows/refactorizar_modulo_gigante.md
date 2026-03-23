---
description: Refactorizar archivos grandes de SIA en submódulos seguros, manteniendo API pública, orden de carga y arquitectura real del proyecto
---
# Workflow: Refactorizar Módulo Gigante en SIA

Usa este workflow cuando debas dividir un archivo grande o con demasiada deuda estructural en SIA sin romper la app. Este proyecto NO usa un framework SPA convencional; mezcla `index.html`, `app.js`, `main.js`, `router.js`, Web Components, módulos IIFE y globals `window.*`. Por eso, aquí el objetivo NO es "reescribir bonito", sino **extraer responsabilidades sin romper rutas, loaders, listeners, globals ni dependencias de Firebase**.

Antes de tocar código, toma como referencia `.agents/project-map.md`.

## Objetivo

Reducir deuda estructural en archivos grandes sin alterar:

- la API pública del módulo (`window.Modulo`, `window.Modulo.metodo`, etc.)
- el punto de entrada que espera el router (`init`, `initStudent`, `initAdmin`, etc.)
- el orden real de carga del proyecto
- el patrón actual de servicios en `public/services/`
- los `onclick`, `addEventListener`, `CustomEvent`, `ModuleManager` y limpiezas existentes

## Reglas Base de SIA

1. **Primero entiende cómo se carga el archivo.**
   - Si es una vista lazy-loaded, su carga normalmente vive en `public/core/router.js`, dentro de `_loadModuleDependencies(viewId)`.
   - Si es un script global, componente o boot script, su carga vive en `public/index.html`, dentro de `localScripts`.
   - No registres el mismo script en ambos lugares salvo que ya exista ese patrón y sea estrictamente necesario.

2. **Preserva el nombre global y la API pública existente.**
   - Si hoy existe `window.Medi.initStudent()`, debe seguir existiendo aunque por dentro delegue a submódulos.
   - Si hay `onclick="Medi.algo()"`, no lo rompas.

3. **No muevas lógica de Firebase al módulo si ya pertenece a un servicio.**
   - La lógica de datos debe quedarse en `public/services/`.
   - Si el módulo está haciendo demasiada lógica de datos, la refactorización puede extraer helpers o wrappers, pero no debe duplicar consultas.

4. **No inventes arquitectura paralela.**
   - Si el módulo ya usa `public/modules/admin-medi/`, `public/modules/aula/`, `public/modules/reportes/` o un namespace extendido, continúa ese patrón.
   - Si el archivo ya tiene un orquestador, mantenlo como orquestador.

5. **No asumas archivos inexistentes.**
   - `ModuleStateManager` en este proyecto está expuesto desde `public/app.js` como `window.ModuleStateManager`; no existe como `public/core/ModuleStateManager.js`.
   - Usa las herramientas reales del repo: `rg`, `router.js`, `index.html`, `app.js`, `project-map.md`.

6. **Actualiza `.agents/project-map.md` si la estructura del módulo cambia materialmente.**
   - Si el split crea submódulos nuevos o cambia el punto de orquestación, el mapa debe quedar alineado.

---

## FASE 0: Ubicación y Carga Real del Archivo

Antes de editar:

1. Lee `.agents/project-map.md`.
2. Identifica si el archivo objetivo es:
   - un módulo lazy-loaded por `router.js`
   - un script global cargado desde `index.html`
   - un archivo core (`app.js`, `main.js`, `router.js`, `state.js`, etc.)
3. Ubica:
   - qué `viewId` lo usa
   - qué función pública dispara el arranque (`init`, `initStudent`, `initAdmin`, etc.)
   - qué servicios usa
   - qué contenedores DOM y `id`s toca
4. Mide el archivo y confirma si el problema es:
   - tamaño
   - exceso de responsabilidades
   - estado compartido difícil de seguir
   - render imperativo excesivo
   - globals / listeners / HTML inline demasiado acoplados

---

## FASE 1: Inventario Exhaustivo Antes de Tocar Código

Usa `rg` para mapear TODO lo que el archivo expone y todo lo que lo llama.

Debes listar al menos:

1. **API pública actual**
   - Funciones del `return { ... }`
   - Funciones agregadas vía `window.Modulo = Object.assign(...)`
   - Cualquier asignación `window.Modulo = ...`

2. **Puntos externos que lo invocan**
   - `router.js`
   - `index.html`
   - HTML estático con `onclick`
   - HTML dinámico generado con strings
   - otros módulos o componentes que llamen `window.Modulo.algo()`

3. **Estado privado compartido**
   - `_ctx`
   - `_selectedSomething`
   - arrays de `unsub`
   - timers / intervals
   - caches
   - flags de idempotencia

4. **Dependencias estructurales**
   - servicios (`window.XService`)
   - Web Components
   - `Store`
   - `ModuleManager`
   - `Notify`
   - eventos globales (`window.dispatchEvent`, `document.addEventListener`)

5. **HTML crítico**
   - contenedores por `id`
   - modales inyectados
   - listeners inline
   - secciones duplicadas o legacy que puedan confundir el split

Si no tienes este inventario, NO empieces a mover funciones.

---

## FASE 2: Diseñar el Split Correcto

El archivo original debe quedar como **orquestador delgado**, no como reemplazo total.

### Estructura recomendada

Para módulos de vista:

- `public/modules/<modulo>.js` como orquestador
- `public/modules/<modulo>/<modulo>-ui.js`
- `public/modules/<modulo>/<modulo>-actions.js`
- `public/modules/<modulo>/<modulo>-state.js`
- `public/modules/<modulo>/<modulo>-helpers.js`

Para módulos administrativos ya divididos:

- `public/modules/admin-<modulo>/ui.js`
- `public/modules/admin-<modulo>/agenda.js`
- `public/modules/admin-<modulo>/tools.js`
- etc., respetando el patrón existente

Para archivos core:

- extrae a `public/core/` si es shell / router / estado
- extrae a `public/components/` si realmente es un Web Component
- extrae a `public/modules/app/` solo si es lógica de shell de aplicación y no de un módulo específico

### Criterios de división

Divide por responsabilidad real, no por tamaño arbitrario:

- render UI
- handlers de interacción
- navegación interna
- formularios / validación
- helpers puros
- estado compartido
- integraciones con servicios

### Reglas del diseño

- Mantén el archivo original con la misma API pública.
- Evita que submódulos dependan en silencio de variables privadas del padre.
- Si el estado debe compartirse, usa una de estas estrategias:
  - el orquestador pasa `ctx`, datos y callbacks explícitos
  - un namespace de estado compartido ya existente (`window.AdminMedi.State`, por ejemplo)
  - un submódulo de estado del mismo módulo
- No cambies nombres públicos salvo que actualices todas las referencias.

---

## FASE 3: Extracción Segura

Extrae en este orden:

1. **Helpers puros**
   - formateadores
   - normalizadores
   - builders de payload
   - funciones que no dependen de `_ctx` ni del DOM global

2. **Renderizadores o bloques UI**
   - funciones que devuelven HTML
   - vistas internas
   - tabs
   - paneles
   - modales

3. **Handlers o acciones**
   - guardar
   - abrir modal
   - cargar datos
   - cambiar pestaña
   - listeners

4. **Estado difícil**
   - solo cuando ya entendiste qué funciones lo consumen

### Patrones válidos para SIA

#### Patrón A: Namespace hijo

```javascript
if (!window.MiModulo) window.MiModulo = {};

window.MiModulo.UI = (function () {
  function renderMain(ctx) {
    // ...
  }

  return { renderMain };
})();
```

#### Patrón B: Extensión sobre namespace existente

```javascript
window.MiModulo = Object.assign(window.MiModulo || {}, (function () {
  function renderMain(ctx) {
    // ...
  }

  return { renderMain };
})());
```

### Regla crítica

Si una función hoy es pública, el orquestador debe seguir exponiéndola aunque por dentro delegue:

```javascript
function openModal() {
  return window.MiModulo.UI.openModal(_ctx);
}

return { init, openModal };
```

Eso protege `onclick`, router y llamadas externas.

---

## FASE 4: Cableado Correcto Según la Arquitectura de SIA

### Si el archivo es lazy-loaded por vista

Actualiza `public/core/router.js` en `_loadModuleDependencies(viewId)`.

Reglas:

- registra los submódulos en el array de dependencias del `viewId`
- respeta el orden real de carga
- el orquestador debe cargarse cuando sus dependencias ya existan
- no mandes estos scripts a `index.html` por defecto

### Si el archivo es global o boot-time

Actualiza `public/index.html`, dentro de `localScripts`.

Reglas:

- úsalo solo para scripts que deben existir desde el arranque
- respeta el orden actual de boot
- no metas módulos de vista comunes aquí solo por comodidad

### Si el archivo es `app.js` o `index.html`

Trátalo como refactorización de shell:

- separa features por responsabilidad
- reduce mezcla entre UI, boot, auth, avisos, dashboard, drawers, soporte, etc.
- conserva el orden de inicialización del arranque
- no muevas al router cosas que pertenecen al shell sin revisar todo el flujo

---

## FASE 5: Verificación Paranoica

Antes de dar por terminada la refactorización, debes comprobar:

1. **API pública preservada**
   - compara inventario inicial vs export final
   - ninguna función pública desapareció sin actualizar referencias

2. **Puntos de carga correctos**
   - `router.js` si era lazy-loaded
   - `index.html` si era global
   - no quedó doble registro

3. **Llamadas inline y rutas externas**
   - `onclick="Modulo.algo()"`
   - `addEventListener`
   - `window.Modulo.algo()`
   - `CustomEvent`

4. **Estado y cleanup**
   - timers
   - intervals
   - subscriptions
   - `ModuleManager.addSubscription`
   - flags de init duplicado

5. **DOM**
   - no introdujiste `id`s duplicados
   - no dejaste contenedores viejos sin uso
   - no rompiste modales o secciones renderizadas dinámicamente

6. **Servicios**
   - sigue usando `public/services/`
   - no se filtró lógica de Firestore/Auth/Storage al módulo por accidente

7. **Mapa del proyecto**
   - si cambió la estructura del módulo, actualiza `.agents/project-map.md`

---

## Definition of Done

Una refactorización queda bien solo si:

- el archivo original bajó de complejidad visible
- el punto de entrada del módulo sigue funcionando igual
- la API pública se mantuvo o se actualizó completamente en todo el proyecto
- el orden de carga quedó correcto
- no se duplicó lógica
- el estado quedó más claro
- el router y/o `index.html` reflejan la nueva estructura
- `project-map.md` quedó alineado si hubo cambios estructurales

---

## Anti-Patrones Prohibidos

- Reescribir a React, Vue o cualquier otra arquitectura nueva dentro de este workflow
- Cambiar el nombre global del módulo sin migrar todos los callers
- Mover lógica de servicios a módulos de vista
- Registrar módulos lazy-loaded en `index.html` "para salir del paso"
- Crear archivos nuevos sin cablearlos en el lugar correcto
- Romper `onclick` inline por olvidar wrappers públicos
- Suponer que `ModuleStateManager` es un archivo separado
- Borrar de golpe código viejo sin antes delegar, cablear y verificar

---

## Prompt Recomendado de Uso

Usa este prompt base:

```text
Refactoriza [RUTA_DEL_ARCHIVO] siguiendo .agents/workflows/refactorizar_modulo_gigante.md.

Objetivo:
- reducir deuda estructural sin cambiar la API pública
- mantener el punto de entrada actual del módulo
- dividir por responsabilidades reales del proyecto SIA

Obligatorio:
- revisar primero .agents/project-map.md
- inventariar API pública, inline handlers, estado compartido y puntos de carga
- usar la arquitectura real de SIA: router.js para lazy-load, index.html solo para globals
- mantener window.Modulo.* compatible
- no mover lógica Firebase fuera de public/services
- actualizar project-map.md si cambias la estructura del módulo

Entregables:
- archivo orquestador reducido
- submódulos nuevos bien cableados
- referencias actualizadas
- verificación final de API, load order y listeners
- resumen de deuda residual
```

## Prompts Útiles por Tipo de Archivo

### Para un módulo de vista

```text
Refactoriza public/modules/medi.js siguiendo .agents/workflows/refactorizar_modulo_gigante.md.
Mantén compatible window.Medi y todas sus llamadas inline.
Divide en submódulos por UI, acciones, agenda, historial y chat si aplica.
Actualiza router.js si agregas scripts lazy-loaded.
No cambies la firma de initStudent(ctx) ni rompas los contenedores actuales.
Actualiza .agents/project-map.md al final.
```

### Para un módulo ya parcialmente dividido

```text
Refactoriza public/modules/admin.medi.js siguiendo .agents/workflows/refactorizar_modulo_gigante.md.
No rehagas la estructura; profundiza el patrón existente de admin-medi/.
Mantén window.AdminMedi compatible.
Extrae solo responsabilidades que todavía estén sobrecargando el orquestador.
Verifica que router.js mantenga el orden correcto de carga.
Actualiza .agents/project-map.md si cambias responsabilidades o archivos.
```

### Para shell / core

```text
Refactoriza public/app.js siguiendo .agents/workflows/refactorizar_modulo_gigante.md.
Trátalo como shell core, no como módulo de vista.
Separa responsabilidades en archivos auxiliares sin romper el arranque, Store, ModuleManager, ModuleStateManager, eventos globales ni window.navigate.
No cambies el boot order entre index.html, main.js y app.js sin verificar el flujo completo.
Actualiza index.html o core scripts solo si es estrictamente necesario.
```
