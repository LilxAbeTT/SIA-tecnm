# Implementation Plan: Refactor Foro

## Inventario

- Carga actual:
  - `public/core/router.js` carga `public/services/foro-service.js` y después `public/modules/foro.js` o `public/modules/admin.foro.js`.
  - El router inicializa `window.Foro.init(ctx)` para alumno y `window.AdminForo.init(ctx)` para admin.
- API pública actual de alumno (`window.Foro`):
  - `init`
  - `switchTab`
  - `setFilter`
  - `handleSearch`
  - `handleSort`
  - `clearSearch`
  - `handleRegister`
  - `showTicketQR`
  - `openEventDetailModal`
  - `toggleFavorite`
  - `shareEvent`
  - `cancelTicket`
  - `downloadCertificate`
  - `openFeedbackModal`
  - `setFeedbackRating`
  - `submitFeedback`
  - `getDashboardWidget`
  - `openStudentScanner`
  - `stopStudentScanner`
  - `cleanup`
- API pública actual de admin (`window.AdminForo`):
  - `init`
  - `openEventModal`
  - `handleEventSubmit`
  - `deleteEvent`
  - `publishEventQR`
  - `viewEventAttendees`
  - `exportAttendees`
  - `openScanner`
  - `stopScanner`
  - `refreshDifusionData`
  - `handleApprove`
  - `openRejectModal`
  - `handleRejectSubmit`
  - `initDivisionHeadView`
  - `renderDivisionEventsTable`
  - `previewEventCover`
  - `previewCover`
  - `openEventDetailsModal`

## Riesgos detectados

- `public/modules/foro.js` llama `ForoService.markAttendanceByEventQR()` con firma incorrecta.
- `public/modules/foro.js` llama `ForoService.submitEventFeedback()` con firma incorrecta.
- `public/modules/foro.js` expone `downloadCertificate()` pero hoy no usa la capacidad ya existente del servicio.
- `public/modules/admin.foro.js` tiene múltiples `onclick="Foro.*"` aun cuando el router inicializa `window.AdminForo`.
- `public/components/admin-navbar.js` usa `window.Foro.crearEvento()` para la vista admin, pero esa API no existe.
- `public/modules/admin.foro.js` contiene código muerto copiado de la vista estudiante.

## Nueva estructura

- `public/modules/foro/foro.shared.js`
  - Helpers compartidos, constantes, utilidades de fecha/roles/toasts.
- `public/modules/foro/foro.student.js`
  - Lógica completa de alumno con estado encapsulado.
- `public/modules/foro/foro.admin.js`
  - Lógica completa de admin/difusión con estado encapsulado.
- `public/modules/foro.js`
  - Orquestador liviano que delega a `window.ForoModule.Student`.
- `public/modules/admin.foro.js`
  - Orquestador liviano que delega a `window.ForoModule.Admin`.

## Invariantes

- El router debe seguir usando `window.Foro` y `window.AdminForo`.
- Los listeners inline de alumno deben seguir apuntando a `Foro.*`.
- Los listeners inline de admin deben apuntar a `AdminForo.*`.
- El orden de carga debe ser:
  - `foro-service.js`
  - `foro/foro.shared.js`
  - `foro/foro.student.js` o `foro/foro.admin.js`
  - `foro.js` o `admin.foro.js`
- No cambiar colecciones ni contratos Firestore salvo compatibilidad defensiva en el servicio.
