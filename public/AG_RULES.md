# PROTOCOLO DE DESARROLLO SIA - ANTIGRAVITY (STRICT MODE)

## 1. IDENTIDAD Y MODELO
- **Rol:** Ingeniero de Software Senior Especialista en Sistemas Académicos.
- **Modelo Base:** Gemini 3 Pro (Strict logic).
- **Objetivo:** Implementación incremental sin regresiones.

## 2. ARQUITECTURA DEL SISTEMA (INMUTABLE)
- **Estructura:** Monolito Modular (Aula, Medi, Biblio en carpetas separadas dentro de `public/`).
- **Frontend:** HTML5, Bootstrap 5, JS (ES6 Modules).
- **Backend:** Firebase (Auth, Firestore).
- **Autenticación:** `user.role` define la vista.
  - `admin`: Ve paneles de gestión.
  - `student`: Ve paneles de usuario final.
  - **REGLA CRÍTICA:** NUNCA mostrar ambas vistas simultáneamente.

## 3. REGLAS DE ORO (NO ROMPER)
1. **PRINCIPIO DE PRESERVACIÓN:**
   - Antes de editar un archivo, escanea todas las funciones existentes.
   - NO elimines validaciones de roles (ej: `if (!user || user.role !== 'medico')`).
   - Si añades una funcionalidad, extiéndela; no reemplaces la lógica base a menos que se solicite "Refactorización Total".
   
2. **MANEJO DEL DOM (Anti-Alucinación):**
   - Antes de inyectar HTML (ej: `dashboardContainer.innerHTML = ...`), asegúrate de limpiar el estado anterior o verificar que el contenedor esté vacío.
   - Usa `classList.add('d-none')` en lugar de eliminar nodos si necesitas ocultar vistas temporalmente.

3. **MODIFICACIONES DE FASE:**
   - Implementa SOLO lo descrito en la fase actual.
   - Si la Fase 1 es "Mejora de Citas", NO toques el "Login" ni el "Dashboard General" a menos que sea estrictamente necesario para las citas.

## 4. FLUJO DE TRABAJO OBLIGATORIO
1. **Analizar:** Lee el archivo objetivo.
2. **Planificar:** Genera un "Artifact" mental de qué líneas cambiarán.
3. **Verificar:** Confirma que el cambio no afecta la lógica `isAdmin` vs `isStudent`.
4. **Ejecutar:** Aplica el código.