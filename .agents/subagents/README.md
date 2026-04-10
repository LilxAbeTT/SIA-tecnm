---
description: Guia maestra para trabajar con una escuadra generalista de subagentes en SIA
---
# Subagentes SIA

## Para que sirve esta carpeta

Estos archivos definen una escuadra base de expertos generalistas.

Sirven para:

- repartir trabajo por capas y ownership real del repo
- evitar que dos agentes editen el mismo archivo critico
- estandarizar handoffs, revision e integracion
- acelerar tareas grandes usando trabajo en paralelo con bajo riesgo

## Lo que si debes entender

Estos `.md` no activan por si solos el uso automatico de subagentes en cada chat.

Lo que si hacen es darle al agente principal una base clara para decidir:

- a quien delegar
- que archivos asignar
- en que orden integrar
- cuando conviene trabajar en paralelo y cuando no

Para activar este modo en una conversacion, pide explicitamente algo como:

- `Usa subagentes para esta tarea`
- `Divide esto entre frontend, Firebase y revision`
- `Aplica /orquestar_subagentes_sia para resolver esto`
- `Usa /crear_modulo_sia con subagentes`
- `Quiero que orquestes esta tarea con arquitectura, implementacion, integracion y QA`

## Regla operativa central

En SIA, el reparto no debe hacerse por modulo especifico.

Debe hacerse por impacto real en:

- shell y router
- vistas y flujos de UI
- servicios Firebase
- auth y plataforma base
- reglas y seguridad
- Cloud Functions
- realtime y notificaciones
- indices y rendimiento
- deuda estructural y refactor
- integracion final
- revision y regresiones

No hay agentes "de medi", "de biblio" o "de aula".

La idea correcta es:

- el orquestador detecta que capas toca la tarea
- elige la escuadra adecuada
- reparte ownership por archivos
- integra
- revisa

## Limites no negociables

1. Usa normalmente entre 2 y 5 subagentes por tarea.
2. Un solo owner por archivo critico.
3. Nunca edites en paralelo:
   - `public/index.html`
   - `public/app.js`
   - `public/core/router.js`
   - `firestore.rules`
   - `storage.rules`
   - `functions/`
   - `firestore.indexes.json`
4. Los agentes de implementacion pueden proponer cambios de reglas, functions o indices, pero no aplicarlos si no son sus owners.
5. Toda tarea grande debe cerrar con `integration-engineer` si hubo varios owners.
6. Todo trabajo paralelo debe cerrar con `qa-review-engineer`.

## Equipo Base

### Core

- `core/orquestador-sia.md`: decide si usar subagentes, cuantos y en que orden
- `core/solution-architect.md`: descompone tareas grandes, ambiguas o de alto impacto
- `core/integration-engineer.md`: cose cambios entre capas y preserva contratos
- `core/refactor-engineer.md`: divide modulos grandes y reduce deuda
- `core/qa-review-engineer.md`: valida integracion, regresiones y huecos
- `core/security-rules-engineer.md`: owner exclusivo de `firestore.rules` y `storage.rules`
- `core/performance-engineer.md`: owner exclusivo de `firestore.indexes.json` y auditor de rendimiento

### Frontend

- `frontend/frontend-platform-engineer.md`: shell, router, bootstrap y estado global
- `frontend/frontend-product-engineer.md`: vistas, flujos y comportamiento funcional
- `frontend/web-components-engineer.md`: Custom Elements y UI encapsulada reusable
- `frontend/design-system-engineer.md`: estilos, responsive, accesibilidad y consistencia visual

### Backend y Plataforma

- `backend/firebase-platform-engineer.md`: Firebase base, auth y helpers compartidos
- `backend/backend-data-engineer.md`: servicios, consultas, writes y contratos de datos
- `backend/cloud-functions-engineer.md`: triggers, callables y logica privilegiada
- `backend/notifications-realtime-engineer.md`: push, service worker, realtime y suscripciones

## Escuadras recomendadas

### Feature nueva o ambigua

- `solution-architect`
- `frontend-product-engineer` o `backend-data-engineer` segun aplique
- `integration-engineer`
- `qa-review-engineer`

### Crear un modulo o flujo nuevo

- `solution-architect`
- `frontend-product-engineer`
- `backend-data-engineer`
- `integration-engineer`
- `qa-review-engineer`
- suma `security-rules-engineer`, `cloud-functions-engineer`, `notifications-realtime-engineer` o `performance-engineer` si el impacto lo exige

### Bug que cruza varias capas

- `solution-architect` si el origen no esta claro
- `frontend-product-engineer` o `backend-data-engineer`
- `integration-engineer`
- `qa-review-engineer`

### Cambio de shell, bootstrap o navegacion

- `frontend-platform-engineer`
- `integration-engineer`
- `qa-review-engineer`

### Cambio visual o UX

- `frontend-product-engineer`
- `design-system-engineer`
- `qa-review-engineer`

### Cambio de datos, servicio o Firestore

- `backend-data-engineer`
- `security-rules-engineer` si hay permisos
- `performance-engineer` si hay costo o indices
- `qa-review-engineer`

### Push, realtime o service worker

- `notifications-realtime-engineer`
- `cloud-functions-engineer` si hay payload server-side
- `security-rules-engineer` si cambia acceso
- `qa-review-engineer`

### Refactor grande

- `solution-architect`
- `refactor-engineer`
- `integration-engineer`
- `qa-review-engineer`

## Flujo recomendado

1. Leer `.agents/project-map.md`.
2. Construir mapa de impacto: UI, shell, datos, auth, reglas, functions, realtime, rendimiento, refactor.
3. Asignar owners sin solapamiento.
4. Ejecutar primero la arquitectura si la tarea es grande o ambigua.
5. Ejecutar implementacion por capas.
6. Integrar con `integration-engineer`.
7. Cerrar con `qa-review-engineer`.

## Workflow recomendado

Usa `.agents/workflows/orquestar_subagentes_sia.md` como entrada maestra para tareas complejas.

Si quieres frases listas para iniciar una conversacion, usa `.agents/subagents/STARTER_PROMPTS.md`.
