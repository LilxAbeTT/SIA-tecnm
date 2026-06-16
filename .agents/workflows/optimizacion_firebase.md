# Flujo para Optimización y Fugas de Consultas (Firebase)

Este flujo se activa cuando se detecta un alto consumo de lecturas en Firestore/Realtime Database, lentitud en la carga de módulos o sospecha de "fugas de consultas" (queries disparándose en bucle o redundantes). El objetivo es atrapar el problema, cachear datos e implementar prácticas eficientes.

## Reglas Obligatorias

1. **Invocación del Project Map:** Consulta `.agents/project-map.md` para entender cómo se conecta el módulo afectado con Firebase. Debes conocer quién solicita la data, cuándo la solicita y si la comparte con otros componentes.
2. **Plan Detallado Primero:** Antes de codificar, elabora en `implementation_plan.md` la estrategia específica: 
   - ¿Es un problema de re-renderizado/bucles? 
   - ¿Se necesita `SessionStorage`, `LocalStorage` o un `StateManager` en memoria RAM?
   - ¿Falta paginación (`limit`, `startAfter`)?
   - ¿Hay suscripciones en tiempo real (`onSnapshot`) que no se están limpiando (`unsubscribe`)?
   Pide aprobación de la estrategia antes de proceder.
3. **Regla de las 3 Revisadas:** Tras optimizar, asegúrate de evaluar lo siguiente:
   - **Invalidación de Caché:** ¿Si el usuario actualiza un dato, el caché local también se refresca o invalida para no mostrar información obsoleta?
   - **Limpieza de Listeners:** ¿Todo listener de Firebase se cierra correctamente al desmontar la vista o cambiar de módulo?
   - **Robustez:** ¿Maneja casos límite (ej. usuario desconectado sin caché previo)?
4. **Continuidad:** Una vez solucionada la fuga en un componente, propón extender esa estrategia de caché a otros componentes de alto tráfico para reducir significativamente la factura y carga de Firebase.

## Pasos del Workflow

1. **Rastreo y Perfilado:** Utiliza `grep_search` para ubicar las llamadas exactas (`getDocs`, `onSnapshot`, `query`, `get`) en la zona reportada. Identifica el cuello de botella.
2. **Estrategia y Plan:** Documenta tu hallazgo (ej. "El componente llamaba a Firebase cada vez que se abría el modal en lugar de una sola vez") y propón la solución de caché en el `implementation_plan.md`. Espera la aprobación.
3. **Intervención Segura:** Implementa la lógica. Prioriza leer del caché primero, y si no existe o ha expirado (TTL), ve a Firebase y guarda el nuevo resultado en el caché.
4. **Validación Exhaustiva:** Revisa que el flujo de inserción/edición siga funcionando y reflejando los cambios inmediatamente (actualización optimista o hidratación del caché).
5. **Cierre:** Genera un resumen del ahorro de lecturas y de las mejoras de latencia que aportó tu cambio.
