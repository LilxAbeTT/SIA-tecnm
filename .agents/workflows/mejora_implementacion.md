# Flujo de Mejora o Implementación Añadida

Este flujo está diseñado para **mejorar o añadir funcionalidad a algo que YA EXISTE** en el sistema SIA. Su objetivo es ser 100% eficaz y eficiente.

## Reglas Obligatorias

1. **Invocación del Project Map:** Lo primero que debes hacer es consultar y leer `.agents/project-map.md`. Localiza en el mapa dónde se encuentra exactamente el módulo, componente o servicio que vas a mejorar.
2. **Plan Detallado Primero:** Antes de escribir o modificar una sola línea de código, DEBES crear un plan detallado (`implementation_plan.md`) explicando qué archivos tocarás y por qué. Pide aprobación al usuario antes de proceder.
3. **Regla de las 3 Revisadas:** Cuando creas que has terminado la implementación, detente. Debes revisar tu propio trabajo al menos **3 veces** verificando:
   - Que no rompes funcionalidades existentes.
   - Que los estilos (CSS) se mantengan premium y consistentes.
   - Que las importaciones e integraciones con Firebase sean correctas y seguras.
4. **Continuidad:** Si al final de la tarea el trabajo está perfecto y libre de errores, propón al usuario una mejora adicional, optimización o tarea relacionada que sume valor a lo que acabas de hacer.

## Pasos del Workflow

1. **Contexto Inicial:** Usa `grep_search` y lee archivos basándote en lo que encontraste en el `project-map.md`.
2. **Creación del Plan:** Documenta los cambios propuestos en `implementation_plan.md` (espera luz verde).
3. **Ejecución Cuidadosa:** Modifica el código usando herramientas específicas. 
4. **Las 3 Revisadas:** Evalúa la robustez de los cambios.
5. **Cierre y Continuidad:** Informa al usuario de la finalización e inmediatamente recomienda el siguiente paso lógico.
