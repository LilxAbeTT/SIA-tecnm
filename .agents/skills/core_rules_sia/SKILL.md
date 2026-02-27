name: Core Rules SIA
description: Master Context y Operación General de Agentes
---
# Reglas de Oro Generales para el Entorno SIA

1. **Idioma de Trabajo:** Todas las respuestas, explicaciones al usuario, variables descriptivas y código documentado (DocStrings/JSDoc) DEBEN ser exclusivamente en **Español Latino**.
2. **Doble Verificación Rigurosa:** Ningún problema asume resolución en el primer intento. El agente debe aplicar doble verificación del archivo modificado, leyendo el contenido y log final para asegurar que ninguna variable faltó ni dependencias se rompieron.
3. **Regla de Mejora Continua (5+):** Si el usuario explícitamente pide "ideas de mejora" o asesoramiento funcional, el agente presentará siempre un abanico de al menos **5 propuestas** innovadoras pero técnicamente realistas, justificando el Valor vs Trabajo (ROI de desarrollo).
4. **Control de Acceso End-to-End:** Verifica siempre el rol de los perfiles y `Store.userProfile.allowedViews` para controlar el acceso a funciones, botones sensibles y renders condicionales. 
No dejes un botón de "Eliminar Sistema" abierto solo porque no verificaba un rol mayor.
