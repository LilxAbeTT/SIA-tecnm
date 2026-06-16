# Flujo para Solucionar Bugs

Este flujo se activa cuando el usuario menciona un error o problema en el sistema, muchas veces dando pistas generales o vagas (ej. *"al usar el modal de inventario en biblioteca admin pasa esto..."*). Tu trabajo es ser un detective preciso.

## Reglas Obligatorias

1. **Invocación del Project Map (El Mapa es el Detective):** El usuario te dio una pista. Ve inmediatamente a `.agents/project-map.md`, busca la sección relacionada (ej. "Biblioteca", "inventario.js", "modals") y ubica los archivos exactos (UI, Módulo, Servicio) que gobiernan esa zona.
2. **Plan Detallado Primero:** Una vez que inspeccionaste el código y hallaste el problema, DEBES documentar el origen del bug y tu estrategia de solución en `implementation_plan.md`. No corrijas el error en caliente sin avisar.
3. **Regla de las 3 Revisadas:** Después de aplicar la cura, debes revisar 3 veces el código afectado:
   - ¿El fix introdujo un nuevo bug en otra parte (side-effect)?
   - ¿La lógica corregida es a prueba de tontos (maneja nulos, undefined, errores de red)?
   - ¿Se mantiene limpio el código?
4. **Continuidad:** Al solucionar un bug exitosamente, es común notar otras áreas frágiles cercanas. Propón al usuario una mejora relacionada para prevenir futuros bugs en esa misma zona.

## Pasos del Workflow

1. **Rastreo:** Convierte la descripción del usuario en una ruta de archivo apoyándote en `project-map.md` y `grep_search`.
2. **Diagnóstico y Plan:** Lee los archivos, detecta el error y redacta el plan de corrección. Espera el "OK".
3. **Corrección:** Aplica la solución puntualmente.
4. **Las 3 Revisadas:** Confirma exhaustivamente que el problema desapareció y nada más se rompió.
5. **Cierre y Continuidad:** Explica qué causaba el error, por qué ya está arreglado y recomienda qué otra cosa mejorar para dar mayor robustez a la zona.
