name: Web Components SIA
description: Estándares de desarrollo de UI Front-end
---
# Habilidades de UI y Web Components (SIA)

1. **Framework Principal (Bootstrap 5):** El proyecto utiliza Bootstrap 5 de manera intensiva. Usa sus utilidades (clases `d-flex`, `mt-3`, `text-center`, `g-3`, etc.) en lugar de escribir CSS customizado, siempre que sea posible.
2. **Web Components Ligeros:** Los componentes de UI custom que extienden `HTMLElement` no deben contener lógica de negocio fuerte o interacciones con "Services". Reciben datos por parámetros/atributos y delegan funciones mediante la propagación de eventos como `CustomEvent`.
3. **Notificaciones Visuales Obligatorias:** Para cualquier interacción asíncrona, haz uso sistemático de `Notify.js` (si está globalmente disponible en window) o muestra feedback en la UI.
4. **Sanitización Fundamental:** Todo texto del usuario que se inyecte en el DOM dinámicamente **debe pasar por** `escapeHtml()` (u otra función similar de utilidades) para bloquear vulnerabilidades XSS.
