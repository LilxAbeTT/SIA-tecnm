# SIA Technical Skills & Standards

## 1. Firebase v9 Modular Pattern (Standard)
- **Principle:** Use the functional/modular SDK for all new services.
- **Example:** `import { doc, updateDoc } from "firebase/app";` instead of `db.collection().update()`.
- **Logic:** Data fetching belongs to `public/services/`. Modules must only consume these services.

## 2. Web Component Architecture
- **Structure:** All new UI modules must be Custom Elements (Web Components).
- **Template:** Use a clean `innerHTML` in `connectedCallback` and manage styles via global CSS or scoped classes.
- **Interaction:** Communicate via `CustomEvents` and use the global `Store` for state.

## 3. Security & Access Control
- **Validation:** Every new view or action must check `Store.userProfile.allowedViews`.
- **Hierarchy:** Respect the hierarchy: `superadmin` > `department_admin` > `staff` > `student`.

## 4. UI/UX Excellence (Bootstrap 5 + Custom)
- **Feedback:** Use `Notify.js` for all async operations (loading, success, error).
- **Clean Code:** Functions must be small, single-purpose, and documented with JSDoc.