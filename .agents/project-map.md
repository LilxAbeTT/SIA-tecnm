# SIA Project Map (Current Repo Snapshot)
> Purpose: quick navigation map for the project as it exists today.
>
> Path convention: paths are relative to the repo root unless a section says otherwise.
>
> Runtime note: the web app still runs from `public/`, but the repo now also contains QA/dev scaffolding, support tooling, extra workflows, and a larger Firebase backend surface than the old map described.

---

## 1. Root Structure

```text
SIA-tecnm-main/
|-- public/                         <- Web app runtime root
|   |-- app.js                      <- Legacy glue: auth/session, QA, verify, shell helpers, dashboard surfaces
|   |-- main.js                     <- Core bootstrap: UiManager + Router + Breadcrumbs + support modal wiring
|   |-- index.html                  <- App shell, modals, public views, dashboard shells
|   |-- styles.css                  <- Legacy global CSS
|   |-- styles/                     <- Modular CSS (16 themed files)
|   |-- sw.js                       <- Offline service worker
|   |-- firebase-messaging-sw.js    <- FCM service worker
|   |-- manifest.json               <- PWA manifest
|   |-- skills.md                   <- In-repo notes/skills doc for the frontend folder
|   |-- core/                       <- Router/state/UI/breadcrumb helpers
|   |-- modules/                    <- Feature modules and orchestrators
|   |-- services/                   <- Firebase/Firestore/Auth/storage/domain services
|   |-- components/                 <- Native web components
|   |-- config/                     <- Static config catalogs
|   |-- utils/                      <- Shared browser utilities
|   |-- data/                       <- Static JSON
|   |-- scripts/                    <- Seeder/helper scripts
|   |-- assets/                     <- Icons, sounds, badges
|   |-- images/                     <- Logos and module imagery, including campus map assets
|   |-- flyers/                     <- Generated promo assets (`bienvenida-sia.*`)
|   |-- .claude/                    <- Editor/local config inside `public/`
|   `-- .vscode/                    <- Editor settings inside `public/`
|-- functions/                      <- Cloud Functions (Node 20)
|   |-- index.js                    <- Push + aggregators + re-export of foro backend
|   |-- foro.js                     <- Callables/schedules/triggers for Eventos
|   |-- scanner.js                  <- HTTPS ingest for hardware scanners/stations
|   `-- package.json
|-- firmware/                       <- Firmware sketches and hardware setup notes
|   `-- m5atom-biblio-scanner/      <- Atom + QRCode2 scanner for biblioteca
|-- .agents/                        <- Agent docs, workflows, subagents
|   |-- project-map.md              <- This file
|   |-- implementation_plan.md
|   |-- plan_modulo_comunidad.md
|   |-- skills/
|   |-- subagents/
|   `-- workflows/
|-- .claude/settings.local.json     <- Local editor config at repo root
|-- .firebaserc
|-- firebase.json
|-- firestore.rules
|-- firestore.indexes.json
|-- firestore.indexes.remote.json
|-- firestore.indexes.remote.clean.json
|-- storage.rules
|-- cors.json
|-- capacitor.config.json
|-- package.json                    <- Live-server dev script + Capacitor deps
|-- package-lock.json
|-- materias_ITES_Los_Cabos.md      <- Root doc/reference
|-- 22222.txt                       <- Misc local file
|-- active                          <- Misc local file
`-- firestore-debug.log             <- Local emulator/debug output
```

---

## 2. Runtime Boot Map

### Main boot order

1. `public/index.html`
   - Defines the shell, modals, public views, dashboard shells, drawers, and fixed UI containers.
   - Eager-loads several shared bundles before `main.js`:
     - `utils/time-utils.js`
     - `utils/export-utils.js`
     - `services/profile-service.js`
     - `services/encuestas-service.js`
     - `services/encuestas-servicio-service.js`
     - `services/reportes-service.js`
     - `services/avisos-service.js`
     - `modules/reportes*.js`
     - `modules/encuestas*.js`
   - Then loads `localScripts` in order:
     - `config/departments.js`
     - `services/firebase.js`
     - `utils/pdf-generator.js`
     - `services/notify.js`
     - `utils/ui.js`
     - `core/state.js`
     - `core/ui.js`
     - `core/router.js`
     - `core/auth.js`
     - major components
     - lactario stack
     - vocacional stack
     - `modules/register.js`
     - `main.js`
     - `app.js`
   - At the bottom, still eager-loads `services/quejas-service.js` and `modules/quejas.js`.

2. `public/main.js`
   - Creates `UiManager`, `Router`, and `Breadcrumbs`.
   - Exposes `window.SIA_CORE` and `window.SIA._router`.
   - Owns the "report a problem" / support ticket modal flow and lazy-loads `services/superadmin-service.js` for that feature.
   - Exposes `window.navigate = (view) => router.navigate(view)`.

3. `public/app.js`
   - Still owns most live session behavior:
     - auth state flow
     - profile resolution
     - dashboard surface switching
     - register wizard flow
     - QA secret login
     - QA context/actor switching helpers
     - certificate verification route (`/verify/:folio`)
     - stories/avisos fullscreen viewer
     - shell drawers and mobile search
     - global notices banner
     - theme and shell helpers

4. `public/core/router.js`
   - Owns hash/history SPA routing and lazy script injection for most module stacks.
   - Uses `window.SIA.canAccessView()`, `getHomeView()`, and admin helpers from `services/firebase.js`.

### Important architecture note

The repo is now mixed-mode:

- `core/router.js` is the current route loader for most views.
- `app.js` still contains legacy navigation/dashboard logic and some special-case routes/features that bypass normal router flow.
- `index.html` still keeps a few legacy/duplicate containers for backward compatibility.

---

## 3. Shell Surfaces And Special Views

### DOM shells that matter

| Shell / View ID | Where | What it is |
|---|---|---|
| `landing-view` | `index.html` | `<sia-landing-view>` public landing |
| `view-register-wizard` | `index.html` | `<sia-register-wizard>` shell used by `modules/register.js` |
| `app-shell` | `index.html` | Main authenticated shell |
| `view-dashboard` | `index.html` | `<sia-student-dashboard>` standard dashboard surface |
| `view-department-dashboard` | `index.html` | Department multi-module dashboard surface (toggled by `app.js`) |
| `view-superadmin-dashboard` | `index.html` | SuperAdmin panel surface |
| `view-aula-course` | `index.html` | Deep Aula course shell |
| `verify-shell` | `index.html` | Public certificate verification shell, handled by `app.js` |

### Public / special routes

| Route / Pattern | View / Shell | Owner |
|---|---|---|
| `/` | landing or default home | `router.js` + `app.js` |
| `/register` | Reserved route, real DOM shell is `view-register-wizard` | `router.js` route exists, UI handled by `UiManager`/`app.js` |
| `/encuesta-publica` | `view-encuesta-publica` | `router.js` + `modules/encuestas.js` |
| `/mapa-campus` | `view-campus-map` or `view-campus-map-public` | `router.js` + `modules/campus-map.js` |
| `/test-vocacional` | `view-test-vocacional` | public component |
| `/vocacional/test` | `view-vocacional-test-active` | public component |
| `/verify/:folio` | `verify-shell` | `app.js` only |
| dynamic QA route | `view-qa-secret-login` | `app.js` + `services/firebase.js` |

### Legacy DOM notes

`public/index.html` still contains legacy placeholders:

- `view-biblio-legacy`
- duplicated `view-medi`
- duplicated `view-profile`

Do not assume every `view-*` container in `index.html` is part of the active router path.

---

## 4. Core Layer

| File | Main global/export | Responsibility |
|---|---|---|
| `public/core/state.js` | `Store` | Global session state, lightweight event emitter |
| `public/core/router.js` | `Router` | Routes, access checks, lazy module injection, module init dispatch |
| `public/core/breadcrumbs.js` | `Breadcrumbs`, `window.SIABreadcrumbs` | Breadcrumb state machine used by shell/components |
| `public/core/ui.js` | `UiManager` | Loader, landing/app/register shell transitions |
| `public/core/auth.js` | `AuthManager` | Legacy/auth helper class; real auth lifecycle still lives mostly in `app.js` |
| `public/main.js` | `window.SIA_CORE` | Boots router/UI and support modal |
| `public/app.js` | `window.SIA` glue | Main runtime glue and shell behavior |

### Core files added since the old map

- `public/core/breadcrumbs.js`
- `public/components/shell-breadcrumbs.js`
- `public/components/superadmin-switcher.js`

---

## 5. Route To Module Matrix

### Views loaded by `public/core/router.js`

| Route | View ID | Student/runtime controller | Admin/runtime controller | Notes |
|---|---|---|---|---|
| `/dashboard` | `view-dashboard` | `sia-student-dashboard` + `app.js` | department/superadmin surfaces toggled by `app.js` | Dashboard surface is not a classic JS module |
| `/aula` | `view-aula` | `AulaStudent` via `aula.js` | `AdminAula` via `aula.js` | Loads `config/aula-subject-catalog.js` and `aula-class-form.js` first |
| `/aula/curso/:id` | `view-aula-course` | `AulaClase` | `AulaClase` | Deep course route |
| `/comunidad` | `view-comunidad` | `window.Comunidad` | `window.AdminComunidad` | New module |
| `/biblio` | `view-biblio` | `window.Biblio` | `window.AdminBiblio` | Admin side now split into `admin-biblio/*` |
| `/medi` | `view-medi` | `window.Medi` (student factories) | `window.AdminMedi` | Student side now also split |
| `/foro` | `view-foro` | `window.Foro` | `window.AdminForo` | Student/admin controllers + Cloud Functions backend |
| `/lactario` | `view-lactario` | `window.Lactario` | `window.Lactario` | Thin orchestrator over student/admin controllers |
| `/quejas` | `view-quejas` | `window.Quejas` | same module, role-aware | Service now supports ticket responses/history migration |
| `/reportes` | `view-reportes` | `window.Reportes` | same | Submodules are preloaded by `index.html` |
| `/encuestas` | `view-encuestas` | `window.Encuestas` | same | Service + service-survey engine |
| `/encuesta-publica` | `view-encuesta-publica` | `window.Encuestas.initPublic()` | n/a | Public route |
| `/profile` | `view-profile` | `window.Profile` | same | Personal center |
| `/cafeteria` | `view-cafeteria` | `window.Cafeteria` | `window.AdminCafeteria` | Student/admin split |
| `/avisos` | `view-avisos` | `window.Avisos` | same module with admin/student modes | New module |
| `/mapa-campus` | `view-campus-map` or `view-campus-map-public` | `window.CampusMap` | n/a | Native SIA campus map module; public access swaps to `view-campus-map-public` when there is no auth session |
| `/notificaciones` | `view-notificaciones` | `window.Notifications` | same | Dedicated notification center |
| `/superadmin` | `view-superadmin-dashboard` | n/a | `window.SuperAdmin` | Full admin workspace |
| `/vocacional-admin` | `view-vocacional-admin` | n/a | `window.AdminVocacional` | CRM for aspirantes |
| `/test-vocacional` | `view-test-vocacional` | `<vocacional-landing>` | n/a | Public |
| `/vocacional/test` | `view-vocacional-test-active` | `<vocacional-test>` | n/a | Public |
| dynamic QA route | `view-qa-secret-login` | QA login shell | QA login shell | Route comes from `SIA.getQaSecretLoginConfig()` |

---

## 6. Module Inventory

## Aula

```text
public/modules/
|-- aula.js
|-- admin.aula.js
`-- aula/
    |-- aula-analytics.js
    |-- aula-clase.js
    |-- aula-class-form.js
    |-- aula-deadlines.js
    |-- aula-entregas.js
    |-- aula-grupos.js
    |-- aula-portfolio.js
    |-- aula-publicar.js
    `-- aula-student.js
```

- `aula.js` is the top-level orchestrator.
- Supports deep links:
  - `/aula/clase/:claseId`
  - `/aula/clase/:claseId/pub/:pubId`
- Student side uses:
  - `aula-deadlines.js`
  - `aula-student.js`
  - `aula-clase.js`
  - `aula-entregas.js`
  - `aula-portfolio.js`
- Admin/docente side uses:
  - `admin.aula.js`
  - `aula-analytics.js`
  - `aula-class-form.js`
  - publishing/group/grade helpers

## Comunidad

```text
public/modules/
|-- comunidad.js
|-- admin.comunidad.js
`-- comunidad/
    |-- comunidad.shared.js
    |-- comunidad.student.js
    `-- comunidad.admin.js
```

- New module not present in the old map.
- `comunidad.js` is the student orchestrator.
- `admin.comunidad.js` is the admin orchestrator.
- `comunidad.shared.js` provides delegated API helpers and UI/type config.
- Student controller covers:
  - feed
  - composer
  - comments/replies
  - reactions
  - report flow
  - media viewer
  - private messages
- Admin controller covers:
  - reports moderation
  - post moderation
  - user states (`active`, `muted`, `blocked`)

## Biblioteca

```text
public/modules/
|-- biblio.js
|-- admin.biblio.js
`-- admin-biblio/
    |-- shared.js
    |-- catalogo.js
    |-- prestamos.js
    |-- devoluciones.js
    |-- historial.js
    `-- reportes.js
```

- Student side is still a large monolith in `biblio.js`.
- Admin side is now split into submodules:
  - `shared.js`: shared escape/helpers/state utilities
  - `catalogo.js`: catalog and asset config
  - `prestamos.js`: loan flow
  - `devoluciones.js`: returns/forgiveness/satisfaction survey triggers
  - `historial.js`: search and timeline
  - `reportes.js`: metrics, active assets, service reservations
- `admin.biblio.js` is the runtime state/orchestration layer.

## Medico

```text
public/modules/
|-- medi.js
|-- admin.medi.js
|-- medi/
|   |-- student-experience.js
|   |-- student-chat.js
|   `-- student-appointments.js
`-- admin-medi/
    |-- ui.js
    |-- agenda.js
    |-- chat.js
    |-- consultas.js
    `-- tools.js
```

- Student side is no longer only `medi.js`.
- Student factories now come from:
  - `student-experience.js`
  - `student-chat.js`
  - `student-appointments.js`
- Student features now include:
  - queue position
  - reschedule/cancel flow
  - consultation detail modal / prescription export
  - chat with professionals
  - follow-up/wellness UX
- Admin side remains split:
  - `ui.js`: layout, expediente, print helpers
  - `agenda.js`: appointments/manual booking
  - `chat.js`: doctor-student chat
  - `consultas.js`: SOAP/consultation flow
  - `tools.js`: wall, metrics, config, walk-ins
- `admin.medi.js` is the state bridge/orchestrator for all admin submodules.

## Eventos / Foro

```text
public/modules/
|-- foro.js
|-- admin.foro.js
`-- foro/
    |-- foro.shared.js
    |-- foro.student.js
    `-- foro.admin.js
```

- Student orchestrator: `foro.js`
- Admin orchestrator: `admin.foro.js`
- Student flow includes:
  - event board
  - ticket/agenda
  - attendance QR scanning
  - resources modal
  - feedback
  - chat with organizers
  - calendar `.ics` download
  - participation certificate download
- Admin flow includes:
  - create/update/cancel event
  - approval/rejection queue
  - publish attendance/resources QR
  - attendees export
  - scanner
  - event conversations
  - resource rows
- Backend logic for this module is now split between browser services and `functions/foro.js`.

## Lactario

```text
public/modules/
|-- lactario.js
`-- lactario/
    |-- lactario.shared.js
    |-- lactario.student.js
    `-- lactario.admin.js
```

- `lactario.js` is now a thin orchestrator.
- Shared controller model via `window.LactarioModule`.
- Student/admin features include:
  - bookings
  - reschedule
  - QR scanner/manual QR
  - spaces
  - fridges
  - admin overview/agenda/stats
  - linked medical support appointments

## Cafeteria

```text
public/modules/
|-- cafeteria.js
`-- admin.cafeteria.js
```

- Student side:
  - menu
  - cart
  - orders
  - reviews
  - realtime active order status
- Admin side:
  - dashboard
  - orders
  - product catalog
  - reviews moderation
  - config

## Avisos

```text
public/modules/avisos.js
```

- New module not present in the old map.
- Single module with two modes:
  - student feed/story-like consumption
  - admin management panel
- Tracks per-user view analytics via `usuarios/{uid}/avisoViews`.

## Encuestas

```text
public/modules/
|-- encuestas.js
`-- encuestas/
    |-- encuestas-ui.js
    |-- encuestas-forms.js
    |-- encuestas-responses.js
    `-- encuestas-nav.js
```

- Institutional survey center.
- Handles both authenticated and public survey renders.
- Also integrates the service-survey engine (`EncuestasServicioService`) used by other modules.

## Campus Map

```text
public/modules/
|-- campus-map.js
`-- campus-map/
    `-- data.js
```

- Native campus map module rendered directly inside SIA.
- Uses the institutional PNG under `public/images/campus-map/mapa-ites.png`.
- No iframe, no Leaflet, no online tiles, and no Firestore config document for coordinate overrides.
- Supports both:
  - authenticated shell: `view-campus-map`
  - public shell: `view-campus-map-public`
- `campus-map/data.js` currently stores the building catalog for:
  - `D`
  - `E`
  - `V`
  - `I`
  - `N`
  - `O`
  - `P`
  - `Taller de Ingenieria Civil`

## Reportes

```text
public/modules/
|-- reportes.js
`-- reportes/
    |-- reportes-biblio.js
    |-- reportes-charts.js
    |-- reportes-filters.js
    |-- reportes-medico.js
    `-- reportes-poblacion.js
```

- Orchestrator + submodules.
- Main areas:
  - Biblioteca
  - Medico
  - Poblacion
- Submodules are preloaded from `index.html`.

## Other module entrypoints

| File | Global | Responsibility |
|---|---|---|
| `public/modules/profile.js` | `window.Profile` | Personal center: account, health, context, preferences, activity |
| `public/modules/register.js` | `window.SIA_Register` | Full registration wizard with student/docente/administrativo/operativo paths and staff presets |
| `public/modules/superadmin.js` | `window.SuperAdmin` | Users, logs, support tickets, config, dashboards |
| `public/modules/vocacional-admin.js` | `window.AdminVocacional` | CRM for aspirantes and stats |
| `public/modules/notifications.js` | `window.Notifications` | Dedicated notification center |
| `public/modules/quejas.js` | `window.Quejas` | Complaints/suggestions UX |
| `public/modules/campus-map.js` | `window.CampusMap` | Interactive campus map driven by a fixed institutional image and local building metadata |

### Cross-cutting shell feature added since the old map

- Support / bug report modal:
  - UI: `public/index.html` (`modalReportProblem`, `btn-report-problem`)
  - runtime: `public/main.js`
  - backend service: `public/services/superadmin-service.js`
  - collection: `tickets-soporte`

---

## 7. Service Inventory

| File | Global | Main collections / storage paths | Notes |
|---|---|---|---|
| `public/services/firebase.js` | `window.SIA` | `usuarios` | Firebase bootstrap, auth, QA context presets, role/access helpers, storage, FieldValue/FieldPath |
| `public/services/aula-service.js` | `window.AulaService` | `aula-clases`, `aula-miembros`, `aula-publicaciones`, `aula-entregas`, `aula-comentarios`, `aula-votos`, `aula-reacciones`, `aula-grupos`, `aula-plantillas`, `usuarios` | Classes, members, publications, deliveries, portfolio, groups |
| `public/services/comunidad-service.js` | `window.ComunidadService` | `comunidad_posts`, `comunidad_comments`, `comunidad_reactions`, `comunidad_reports`, `comunidad_user_states`, storage `users/{uid}/comunidad/posts/*` | Post/comment/report/moderation service |
| `public/services/comunidad-chat-service.js` | `window.ComunidadChatService` | `comunidad_conversations/{id}/messages`, `comunidad_user_states` | Private messages for Comunidad |
| `public/services/biblio-service.js` | `window.BiblioService` | `biblio-catalogo`, `prestamos-biblio`, `biblio-visitas`, `biblio-visitas-activos`, `biblio-solicitudes`, `biblio-wishlist`, `biblio-reservas`, `biblio-activos`, `biblio-config`, `usuarios`, collection group `waitlist` | Student + admin library data surface, including holiday calendar / business-day loan rules |
| `public/services/biblio-assets-service.js` | `window.BiblioAssetsService` | `biblio-activos`, `biblio-reservas`, `usuarios` | PCs/salas/mesas/reservations/auto-release |
| `public/services/medi-service.js` | `window.MediService` | `citas-medi`, `expedientes-clinicos/{uid}/consultas`, `expedientes-clinicos/{uid}/consultas-privadas`, `medi-config`, `medi-slots` (legacy), `medi-shift-profiles`, `usuarios/{uid}/profiles`, `usuarios` | Current medico data layer |
| `public/services/medi-chat-service.js` | `window.MediChatService` | `medi-conversations/{id}/messages` | Medico/paciente chat |
| `public/services/foro-service.js` | `window.ForoService` | `foro_events`, `foro_tickets` | Browser wrapper around Firestore + Cloud Function actions |
| `public/services/foro-chat-service.js` | `window.ForoChatService` | `foro_conversations/{id}/messages` | Event organizer/student chat |
| `public/services/cafeteria-service.js` | `window.CafeteriaService` | `cafeteria-config`, `cafeteria-productos`, `cafeteria-pedidos`, `cafeteria-resenas`, storage `cafeteria/*` | Products, orders, receipts, reviews |
| `public/services/lactario-service.js` | `window.LactarioService` | `lactario-bookings`, `lactario-spaces`, `lactario-config/main`, `lactario_fridges`, `lactario-visits`, linked `citas-medi` | Lactario ops + linked medical support |
| `public/services/quejas-service.js` | `window.QuejasService` | `quejas/{ticket}/responses`, storage `quejas/{uid}/*` | Ticket lifecycle + legacy history migration |
| `public/services/encuestas-service.js` | `window.EncuestasService` | `encuestas`, `encuestas-respuestas`, `usuarios/{uid}/surveyLaunchSeen` | Institutional/public surveys |
| `public/services/encuestas-servicio-service.js` | `window.EncuestasServicioService` | `encuestas-servicio`, `encuestas-servicio-respuestas`, `encuestas-servicio-triggers` | Service survey configs, triggers, responses |
| `public/services/reportes-service.js` | `window.ReportesService` | reads `usuarios`, `biblio-visitas`, `prestamos-biblio`, `citas-medi`, `expedientes-clinicos`, `biblio-catalogo`, `biblio-activos` | Aggregations and report fetchers |
| `public/services/scanner-service.js` | `window.ScannerService` | `scanner-stations` | Realtime listener for hardware scanner stations and QR/code normalization |
| `public/services/superadmin-service.js` | `window.SuperAdminService` | `system-logs`, `usuarios`, `tickets-soporte`, `config`, `avisos`, `reportes_cache` | Global admin, support tickets, config |
| `public/services/profile-service.js` | `window.ProfileService` | `usuarios`, storage `users/{uid}/profile_pic.jpg` | Safe profile updates + avatar upload/delete |
| `public/services/avisos-service.js` | `window.AvisosService` | `avisos`, `usuarios/{uid}/avisoViews` | Institutional notices + analytics |
| `public/services/notify.js` | `window.Notify` | `usuarios/{uid}/notificaciones` | In-app feed, toast, sound, local push delegation |
| `public/services/push-service.js` | `window.PushService` | `usuarios/{uid}/pushTokens/{web|native_*}` | Hybrid push service: web FCM + Capacitor native |
| `public/services/vocacional-service.js` | `window.VocacionalService` | `aspirantes-registros`, `vocacional_config`, `reportes_cache/vocacional_stats` | Vocational test data and CRM |

### Config and utility files that now matter

| File | Responsibility |
|---|---|
| `public/config/departments.js` | Department directory and institutional routing/support for register/auth |
| `public/config/aula-subject-catalog.js` | Career/semester/subject catalog used by Aula |
| `public/utils/export-utils.js` | CSV/Excel/PDF export helpers |
| `public/utils/pdf-generator.js` | PDF generation helpers used across modules |
| `public/utils/time-utils.js` | Formatting and date helpers |
| `public/utils/ui.js` | `showToast`, `showConfirm`, shared browser UI helpers |

---

## 8. Components

| File | Tag | Responsibility |
|---|---|---|
| `public/components/landing-view.js` | `<sia-landing-view>` | Public landing page |
| `public/components/register-wizard.js` | `<sia-register-wizard>` | Registration shell component |
| `public/components/student-dashboard.js` | `<sia-student-dashboard>` | Main dashboard surface with cards, stories, KPIs, tips, offline, SOS |
| `public/components/onboarding-tour.js` | `<sia-onboarding-tour>` | Student onboarding tour |
| `public/components/admin-medi-tour.js` | `<admin-medi-tour>` | Admin medico tour |
| `public/components/navbar.js` | `<sia-navbar>` | Student desktop shell/navbar |
| `public/components/admin-navbar.js` | `<sia-admin-navbar>` | Admin desktop shell/navbar with quick actions |
| `public/components/shell-breadcrumbs.js` | `<sia-shell-breadcrumbs>` | Breadcrumb renderer driven by `Breadcrumbs` state |
| `public/components/dev-tools.js` | `<sia-dev-tools>` | Dev-only helpers |
| `public/components/superadmin-switcher.js` | `<sia-superadmin-switcher>` | QA context + actor switcher for superadmin |
| `public/components/vocacional-landing.js` | `<vocacional-landing>` | Public vocational landing |
| `public/components/vocacional-test.js` | `<vocacional-test>` | Public vocational test runner |

### Component changes vs the old map

- Dashboard tag is now `<sia-student-dashboard>`, not `<student-dashboard>`.
- Breadcrumb component exists now.
- QA/superadmin switcher exists now.
- Campus map is no longer a standalone web component shell; it now renders as a native module.

---

## 9. Styles

### `public/styles/`

| File | Responsibility |
|---|---|
| `01-theme-base.css` | Base tokens and theme vars |
| `02-aula-module.css` | Aula module styling |
| `03-landing-foundation.css` | Landing structure |
| `04-landing-visuals.css` | Landing visuals/animation |
| `05-landing-platform.css` | Landing platform section |
| `06-landing-app-responsive.css` | Landing/app responsive rules |
| `07-dashboard-foundation.css` | Dashboard base |
| `08-theme-and-profile-overrides.css` | Theme/profile overrides |
| `09-navigation-shell.css` | Navbar, drawer, mobile nav shell |
| `10-dashboard-interactions.css` | Dashboard interactions/animations |
| `11-controls-reportes.css` | Report controls/tables |
| `12-foro-events.css` | Eventos styling |
| `13-medi-components.css` | Medico components |
| `14-superadmin.css` | Superadmin panel |
| `15-comunidad-module.css` | Comunidad module styling |
| `16-campus-map.css` | Interactive campus map layout, hotspots, quick nav, and detail panel |

### Styling note

`public/styles.css` still exists and still coexists with the modular CSS files.

---

## 10. Cloud Functions

## `functions/index.js`

Current exports:

- `sendPushOnNewNotification`
  - Trigger: `usuarios/{uid}/notificaciones/{notifId}`
  - Sends push notifications through FCM and clears invalid tokens
- `aggregateAvisoViews`
  - Trigger: `usuarios/{uid}/avisoViews/{avisoId}`
  - Updates `avisos.analytics.*`
- `aggregateSurveyResponses`
  - Trigger: `encuestas-respuestas/{responseId}`
  - Updates `encuestas.analytics.*`
- `aggregateServiceSurveyResponses`
  - Trigger: `encuestas-servicio-respuestas/{responseId}`
  - Updates service survey counters
- `aggregateServiceSurveyExemptions`
  - Trigger: `encuestas-servicio-triggers/{triggerId}`
  - Updates `analytics.notUsedCount`
- `ingestScannerEvent`
  - HTTPS endpoint for device scanners (ESP32/M5Stack) with shared secret
  - Upserts latest scan into `scanner-stations/{stationId}`
- Re-exports all handlers from `functions/foro.js`

## `functions/foro.js`

Current exports:

- `foroUpsertEvent`
- `foroReviewEvent`
- `foroCancelEvent`
- `foroRegister`
- `foroCancelRegistration`
- `foroMarkAttendance`
- `foroMarkAttendanceByEventQr`
- `foroSubmitFeedback`
- `foroGetEventQrPayload`
- `foroGetEventResources`
- `foroSendUpcomingReminders`
- `foroNotifyNewMessage`

### Foro backend collections and subdocs

Main backend writes/reads in `functions/foro.js`:

- `foro_events`
- `foro_tickets`
- `foro_conversations/{convId}/messages`
- `foro_events/{eventId}/private/*`
- `foro_events/{eventId}/feedback/*`
- `usuarios/{uid}/notificaciones`

---

## 11. Roles, Access, QA Context

### Access is now centralized in `public/services/firebase.js`

Key helpers:

- `getEffectiveAllowedViews(profile)`
- `getHomeView(profile)`
- `canAccessView(profile, viewId)`
- `canAdminMedi(profile)`
- `canAdminBiblio(profile)`
- `canAdminForo(profile)`
- `canAdminComunidad(profile)`
- `canAdminCafeteria(profile)`
- `isAdminWorkspaceProfile(profile)`

### Default standard view sets

`services/firebase.js` currently defines:

- `student`
  - `view-dashboard`, `view-aula`, `view-comunidad`, `view-medi`, `view-biblio`, `view-foro`, `view-quejas`, `view-encuestas`, `view-cafeteria`
- `docente`
  - same base set as student
- `personal`
  - `view-dashboard`, `view-comunidad`, `view-medi`, `view-biblio`, `view-foro`, `view-quejas`, `view-encuestas`, `view-cafeteria`

### Permission-derived department views

Permission keys that currently map to views:

- `aula`
- `comunidad`
- `medi`
- `biblio`
- `foro`
- `cafeteria`
- `lactario`
- `quejas`
- `encuestas`
- `reportes`
- `vocacional`
- `avisos`

### Important access rules today

- `view-profile` and `view-notificaciones` are always accessible to authenticated users.
- Multi-view `department_admin` profiles get `view-dashboard` injected as a home surface.
- `comunidad` is auto-added unless `permissions.comunidad` is explicitly disabled-like (`disabled`, `none`, `false`, etc.).

### QA secret login and context switching

Current QA support lives across:

- `public/services/firebase.js`
  - `getQaSecretLoginConfig()`
  - `loginQaSecret()`
  - `getQaContextPresets()`
  - `searchQaActors()`
  - `canUseQaContextSwitcher()`
  - actor/profile storage helpers
- `public/app.js`
  - renders/handles `view-qa-secret-login`
  - syncs QA route/session
- `public/components/superadmin-switcher.js`
  - runtime QA context and actor switcher

Known QA presets in `firebase.js`:

- `superadmin_full`
- `student`
- `personal`
- `aula_docente`
- `aula_admin`
- `medico`
- `psicologo`
- `biblio`
- `calidad`
- `difusion`
- `desarrollo`
- `cafeteria`
- `foro_admin`

---

## 12. PWA And Hybrid App Layer

| File | Responsibility |
|---|---|
| `public/sw.js` | Offline/static caching |
| `public/firebase-messaging-sw.js` | Web push handling for FCM |
| `public/manifest.json` | PWA metadata |
| `capacitor.config.json` | Hybrid app config |
| `package.json` | Capacitor packages and `live-server` dev script |
| `public/services/push-service.js` | Web FCM + Capacitor native push bridge |

### Push architecture

- In-app notifications:
  - `public/services/notify.js`
  - `public/modules/notifications.js`
- Device push:
  - `public/services/push-service.js`
  - `public/firebase-messaging-sw.js`
  - `functions/index.js::sendPushOnNewNotification`

---

## 13. `.agents/` Current Layout

```text
.agents/
|-- project-map.md
|-- implementation_plan.md
|-- plan_modulo_comunidad.md
|-- skills/
|   |-- core_rules_sia/SKILL.md
|   |-- firebase_sia/SKILL.md
|   |-- qa_ortografia/SKILL.md
|   `-- web_components_sia/SKILL.md
|-- subagents/
|   |-- README.md
|   |-- STARTER_PROMPTS.md
|   |-- backend/
|   |-- core/
|   `-- frontend/
`-- workflows/
    |-- analizador_seguridad.md
    |-- asesor_pre_desarrollo_sia.md
    |-- corregir_ortografia.md
    |-- crear_modulo_sia.md
    |-- crear_servicio_firebase.md
    |-- crear_web_component.md
    |-- optimizar_firebase_queries.md
    |-- refactorizar_modulo_gigante.md
    |-- solucionar_bug_sia.md
    `-- image/
```

### Notable additions vs the old map

- `implementation_plan.md`
- `plan_modulo_comunidad.md`
- full `subagents/` hierarchy
- new workflow `analizador_seguridad.md`
- new workflow `asesor_pre_desarrollo_sia.md`
- workflow preview assets under `.agents/workflows/image/`

---

## 14. Quick Where-Is-X Guide

| If you need to inspect... | Start here |
|---|---|
| Hardware scanner ingestion / listener | `functions/scanner.js`, `public/services/scanner-service.js`, `public/modules/admin-biblio/reportes.js` |
| Current route loading and lazy dependencies | `public/core/router.js` |
| Actual boot sequence and support modal | `public/main.js` |
| Auth/session, QA route, verify route, shell glue | `public/app.js` |
| QA superadmin context switching | `public/services/firebase.js`, `public/components/superadmin-switcher.js`, `public/app.js` |
| Certificate verification (`/verify/:folio`) | `public/app.js`, `public/index.html` (`verify-shell`) |
| Bug report / support tickets | `public/main.js`, `public/index.html`, `public/services/superadmin-service.js` |
| Comunidad feed / moderation / chat | `public/modules/comunidad/*`, `public/services/comunidad-service.js`, `public/services/comunidad-chat-service.js` |
| Eventos full stack | `public/modules/foro/*`, `public/services/foro-service.js`, `public/services/foro-chat-service.js`, `functions/foro.js` |
| Avisos center and analytics | `public/modules/avisos.js`, `public/services/avisos-service.js`, `functions/index.js` |
| Biblio admin internals | `public/modules/admin-biblio/*`, `public/modules/admin.biblio.js`, `public/services/biblio-service.js`, `public/services/biblio-assets-service.js` |
| Medico appointments/records/chat | `public/modules/medi/*`, `public/modules/admin-medi/*`, `public/services/medi-service.js`, `public/services/medi-chat-service.js` |
| Aula deep course flow | `public/modules/aula.js`, `public/modules/aula/aula-clase.js`, `public/services/aula-service.js` |
| Lactario + linked medical support | `public/modules/lactario/*`, `public/services/lactario-service.js`, `public/services/medi-service.js` |
| Quejas ticket lifecycle | `public/modules/quejas.js`, `public/services/quejas-service.js` |
| Encuestas and service surveys | `public/modules/encuestas/*`, `public/services/encuestas-service.js`, `public/services/encuestas-servicio-service.js` |
| Reportes data aggregation | `public/modules/reportes/*`, `public/services/reportes-service.js` |
| Notifications center / feed / push | `public/modules/notifications.js`, `public/services/notify.js`, `public/services/push-service.js`, `functions/index.js` |
| Campus map module | `public/modules/campus-map.js`, `public/modules/campus-map/data.js`, `public/images/campus-map/mapa-ites.png`, `public/core/router.js`, `public/index.html` |
| Vocacional CRM and public test | `public/modules/vocacional-admin.js`, `public/services/vocacional-service.js`, `public/components/vocacional-*`, `public/data/vocacional-preguntas-v2.json` |

---

## 15. Summary Of Biggest Deltas From The Old Map

The old map is no longer accurate in these areas:

- `comunidad` now exists as a first-class module with student/admin controllers and chat.
- `avisos` now exists as a full module plus analytics and Cloud Function aggregation.
- `foro` now has a real backend in `functions/foro.js`, not just front-end views.
- `medi` student flow is split into `student-experience`, `student-chat`, and `student-appointments`.
- `biblio` admin flow is split into `admin-biblio/*`.
- `aula` added `aula-class-form.js` and the subject catalog in `config/aula-subject-catalog.js`.
- `core/breadcrumbs.js`, `shell-breadcrumbs`, and `superadmin-switcher` are new.
- `mapa-campus` is now a native SIA module and no longer depends on the removed standalone app under `news/edificios` or the removed `public/campus-map/` iframe bundle.
- QA secret login and QA actor/context switching are now first-class runtime features.
- Support tickets (`tickets-soporte`) and the report-problem modal are now part of the app shell.
- Cloud Functions are now broader than push: notices analytics, survey aggregations, forum workflows, reminders, and event messaging.
