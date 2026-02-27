# Guía de Optimización y Configuración de Antigravity Gemini 3.1 para SIA

Este documento explica la arquitectura implementada en el proyecto **SIA-tecnm** para garantizar que los agentes de **Antigravity** trabajen de forma autónoma, paralela, segura y altamente contextualizada.

## 1. Arquitectura de Directorios para Agentes (`.agents/`)

Para que el proyecto sea escalable y permita múltiples sesiones de agentes trabajando en paralelo sin pisarse el código, hemos implementado el estándar de Antigravity utilizando la carpeta `.agents/` en la raíz del proyecto.

### A. Workflows (`.agents/workflows/`)
Los **Workflows** son pasos bien definidos para que los agentes ejecuten tareas repetitivas o críticas siguiendo siempre el mismo estándar del proyecto.
1. `crear_modulo_sia.md`: Instruye al agente exactamente cómo estructurar un nuevo módulo en `public/modules/`.
2. `crear_servicio_firebase.md`: Obliga al agente a usar el estándar **Firebase v9 Modular** en `public/services/`.
3. `crear_web_component.md`: Define el paso a paso para crear un UI Component usando Web Components nativos en `public/components/`.

**¿Para qué sirve?**
Si tú le pides a un agente en una pestaña: *"Crea el módulo de inventario"*, el agente detectará el workflow y lo hará perfecto. Simultáneamente, en otra pestaña puedes pedir a otro agente: *"Crea un servicio de Firebase para notificaciones"*, y este usará su respectivo workflow sin afectar al primer agente.

### B. Skills (`.agents/skills/`)
Las **Skills** son habilidades especializadas que le otorgan contexto técnico avanzado al agente al momento de codificar, ayudando a que no cometa errores básicos y respete las reglas del proyecto.
1. `firebase_sia/SKILL.md`: Reglas de oro sobre Firebase (Sanitización, queries optimizadas, no usar db al nivel del front directamente).
2. `web_components_sia/SKILL.md`: Directrices sobre cómo el proyecto maneja el Shadow DOM o el DOM regular dentro de CustomElements.
3. `core_rules_sia/SKILL.md`: Contexto del proyecto y reglas generales, importadas de `context.md` y `skills.md`.

## 2. Reglas de Oro para Trabajo en Múltiples Sesiones (Paralelismo)

Cuando interactúas con múltiples ventanas/agentes al mismo tiempo, el riesgo de conflictos de GIT o sobreescritura de archivos (`Merge Conflicts`) aumenta. Sigue estas reglas:

- **Aislamiento Funcional (Separation of Concerns):** Nunca asignes a dos agentes modificar el mismo componente de UI o el mismo archivo de servicio simultáneamente. Asigna un agente al Back-end (ej. `public/services/`) y otro al Front-end (ej. `public/modules/`).
- **Peticiones Estructuradas:** Empieza el prompt para el agente haciendo referencia al workflow o skill. Ej: `Usa el workflow crear_modulo_sia para iniciar el sistema de reportes`.
- **Revisiones por Paquetes:** Pídele a los agentes que te avisen (vía `notify_user`) cada vez que acaben un archivo clave para que tú revises, asegurando que sus "Task Boundaries" correspondan a tareas atómicas.

## 3. Beneficios de esta Implementación

1. **Automatización Integral:** Todo agente nuevo que se una a tu entorno leerá los workflows y skills inmediatamente. ¡No tienes que explicarle cómo funciona SIA desde cero cada vez!
2. **Homogeneidad del Código:** Todos los agentes programarán con el mismo estilo (Vanilla JS, Web Components, Firebase Modular v9), asegurando mantenibilidad.
3. **Escalabilidad:** Si en el futuro añades un framework como React o cambias Firebase por Supabase, solo tienes que añadir un archivo `.md` en `.agents/skills` o `.agents/workflows`, y todos los agentes adaptarán su comportamiento al instante.

¡El entorno está listo para potenciar el desarrollo simultáneo con Antigravity!
