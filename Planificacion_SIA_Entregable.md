# Planificación del Proyecto Integrador: Sistema de Integración Académico (SIA)

**Institución:** Tecnológico Nacional de México (TecNM)
**Proyecto:** Sistema de Integración Académico (SIA-tecnm)

---

## 1. Objetivo del Proyecto

Desarrollar e implementar un **Sistema de Integración Académico (SIA)** centralizado para la comunidad del Tecnológico Nacional de México. El objetivo principal es unificar la gestión y el acceso a los servicios académicos y extracurriculares del campus (tales como Biblioteca, Servicio Médico, Aula Virtual, Comunidad, Eventos, Cafetería, Avisos y Reportes) a través de una Single Page Application (SPA) moderna, rápida y escalable. Esta solución busca optimizar los procesos administrativos, mejorar la comunicación institucional y brindar una experiencia de usuario integral a estudiantes y personal.

---

## 2. Estimación de Tiempos (Cronograma)

El proyecto se planifica para una duración total de **6 meses** (24 semanas), utilizando una metodología de desarrollo iterativa e incremental:

*   **Fase 1: Planeación y Arquitectura Base (Semanas 1 - 4)**
    *   Levantamiento detallado de requerimientos y diseño UI/UX.
    *   Configuración de la infraestructura Serverless en Firebase.
    *   Desarrollo de la Arquitectura Core de la SPA (Enrutador, Manejo de Estado Global, UiManager).
*   **Fase 2: Autenticación y Módulos Transversales (Semanas 5 - 8)**
    *   Integración de Firebase Auth, gestión de perfiles de usuario y sistema de roles (SuperAdmin, Admin, Estudiante).
    *   Desarrollo de la navegación, notificaciones push globales y breadcrumbs.
*   **Fase 3: Desarrollo de Módulos Core (Semanas 9 - 16)**
    *   Implementación de módulos críticos: Biblioteca, Servicio Médico y Aula.
    *   Desarrollo de los Web Components nativos y controladores lógicos.
*   **Fase 4: Módulos Secundarios y Cloud Functions (Semanas 17 - 20)**
    *   Desarrollo de módulos: Comunidad, Foro/Eventos, Cafetería y Encuestas.
    *   Implementación de lógica de backend con Firebase Cloud Functions (Triggers, tareas programadas).
*   **Fase 5: QA, Pruebas y Despliegue (Semanas 21 - 24)**
    *   Pruebas de integración, validación de reglas de seguridad de Firestore y optimización de carga (Lazy Loading, Caché).
    *   Capacitación al personal administrativo.
    *   Despliegue final en producción.

---

## 3. Estimación de Personal (Roles del Equipo)

Para la ejecución exitosa del proyecto, se requiere un equipo multidisciplinario enfocado en tecnologías web modernas y arquitecturas en la nube:

1.  **Líder de Proyecto (Project Manager) / Scrum Master (1):** Encargado de la planificación, seguimiento de tareas, control de riesgos y comunicación con las autoridades del TecNM.
2.  **Desarrolladores Frontend (2):** Especialistas en Vanilla JavaScript, CSS modular y Web Components nativos. Responsables de construir la SPA, el Core Router, y las interfaces gráficas de todos los módulos.
3.  **Desarrollador Backend / Firebase Engineer (1):** Responsable de la configuración de Firebase (Firestore, Auth, Storage), diseño de la base de datos NoSQL, desarrollo de Cloud Functions (Node 20) y establecimiento de las Reglas de Seguridad.
4.  **Ingeniero de QA / Analista de Seguridad (1):** Encargado de realizar pruebas funcionales, evaluar el rendimiento y garantizar que no existan fugas de datos sensibles (especialmente en expedientes médicos y registros de la biblioteca).

---

## 4. Estimación de Costos

*Nota: Cifras estimadas en Pesos Mexicanos (MXN) para el periodo de desarrollo de 6 meses.*

**Costos de Recursos Humanos:**
*   Project Manager: $120,000.00
*   Desarrolladores Frontend (2): $200,000.00
*   Desarrollador Backend: $110,000.00
*   QA / Analista de Seguridad: $90,000.00
*   *Subtotal RR.HH.: $520,000.00*

**Costos de Infraestructura y Herramientas:**
*   Infraestructura Firebase (Plan Blaze - Costo inicial estimado por 6 meses): $5,000.00
*   Registro de Dominio y Certificados SSL: $1,500.00
*   Licencias de Software (IDEs, Herramientas de Diseño UI/UX, Gestión de Proyecto): $10,000.00
*   *Subtotal Infraestructura: $16,500.00*

**Reserva para Contingencias (10%):** $53,650.00

**Costo Total Estimado del Proyecto:** **$590,150.00 MXN**

---

## 5. Análisis de Riesgos

| Riesgo | Probabilidad | Impacto | Estrategia de Mitigación |
| :--- | :---: | :---: | :--- |
| **Saturación y Costos de BD:** Exceso de lecturas en Firestore que disparen los costos debido a malas prácticas en consultas. | Media | Alto | Implementar flujos de trabajo de optimización estricta (caché local intensivo, lazy loading) y paginación obligatoria. |
| **Vulnerabilidad de Datos Sensibles:** Accesos no autorizados a expedientes del Servicio Médico o información personal de estudiantes. | Baja | Crítico | Validación estricta de Roles (`canAccessView`, `canAdmin*`) e implementación exhaustiva de Firebase Security Rules en Firestore y Storage. |
| **Resistencia al Cambio:** Rechazo por parte del personal administrativo para adoptar la nueva plataforma frente a los sistemas antiguos. | Alta | Medio | Involucrar a usuarios clave desde las fases de diseño, proveer documentación clara, manuales interactivos y periodos de prueba piloto con acompañamiento. |
| **Retraso por Complejidad de Código:** Archivos de módulos que crecen demasiado ("módulos gigantes") volviéndose inmanejables. | Media | Medio | Aplicar patrones de diseño modulares (Web Components) y ejecutar refactorizaciones controladas en submódulos seguros de forma preventiva. |

---

## 6. Evaluación de Viabilidad

1.  **Viabilidad Técnica (Alta):** El proyecto emplea una arquitectura moderna, "Serverless" y basada en una SPA fluida con componentes nativos y Firebase. Esto elimina la necesidad de mantener y configurar servidores físicos complejos, permitiendo una escalabilidad inmediata. El equipo técnico tiene documentadas directrices claras sobre qué modificar y dónde (arquitectura bien fundamentada).
2.  **Viabilidad Económica (Alta):** Al utilizar un esquema backend de pago por uso (Firebase) y tecnologías web estándar abiertas (sin pago de licencias de frameworks monolíticos privados), se reducen drásticamente los costos operativos iniciales de infraestructura. El presupuesto está enfocado eficientemente en el talento humano.
3.  **Viabilidad Operativa (Alta):** La integración y centralización de Aula, Comunidad, Biblioteca, Foros y Servicios Médicos bajo un mismo ecosistema (SIA) resuelve un problema evidente de fragmentación de sistemas en el TecNM. Eliminará burocracia, sistemas aislados obsoletos y mejorará los flujos institucionales, justificando completamente el desarrollo del proyecto.
