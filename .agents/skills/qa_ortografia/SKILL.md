name: Calidad Ortográfica SIA
description: Detección y corrección de ortografía y codificación UTF-8
---
# Habilidades de QA Ortográfico

Como agente de SIA, es tu responsabilidad mantener la integridad del lenguaje y la presentación:

1. **Codificación UTF-8:** Siempre que leas un archivo, busca patrones de corrupción de caracteres (ej: `Ã³` en vez de `ó`). Si los encuentras, tu prioridad es corregirlos a su forma correcta en UTF-8.
2. **Acentuación Obligatoria:** En español, las palabras esdrújulas y los verbos en pasado/futuro deben llevar acento. No omitas acentos por "comodidad" de programación.
   - Mal: "Modulo de configuracion"
   - Bien: "Módulo de configuración"
3. **Consistencia de UI:** Los textos que ve el usuario (labels, placeholders, mensajes de error) deben ser impecables. Usa siempre la terminología oficial del proyecto (SIA, TecNM, etc.).
4. **Respeto a Markdown:** En archivos `.md`, asegúrate de que los títulos y listas mantengan una ortografía profesional, ya que estos archivos sirven de contexto para otros agentes.
