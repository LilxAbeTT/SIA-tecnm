
+---
description: Frases listas para invocar workflows y activar la orquestacion con subagentes desde el primer mensaje
---
# Starter Prompts

## Regla simple

Si quieres que el agente use subagentes desde el inicio, dilo explicitamente.

Formula recomendada:

`Usa [workflow] con subagentes. Haz mapa de impacto, reparte ownership, implementa, integra y revisa.`

## Prompts listos

### Crear una feature o modulo

`Usa /crear_modulo_sia con subagentes. Quiero implementar [feature] en [ruta, vista o archivo]. Haz mapa de impacto, divide por capas, ejecuta, integra y cierra con QA.`

### Corregir un bug

`Usa /solucionar_bug_sia con subagentes. El problema es [bug]. Encuentra la causa raiz, divide el trabajo solo si hace falta, aplica el fix y valida regresiones.`

### Refactor grande

`Usa /refactorizar_modulo_gigante con subagentes. Quiero refactorizar [archivo o modulo] sin romper su API publica. Diseña el split, implementa, integra y revisa.`

### Crear o modificar un servicio

`Usa /crear_servicio_firebase con subagentes. Necesito crear o ajustar [servicio] para soportar [feature]. Divide datos, seguridad, rendimiento e integracion segun aplique.`

### Crear un Web Component

`Usa /crear_web_component con subagentes. Quiero un componente para [uso]. Reparte UI, datos, integracion y QA si hace falta.`

### Mejorar rendimiento

`Usa /optimizar_firebase_queries con subagentes. Quiero reducir lecturas y mejorar rendimiento en [flujo o modulo]. Audita, optimiza y valida que no se rompa nada.`

### Auditar seguridad

`Usa /analizador_seguridad con subagentes. Audita [alcance] y entrega hallazgos por severidad. Si encuentras riesgos claros y seguros de corregir, propon o aplica el fix.`

### Analizar antes de construir

`Usa /asesor_pre_desarrollo_sia con subagentes. Quiero analizar [problema] y que recomiendes la mejor estrategia antes de implementar.`

### Orquestacion libre

`Usa /orquestar_subagentes_sia. La tarea es [objetivo]. Decide que subagentes usar, evita solapamientos y ejecuta de punta a punta.`

## Frase extra util

Si quieres darle autonomia real al sistema, agrega esta linea:

`Si la tarea es simple, no fuerces subagentes. Si es compleja, usa la escuadra minima necesaria.`
