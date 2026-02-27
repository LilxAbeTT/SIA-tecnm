---
description: Refactorizar módulos gigantes (>1000 líneas) en sub-módulos legibles sin romper el código
---
# Workflow: Refactorización Máxima (Split de Módulos Gigantes)

Los archivos de más de 1000 líneas (como `medi.js` o `reportes.js`) causan problemas de contexto a los agentes y son difíciles de mantener. Cuando se te pida refactorizar un archivo masivo, DEBES seguir esta metodología militar para no romper el código.

## FASE 1: Análisis y Planificación (Read-Only)
1. **Identificación de Responsabilidades:** Lee el archivo completo e identifica grandes bloques de código. Generalmente un módulo monolítico de SIA tiene:
   - Inicialización y validación de roles (`init`, `renderShell`).
   - Lógica de Vistas/Tabs (ej. `renderTab1`, `initTab1`).
   - Lógica de Modales y Formularios.
   - Utilidades y formateadores.
2. **Diseño de la Nueva Estructura:** Crea un plan (`implementation_plan.md`) proponiendo en qué archivos se dividirá. 
   - Recomendación: Mantén el `modulo.js` original como un **Orquestador** (menos de 300 líneas) y extrae la lógica a `modulo.ui.js`, `modulo.forms.js`, `modulo.api.js` (u organizarlo como Web Components en `public/components/`).

## FASE 2: Extracción Segura
Debido a que SIA usa el patrón IIFE (`window.MiModulo = (function(){...})()`), no puedes simplemente copiar/pegar funciones que dependen de variables privadas (`let _ctx`).
1. **Paso A (Aislamiento Puro):** Mueve todas las funciones *puras* (que no dependen de variables globales `let _algo`) a un archivo temporal o de utilidades.
2. **Paso B (Sub-Espacios de Nombres):** Para los fragmentos extraídos, utiliza un patrón de extensión del namespace principal del módulo.
   *Estructura del Sub-Módulo (`public/modules/modulo.subparte.js`):*
   ```javascript
   if (!window.MiModulo) window.MiModulo = {};
   window.MiModulo.SubParte = (function () {
       let _parentCtx = null;
       return {
           init: function(ctx) { _parentCtx = ctx; /* lógica */ },
           render: function(contenedorId) { ... }
       };
   })();
   ```

## FASE 3: Refactorización Estratégica
¡IMPORTANTE! No borres el código del archivo original de golpe.
1. **Comenta, no borres:** Primero, comenta el bloque gigante en el archivo original y llama a la nueva función del sub-módulo: `window.MiModulo.SubParte.init(_ctx)`.
2. **Importación:** Asegúrate de decirle al usuario que debe importar el nuevo archivo `<script src="modules/modulo.subparte.js"></script>` en el `index.html` ANTES de probar.

## FASE 4: Verificación Paranoica
1. **Scopes y Closures:** Revisa tres veces que ninguna función extraída esté intentando acceder a variables privadas del orquestador (ej. `_currentData`). Si lo necesita, pásalos como parámetros o usa un Service de estado.
2. **Listeners de Eventos:** Asegúrate de que los `onclick="MiModulo.funcion()"` en el HTML referencien correctamente la nueva ruta si la moviste (ej. `onclick="MiModulo.SubParte.funcion()"`).
3. **Limpieza Final:** Solo cuando todo funcione, elimina el código comentado en el archivo orquestador. El archivo original deberá haberse reducido al menos a la mitad de su tamaño.
