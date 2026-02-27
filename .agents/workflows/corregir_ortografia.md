---
description: Corregir ortografía y codificación en un archivo
---
# Workflow: Corrección Ortográfica y UTF-8

Sigue estos pasos para limpiar un archivo de errores:

1. **Identificación de Codificación:** 
   - Lee las primeras 100 líneas del archivo.
   - Busca símbolos extraños como `â`, `Ã`, `ðŸ`.
2. **Mapeo de Correcciones:** Identifica qué palabras han perdido sus acentos (ej: "Medico" -> "Médico", "Categoria" -> "Categoría").
3. **Escaneo de Textos de Usuario:** Busca todos los `innerHTML`, `textContent`, e hileras de texto en el código o markdown.
4. **Reemplazo Masivo:**
   - Realiza los cambios usando `replace_file_content` o `multi_replace_file_content`.
   - Asegúrate de NO alterar la lógica del código (nombres de variables o funciones que NO tengan acento de forma intencional en sus definiciones originales).
5. **Doble Verificación:** Revisa que al poner un acento no hayas roto una cadena de texto o un template literal.
