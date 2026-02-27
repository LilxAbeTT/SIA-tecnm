---
description: Solucionar un bug o error de UI en el proyecto SIA
---
# Workflow para Solucionar Bugs (Bug Fix)

Cuando te pidan solucionar un errror (ej. "En el módulo X, en la parte Y, presionar este botón causa error"), debes seguir metódicamente este workflow de investigación y resolución.

## Fase 1: Rastreo del Problema (Tracking)
1. **Identificar la vista:** Ve al HTML del módulo (ya sea renderizado en el .js o en `index.html`) e identifica el ID del contenedor (ej: `#view-biblioteca`) o el ID del botón que el usuario está mencionando.
2. **Rastrear el Listener:** Busca en todo el código dónde se aplica un `addEventListener` a ese botón o si tiene una etiqueta explícita `onclick="ModuloX.hacerAlgo()"`.
3. **Revisar el Servicio Centralizado:** Si la función falla al interactuar con datos, investiga si el módulo importa y llama a un servicio (dentro de `public/services/`). NUNCA agregues lógica de base de datos directa a un Módulo. Los errores de datos deben resolverse arreglando o ajustando el Servicio.

## Fase 2: Diagnóstico y Corrección (Debugging)
1. **Verificar el Scope:** En la arquitectura IIFE de SIA (usando `window.ModuloX = (function(){...})()`), asegúrate de que si el HTML llama a una función en el `onclick`, dicha función esté realmente siendo exportada en el bloque `return { miMetodo }` al final del IIFE. Este es el motivo del 90% de los errores de "function is not defined".
2. **Checar Datos No Definidos (Null Safety):** Asegúrate de que, si los datos tardan en cargar, utilices operadores opcionales (`?.`) para que la pantalla no se rompa al buscar variables profundamente anidadas.
3. **Implementar Feedback (UI/UX):** Todo botón que dispara algo asíncrono debe cambiar su estado (deshabilitarse o mostrar un loader) durante el guardado. Agrega siempre control de promesas `try/catch`. Notifica al usuario con un script de interfaz (ej. `showToast('texto', 'error')`).

## Fase 3: Doble Verificación
- Nunca des el trabajo por terminado sin haber guardado el archivo `multi_replace_file_content` y comprobado con tus herramientas la vista que resulta de tus cambios para evitar dañar otro código o cerrar mal corchetes del patrón IIFE.
