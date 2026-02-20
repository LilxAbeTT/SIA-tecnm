# SIA System Map & Security Schema

## 1. Estructura de Usuarios (/usuarios/{uid})
- **Campos Críticos:** `role`, `especialidad` o `specialty` (para Psicólogos), `permissions` (objeto para Lactario).
- **Subcolección: `notificaciones`**
  - Creada por: Salud, Biblio, LactarioAdmin, SuperAdmin.
  - Leída por: Dueño del perfil.

## 2. Módulo Médico / Salud (isSalud)
- **Colecciones:** `citas-medi`, `medi-slots`, `medi-config`.
- **Expedientes:** `/expedientes-clinicos/{uid}`
  - **Subcolección:** `consultas` (Solo accesible por Salud/SuperAdmin).
  - **Campo:** `visiblePaciente` (Boolean) controla si el estudiante puede leer su propio expediente.

## 3. Módulo Biblioteca (isBiblio)
- **Colecciones:** `biblio-catalogo`, `biblio-solicitudes`, `prestamos-biblio`, `biblio-reservas`, `biblio-visitas`.
- **Lógica de Bloqueo:** Solo el personal de Biblio puede crear libros o registrar visitas físicas.

## 4. Módulo Lactario (isLactarioAdmin)
- **Colecciones:** `lactario-bookings`, `lactario-spaces`, `lactario_fridges`, `lactario-config`.
- **Permiso:** Requiere `role: 'department_admin'` Y `permissions.lactario: 'admin'`.

## 5. Módulo Aula (isAula)
- **Colecciones:** `aula-cursos`, `aula-inscripciones`, `aula-progress`, `aula-intentos`.
- **Jerarquía:** `/aula-cursos/{id}/lessons` y `/aula-cursos/{id}/quizzes`.