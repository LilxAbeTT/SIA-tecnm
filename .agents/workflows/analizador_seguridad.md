---
description: Analizar vulnerabilidades de seguridad, fugas de datos y malas prácticas en módulos o servicios del proyecto SIA
---

# Workflow: Analizador de Seguridad SIA (`/analizador_seguridad`)

## Uso
El usuario puede invocar este workflow apuntando a una zona específica o a todo el proyecto:
- `@analizador_seguridad Revisa todo el módulo médico`
- `@analizador_seguridad Revisa todos los servicios`
- `@analizador_seguridad Revisa el archivo admin.cafeteria.js`
- `@analizador_seguridad Revisa todo el proyecto completo`

Al terminar, **siempre** entrega un reporte estructurado con hallazgos categorizados por severidad: 🔴 Crítico, 🟠 Alto, 🟡 Medio, 🟢 Bajo/Informativo.

---

## FASE 1: Definir el Alcance

1. **Leer el `project-map.md`** en `.agents/project-map.md` para ubicar los archivos que corresponden al alcance solicitado.
2. **Listar los archivos a auditar** siguiendo esta prioridad de riesgo:
   - `public/services/*.js` → Acceso directo a Firestore/Auth/Storage (riesgo más alto)
   - `public/modules/*.js` y sub-carpetas → Lógica de negocio
   - `public/core/*.js` → Router, Auth, State global
   - `public/components/*.js` → Web Components
   - `firestore.rules` y `storage.rules` → Reglas de seguridad backend
   - `functions/index.js` → Cloud Functions
3. **Leer los archivos del alcance** usando `view_file`. Si el archivo tiene más de 400 líneas, leerlo en bloques de 400 líneas.

---

## FASE 2: Checklist de Vulnerabilidades

Para **cada archivo auditado**, revisa todos los puntos de esta lista de forma EXHAUSTIVA. No omitas ninguna categoría aunque el archivo parezca simple.

### 🔴 CRÍTICO – Compromete datos o acceso de usuarios

#### C1. Acceso a Firestore sin verificación de rol en el cliente
- Busca llamadas directas como `SIA.db.collection('usuarios').get()` sin ningún filtro `where('uid', '==', uid)`.
- Busca funciones que devuelvan TODOS los documentos de una colección sensible (citas, consultas, historial médico, datos de perfil) a cualquier usuario que llame la función, sin validar el UID del usuario actual contra el UID del documento.
- **Problema:** Una función expuesta en `window.ModuloX.cargarTodo()` puede ser llamada desde la consola del navegador.

#### C2. Exposición de globals peligrosas en `window`
- Lista todos los objetos expuestos en `window.*` dentro del archivo.
- Busca funciones en esos globales que permitan: eliminar documentos, cambiar roles (`role`, `permissions`, `allowedViews`), crear registros con datos arbitrarios, o acceder a datos de otros usuarios.
- **Problema:** Cualquier `window.AdminMedi.saveConsultation({uid: 'otro-uid', ...})` puede ser ejecutada desde la consola por un estudiante que sepa el UID de otra persona.

#### C3. Modificación de campos de seguridad sin validación de rol
- Busca cualquier función que haga `updateDoc` o `setDoc` sobre campos como: `role`, `permissions`, `allowedViews`, `superadmin`, `fcmToken`, `pushTokens`.
- Verifica que esa función compruebe el rol ANTES de llamar a Firestore, no solo en la UI.
- **Recuerda:** La validación UI se puede saltar desde consola. La línea de defensa real son las `firestore.rules`.

#### C4. Parámetros de funciones públicas no validados
- Para cada función exportada en el `return {}` del IIFE, verifica que los parámetros de entrada (UIDs, IDs de documentos, roles) sean validados y sanitizados.
- Busca si algún parámetro se inyecta directamente en una query de Firestore sin sanitizar: `collection(db, 'citas-medi').doc(uid)` donde `uid` viene de un input del usuario o de un parámetro en la URL/hash.

#### C5. Configuración desde la consola del navegador
- Busca bloques como `if (window.devMode)`, `if (localStorage.getItem('sia_dev'))`, o cualquier flag que active comportamientos especiales (bypass de roles, acceso admin, skip de validaciones).
- Verifica que esos flags NO puedan ser activados por un usuario normal escribiendo en la consola: `localStorage.setItem('sia_dev', true)`.
- **Si existen:** El flag debe ser comparado contra un valor secreto generado por el servidor, o eliminarse completamente en producción.

---

### 🟠 ALTO – Fuga de información o superficie de ataque amplia

#### A1. `console.log` con información sensible
- Busca con `grep_search` el patrón `console.log` en el archivo.
- Marca como vulnerabilidad cualquier `console.log` que imprima: tokens FCM, UIDs de usuarios, datos de perfil (nombre, teléfono, email), resultados completos de `getDoc`/`getDocs`, respuestas de autenticación, PINs o contraseñas.
- Todos esos logs son visibles en DevTools de cualquier navegador y en el panel de Firebase Remote Config/Logging.
- **Solución:** Reemplazar por `console.debug()` (solo activo en builds de desarrollo) o eliminar.

#### A2. Datos de otros usuarios accesibles sin autorización
- Busca funciones que reciban un `uid` como parámetro y lo usen directamente para leer datos de Firestore, sin compararlo contra el `ctx.user.uid` del usuario en sesión.
- Ejemplo problemático: `function getExpediente(uid) { return db.collection('consultas-medi').where('uid', '==', uid).get(); }` — si `uid` viene de afuera, cualquier usuario puede pedir el expediente de cualquier otro.

#### A3. IDs o rutas sensibles expuestas en el DOM/HTML
- Busca `data-uid`, `data-doc-id`, `data-token` o similares renderizados directamente en el HTML que genere el módulo.
- Estos valores quedan visibles en la inspección del DOM y pueden usarse para exfiltrar datos o ejecutar operaciones sobre documentos ajenos.

#### A4. Llamadas a Cloud Functions o APIs externas sin autenticación
- Busca `fetch(...)`, `axios(...)` o `XMLHttpRequest` en el archivo.
- Verifica que toda llamada saliente lleve el token de autenticación (`Authorization: Bearer ...`) y no envíe datos de usuario sin cifrar en la URL como query params.

---

### 🟡 MEDIO – Malas prácticas que facilitan ataques

#### M1. `innerHTML` con datos no sanitizados
- Busca asignaciones de `element.innerHTML = ...` donde el contenido incluya datos provenientes de Firestore o del usuario (nombres, correos, mensajes del foro, comentarios, títulos, etc.).
- Estos son vectores de XSS (Cross-Site Scripting). Un usuario malintencionado puede guardar `<script>alert(document.cookie)</script>` como su nombre y ejecutar JS en el navegador de otros usuarios.
- **Solución:** Usar `textContent` para texto plano, o `DOMPurify.sanitize(html)` para HTML enriquecido.

#### M2. Hash/URL como vector de entrada
- Busca si el módulo o el router lee `window.location.hash` o `location.href` y usa ese valor directamente para navegar, cargar datos o renderizar.
- Un atacante puede construir un link malicioso como `tuapp.com/#/medi?uid=victima123` que al abrirse ejecute código o exfiltre datos en nombre de la víctima.

#### M3. `eval()`, `Function()`, `setTimeout(string)`, `setInterval(string)`
- Busca cualquier uso de `eval(...)`, `new Function(...)`, `setTimeout('código_string', ...)`, `setInterval('código_string', ...)`.
- Son inyecciones de código garantizadas si alguna de esas cadenas proviene de datos externos.

#### M4. Escucha de eventos globales sin validación de origen
- Busca `window.addEventListener('message', ...)` o `window.addEventListener('sia-*', ...)`.
- Verifica que el handler valide siempre el origen del evento (`event.origin`, `event.source`) antes de procesar su contenido.

#### M5. Tokens, Keys o credenciales hardcodeadas
- Busca strings que parezcan API Keys, tokens, secrets, contraseñas o hashes fuera de `firebase.js` o `push-service.js`.
- Reporta la línea exacta. Las únicas keys aceptables en el front-end son las del SDK de Firebase (que son públicas por diseño) y la VAPID public key de FCM.

---

### 🟢 BAJO / INFORMATIVO – Higiene de código que reduce superficie de ataque

#### B1. Funciones exportadas innecesariamente en el `return {}`
- Revisa el `return { ... }` final del IIFE.
- Cualquier función que solo sea usada internamente y NO sea llamada desde el HTML con `onclick="Modulo.funcion()"` NO debería estar exportada en el objeto público. Cada función pública innecesaria es superficie de ataque potencial desde la consola.

#### B2. `try/catch` genérico que oculta errores sin loguear
- Busca bloques `catch(e) {}` vacíos o `catch(e) { return null; }` sin ningún `console.error`.
- Un catch silencioso puede ocultar un acceso denegado por Firestore Rules, enmascarando que alguien está intentando acceder a datos sin permiso.

#### B3. Ausencia de validación de tipos en parámetros
- Funciones que reciben un `uid` o `id` deben verificar que sea un string no vacío antes de llamar a Firestore: `if (!uid || typeof uid !== 'string') return;`
- Sin esta validación, una llamada con `uid = undefined` puede acceder a documentos erróneos o generar errores difíciles de trazar.

#### B4. Listeners de Firestore (`onSnapshot`) nunca desuscritos
- Busca llamadas a `onSnapshot(...)` y verifica que el `unsubscribe` retornado sea almacenado y llamado en el evento de limpieza del módulo (`sia-view-changed`, `disconnectedCallback`, etc.).
- Un listener zombie sigue leyendo datos de Firestore (genera costos y puede leer datos de usuarios que ya cambiaron de sesión).

---

## FASE 3: Auditar `firestore.rules` (siempre incluir si el alcance es amplio)

Lee el archivo `firestore.rules` en la raíz del proyecto y verifica:

1. **Regla de denegación por defecto:** El archivo debe iniciar con `allow read, write: if false;` a nivel raíz, o cada colección debe tener reglas explícitas. Si alguna colección importante no tiene regla → acceso público por defecto.
2. **Validación de propiedad del documento:** Para colecciones de usuarios, las reglas deben verificar `request.auth.uid == resource.data.uid` o `request.auth.uid == userId` (en colecciones con paths tipo `usuarios/{userId}`).
3. **Validación de rol del lado del servidor:** Para operaciones admin, la regla debe leer el perfil del usuario: `get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role == 'superadmin'`.
4. **Sub-colecciones sensibles:** Verificar que `usuarios/{uid}/notificaciones`, `usuarios/{uid}/pushTokens` solo sean accesibles por el propio `uid`.
5. **Reglas de Storage:** Leer `storage.rules` y verificar que los archivos de usuarios solo sean escritos/leídos por el propietario.

---

## FASE 4: Formato del Reporte Final

Entrega un reporte con esta estructura exacta:

```
# 🔐 Reporte de Seguridad SIA
**Alcance:** [archivos o módulo auditado]
**Fecha:** [fecha actual]
**Total de hallazgos:** X (🔴 Críticos: X | 🟠 Altos: X | 🟡 Medios: X | 🟢 Bajos: X)

---

## 🔴 Hallazgos Críticos

### [HAL-001] Título descriptivo del problema
- **Archivo:** `public/modules/ejemplo.js`
- **Línea(s):** ~42-58
- **Descripción:** Explicación clara de por qué es un riesgo y cómo puede ser explotado.
- **Evidencia:** (código o fragmento exacto que lo demuestra)
- **Solución recomendada:** Paso concreto para corregirlo.

[Repetir para cada hallazgo]

---

## 🟠 Hallazgos Altos
[...]

## 🟡 Hallazgos Medios
[...]

## 🟢 Hallazgos Bajos / Informativos
[...]

---

## ✅ Aspectos Correctamente Implementados
[Lista breve de lo que SÍ está bien protegido en el alcance auditado]

## 📋 Acciones Recomendadas (Ordenadas por Prioridad)
1. [Acción más urgente]
2. [Segunda acción]
...
```

---

## Reglas del Workflow

- **NO modificar código** durante el análisis. Solo reportar. El usuario debe aprobar las correcciones antes de aplicarlas.
- **Siempre leer el código real** — no asumir que algo es seguro sin verlo.
- Si el alcance es todo el proyecto, auditar en este orden: `firestore.rules` → `storage.rules` → `core/` → `services/` → `modules/` → `components/`.
- Si el archivo auditado NO presenta ninguna vulnerabilidad en alguna categoría, escribir explícitamente `✅ Sin hallazgos en esta categoría` para que el reporte sea completo y no parezca que se omitió la revisión.
- Siempre incluir el conteo final de hallazgos en el encabezado del reporte.
