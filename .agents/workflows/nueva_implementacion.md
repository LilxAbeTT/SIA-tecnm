# Flujo de Nueva Implementación

Este flujo es exclusivo para **implementar características, módulos o servicios 100% NUEVOS** que no existen actualmente en el sistema SIA. Al estar separado, nos aseguramos de que el diseño arquitectónico sea eficiente desde el día 1.

## Reglas Obligatorias

1. **Invocación del Project Map:** Lo primero es leer `.agents/project-map.md` para entender cómo se enlazan los módulos actuales, dónde registrar tu nueva ruta (ej. `core/router.js`), y dónde registrar tus estilos (`public/styles/`).
2. **Plan Detallado Primero:** Elabora un `implementation_plan.md` exhaustivo. En este plan debes diseñar la arquitectura de lo nuevo (HTML base, módulo JS, servicio, y reglas de seguridad de Firebase). No toques código hasta que el usuario lo apruebe.
3. **Regla de las 3 Revisadas:** Al "terminar", revisa tu integración 3 veces:
   - Revisa que el nuevo código cumpla con los estándares estéticos y de UI (Premium, limpio, dinámico).
   - Revisa la correcta inyección de dependencias y aislamiento (que no interfiera con otros módulos).
   - Revisa que hayas actualizado `.agents/project-map.md` para registrar tu nueva creación.
4. **Continuidad:** Una vez terminada la nueva característica, evalúa y propone una posible extensión, optimización u otra funcionalidad complementaria para el futuro inmediato.

## Pasos del Workflow

1. **Investigación:** Analiza cómo otros módulos de SIA están construidos.
2. **Diseño y Planificación:** Escribe el plan y solicita aprobación.
3. **Desarrollo Base:** Crea el archivo CSS modular, el Service, el Orchestrator JS y los HTML (Web Components o shells).
4. **Las 3 Revisadas:** Audita todo. Registra el nuevo módulo en el `project-map.md`.
5. **Cierre y Continuidad:** Entrega el trabajo y sugiere el siguiente paso.
