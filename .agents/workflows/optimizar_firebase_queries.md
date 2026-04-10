---
description: Optimizar y reducir lecturas a Firebase (Lazy Loading y Caché) en un Módulo y Servicio
---
# Workflow: Optimizar Consultas a Firebase (Reducción de Lecturas y Lazy Loading)

SIA está construido sobre Firebase/Firestore, por lo que las lecturas a la base de datos equivalen a dinero y rendimiento. Un error grave y común es descargar una colección entera (ej. miles de registros de alumnos o citas médicas) para filtrar solo unos pocos en el Front-End.

Cuando se te pida analizar o arreglar el alto consumo de lecturas de un módulo, sigue ESTRICTAMENTE estos pasos:

## FASE 1: Rastreabilidad (Front -> Back)
1. **Analiza el Módulo:** Lee el archivo `.js` del módulo en `public/modules/` para ver en qué momento, cómo, y qué función del servicio llama para pedir datos. (ej. verifica si llama al servicio en el `init`, o cada que se abre un `tab`).
2. **Localiza el Servicio:** Ve al archivo del servicio asociado en `public/services/` (ej. `medi-service.js`). Lee detalladamente la función encargada de ejecutar las consultas.

## FASE 2: Diagnóstico de Malas Prácticas
Busca los siguientes problemas:
- **Descargas Masivas sin Límite:** Identifica si se utiliza `getDocs(collection(db, 'coleccion'))` sin combinarlo con la función `limit()`.
- **Filtros en el Front-End:** Verifica si el módulo está haciendo cosas como `datosDb.filter(x => x.estado == 'activo')`. Ese filtro SE PAGA, la base de datos descargó el registro aunque lo descartes. El filtro `.filter()` indica que debes migrarlo a un `.where()` de Firestore.
- **Consultas tipo N+1:** Detecta si dentro de un `.forEach` o `.map` se está llamando asyncronamente a otro `getDoc`. Esto es letal. Promueve el agrupamiento o consultas tipo `.where('id', 'in', arrayIds)`.

## FASE 3: Implementación de Soluciones
Dependiendo de tu diagnóstico, implementa las siguientes optimizaciones en conjunto:
1. **Paginación y Lazy Loading (Servicio):** 
   - Modifica el servicio para aceptar parámetros de paginación (`limitQty`, `lastDoc`).
   - Usa `query(colRef, where(...), limit(limitQty))` y si hay un último documento usar `startAfter(lastDoc)`.
   - Recuerda retornar siempre el último documento en la respuesta: `{ data: docs, lastDoc: lastVisible }`.
2. **Botón "Cargar Más" / Infinite Scroll (Módulo):** Usa la información de paginación en el módulo para ir agregando datos a la tabla/lista al vuelo (append HTML en lugar de reemplazar), guardando el cursor `lastDoc` en las variables privadas del Módulo IIFE.
3. **Caché Reactivo Simple:** Si los datos pedidos no cambian contantemente (ej. "Lista de Categorías" o "El perfil del estudiante"), guárdalos en una variable dentro del closure IIFE del módulo (`let _cacheDatos = null`) y valida si es null antes de consultar de nuevo a Firebase.

## FASE 4: Refactorización Transparente
1. **Compatibilidad:** Asegúrate de que las firmas asíncronas de las promesas del servicio coincidan con lo que el módulo espera recibir.
2. **Cierre de Ciclo UI:** Modifica el Front-End para que avise al usuario "Cargando..." cuando llama el lazy loading, o un mensaje "No hay más registros" si la base de datos devuelve menos elementos de los que especifica el `limit`.
