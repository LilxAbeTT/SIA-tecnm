# SIA Master Context & Operational Protocol (v2.1 - General)

## 1. Protocolo Operativo del Agente (Reglas de Oro)
- **Análisis de Impacto:** Antes de cualquier propuesta, el agente debe analizar la estructura de archivos en `public/core/` y `public/services/` para asegurar la coherencia sistémica.
- **Desarrollo Seguro y Optimizado por Defecto:** Cada vez que el agente implemente o modifique código, debe garantizar que sea la solución más eficiente (menor consumo de recursos/queries) y segura (sin vulnerabilidades), sin necesidad de que se le pida explícitamente.
- **Idioma Predeterminado:** Todas las respuestas, explicaciones y comentarios en el código deben ser en **Español Latino**.
- **Regla de Mejora Continua (5+):** Si se solicita una propuesta o mejora, el agente debe presentar un mínimo de **5 opciones o recomendaciones** distintas, priorizando la utilidad e intuición para el usuario final.
- **Ciclo de Doble Verificación:** Ningún problema se da por resuelto hasta que el agente revise y valide la solución al menos **dos veces**, asegurando que no se rompan funcionalidades existentes.
- **Mapeo de Relaciones:** Al modificar cualquier función, se debe revisar su relación con otros archivos (Router, Store, Services) para mantener la integridad del flujo de datos.

## 2. Integración MCP Firebase Server
- **Validación en Tiempo Real:** El agente debe utilizar activamente el servidor MCP de Firebase para consultar esquemas de colecciones, reglas de seguridad y estados de datos antes de sugerir cambios en el código del cliente.
- **Sincronización de Reglas:** Toda nueva funcionalidad que implique persistencia debe ser contrastada con las reglas de seguridad de Firestore mediante el MCP para evitar errores de permisos "Permission Denied".

## 3. Arquitectura de Referencia de SIA
- **Capa Core (Núcleo):** Lógica de autenticación, enrutamiento, gestión de estado global y utilidades de UI.
- **Capa de Servicios (Data):** Centralizada en `public/services/`. Utiliza el patrón **Firebase v9 Modular**. Los módulos nunca llaman a la base de datos directamente; siempre pasan por un servicio.
- **Capa de Módulos (Negocio):** Ubicada en `public/modules/`. Contiene la lógica de las vistas y la interacción con el usuario.
- **Capa de Componentes (UI):** Implementada mediante **Web Components** (Custom Elements) reutilizables.

## 4. Estándares Técnicos y de Seguridad
- **Patrón Modular:** Uso estricto del SDK funcional de Firebase (ej: `doc()`, `getDoc()`, `setDoc()`) para optimizar el peso de la aplicación y el rendimiento de las consultas.
- **Gobernanza de Acceso:** El acceso a cualquier vista o recurso debe validarse contra el objeto de perfil del usuario y su propiedad `allowedViews`.
- **Sanitización de Datos Obligatoria:** Todo contenido dinámico renderizado debe ser sanitizado para prevenir ataques XSS, utilizando las utilidades de seguridad del sistema (`escapeHtml`).
- **Manejo de Errores y Feedback:** Todas las operaciones asíncronas deben implementar `try/catch` y proporcionar retroalimentación visual inmediata mediante el servicio de notificaciones (`Notify.js`).

## 5. Directrices de UX/UI
- **Responsividad:** El sistema es "Mobile-First" pero optimizado para escritorio mediante layouts dinámicos (Bootstrap 5 + Custom CSS).
- **Estado de Carga:** Se debe mostrar un loader o estado de "skeleton" durante la recuperación de datos para mejorar la percepción de velocidad.
- **Persistencia de Sesión:** Uso de `ModuleStateManager` para mantener el estado de los módulos activos durante la navegación sin recarga de página.