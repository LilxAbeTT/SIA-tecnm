---
description: Crear un UI Component usando Web Components nativos
---
# Workflow para crear un Web Component

SIA usa Web Components nativos (Custom Elements) para componentes de UI reutilizables.

1. **Ubicación:** Crear el archivo en `public/components/<nombre-componente>.js`.
2. **Definición de Clase:** Crear una clase que extienda de `HTMLElement`.
3. **Template y Estilos:**
   - Evita el Shadow DOM a menos que sea estrictamente necesario esto para no aislar los estilos globales de Bootstrap.
   - Construye el HTML en el método `connectedCallback()` asignando a `this.innerHTML`.
4. **Estado y Eventos:**
   - Añade Listeners de eventos en `connectedCallback`.
   - Recuerda eliminar los Listeners en `disconnectedCallback` para evitar colisiones y memory leaks.
5. **Registro:** Al final del archivo, registra el componente con `customElements.define('sia-<nombre>', NombreClase)`.
6. **Manejo de Errores:** Cualquier lógica compleja dentro del componente debe tener `try/catch` y feedback visual en caso de error.
