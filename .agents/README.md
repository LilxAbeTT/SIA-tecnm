# Guía Rápida e Imperdible para Agentes (Contexto SIA)

¡Hola, Agente! Si estás leyendo esto, es porque vas a trabajar en el proyecto **SIA (Sistema Integral de Administración)**. 

Para asegurar el éxito de tu tarea y no cometer errores ni sobreescribir arquitectura clave, **DEBES SEGUIR ESTAS INSTRUCCIONES ESTRICTAS**:

## 1. El Mapa del Proyecto es tu Fuente de Verdad
Antes de buscar a ciegas en el código, **LEE SIEMPRE** el archivo `.agents/project-map.md`. 
Ese mapa contiene la arquitectura, los entrypoints, dónde están los módulos y los servicios. Si no lo lees, probablemente alterarás archivos equivocados o duplicarás código.

## 2. Existen ÚNICAMENTE 3 Workflows Permitidos
Si te piden ejecutar una tarea, debes clasificarla y basarte mentalmente en uno de estos tres workflows que se encuentran en `.agents/workflows/`:
1. `mejora_implementacion.md` (Añadir o mejorar algo existente)
2. `nueva_implementacion.md` (Crear algo 100% nuevo)
3. `solucionar_bug.md` (Diagnosticar y arreglar errores)

## 3. Reglas de ORO (Inquebrantables)
- **Plan Detallado Obligatorio:** NUNCA modifiques código (HTML, JS, CSS) sin antes elaborar un `implementation_plan.md` y esperar la confirmación del usuario.
- **Regla de las 3 Revisadas:** Audita y revisa tus cambios, dependencias y lógicas al menos **3 veces** antes de decirle al usuario que has terminado. Revisa que no rompas la API pública, que mantengas la seguridad, y que el diseño visual siga las reglas.
- **No inventes rutas o servicios:** Usa `grep_search` guiándote por lo que leas en el `project-map.md`.
- **Continuidad:** Al finalizar tu tarea, siempre debes proponer una mejora adicional o tarea relacionada para continuar perfeccionando el sistema.

## 4. Arquitectura Rápida
- **Frontend App:** `public/` (Usa Vanilla JS, Web Components y un enrutador SPA `core/router.js`).
- **Servicios:** `public/services/` (Lógica de negocio y Firebase).
- **Módulos:** `public/modules/` (Orquestadores de vistas).
- **Backend:** `functions/` (Cloud Functions en Node).

> ¡Empieza siempre invocando el Project Map y redactando tu plan!
