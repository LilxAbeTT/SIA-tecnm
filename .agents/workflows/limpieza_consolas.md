# Flujo para Limpieza de Consolas (console.log)

Este flujo se activa cuando el objetivo es limpiar el código base de todos los `console.log`, `console.warn` y `console.error` residuales de procesos de depuración, para garantizar un código limpio, profesional y seguro frente a posibles fugas de información.

## Reglas Obligatorias

1. **Invocación del Project Map:** Aunque es una limpieza global, debes consultar `.agents/project-map.md` para identificar áreas críticas (ej. servicios de autenticación, Firebase, manejo de pagos) donde la eliminación de un log de error legítimo podría afectar el monitoreo.
2. **Plan Detallado Primero:** Antes de borrar nada, DEBES crear un plan detallado en `implementation_plan.md` definiendo tu estrategia: ¿Borrarás solo `console.log` o también `console.error`? ¿Se dejarán en bloques `catch`? Pide aprobación al usuario antes de proceder.
3. **Regla de las 3 Revisadas:** Después de limpiar, debes verificar exhaustivamente:
   - ¿Se eliminó alguna variable o lógica funcional por accidente junto con el `console.log`?
   - ¿El código no tiene errores de sintaxis (como comas colgantes o llaves rotas) tras la eliminación?
   - ¿Se respetaron los logs estrictamente necesarios (si el plan lo indicaba)?
4. **Continuidad:** Al finalizar la limpieza, propón al usuario una medida de prevención definitiva (por ejemplo, configurar la regla `no-console` en ESLint o implementar un sistema de logging estructurado) para evitar que los logs vuelvan a propagarse.

## Pasos del Workflow

1. **Rastreo:** Utiliza `grep_search` para buscar ocurrencias de `console.log`, `console.dir`, `console.warn` y `console.error` en los archivos fuente del proyecto.
2. **Diagnóstico y Plan:** Clasifica los logs encontrados. Crea el plan de limpieza en `implementation_plan.md` detallando las áreas de impacto. Espera el "OK" del usuario.
3. **Limpieza Quirúrgica:** Usa las herramientas de modificación precisas para eliminar solo las líneas pertinentes. Presta especial atención a no romper estructuras de control (ej. if sin llaves).
4. **Las 3 Revisadas:** Realiza una inspección final del código modificado.
5. **Cierre y Continuidad:** Presenta un resumen de los archivos limpiados e inmediatamente recomienda una configuración preventiva para mantener el sistema libre de logs.
