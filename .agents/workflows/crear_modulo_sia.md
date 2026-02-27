---
description: Crear un nuevo Módulo de vista para SIA
---
# Workflow para crear un Módulo en SIA

Cuando el usuario pida crear o refactorizar un módulo (vistas de la aplicación), debes seguir estrictamente los siguientes pasos:

1. **Ubicación:** Todo nuevo módulo se debe crear dentro de `public/modules/<nombre_modulo>.js` (o en su carpeta correspondiente si requiere varios archivos).
2. **Definición de Exportaciones (PATRÓN IIFE OBLIGATORIO):** El router del proyecto espera que los módulos estén definidos como Immediately Invoked Function Expressions (IIFE) que exponen un método `init(ctx)`. Debes seguir ESTRICTAMENTE esta estructura:
   \`\`\`javascript
   if (!window.MiModulo) {
       window.MiModulo = (function () {
           let _ctx = null;
           
           async function init(ctx) {
               _ctx = ctx;
               // Validación de Roles e Inicialización de UI aquí
           }
           
           // Exponer métodos públicos para que el router y el HTML puedan llamarlos
           return { init };
       })();
   }
   \`\`\`
3. **Validación de Persistencia y Acceso:**
   - La validación de permisos se debe hacer dentro del método `init(ctx)`, analizando `ctx.profile.role` o `ctx.profile.allowedViews`.
   - Ejemplo: `if (!ctx.profile.allowedViews.includes('<nombre>')) { return; /* denegar */ }`
4. **Sanitización Obligatoria:** Si el módulo renderiza datos dinámicos, debes invocar utilidades de sanitización (ej: `escapeHtml`).
5. **Comunicación con Firebase:** 
   - NUNCA llamar a la base de datos de Firebase directamente aquí. 
   - Llamar siempre a funciones definidas en `public/services/`.
6. **Manejo del Estado UI:** Usar `ModuleStateManager` en `public/core/ModuleStateManager.js` si se requiere guardar estado de tabla o filtros para preservar el estado ante cambios rápidos de tab.
7. **Documentación:** Agrega comentarios JSDoc en español a todos los métodos expuestos y clases internas.
