name: Firebase SIA Rules
description: Reglas de rendimiento y seguridad al usar Firebase en SIA
---
# Habilidades de Firebase para SIA

Como agente, cuando interactúes con Firebase en el proyecto SIA, debes seguir estas reglas vitales:

1. **Eficiencia por Defecto (Regla de Oro):** Cada Query a Firestore cuesta dinero y tiempo. Nunca traigas toda una colección si solo necesitas un documento específico. Diseña consultas atómicas.
2. **Modular v9:** Nunca uses la sintaxis encadenada. Todo se hace mediante imports funcionales: `import { collection, query, where, getDocs } from "firebase/firestore";`.
3. **Seguridad (MCP):** Antes de proponer una regla de seguridad o asumir que un dato se puede escribir de una forma, utiliza el servidor `firebase-mcp-server` para validar las reglas de Firestore actuales o revisar el esquema de base de datos.
4. **Separation of Concerns:** Los módulos de UI (ej. `modules/biblioteca.js`) **NUNCA** hacen queries a `firestore` mediante import directo. Deben llamar a funciones ubicadas siempre en `services/<modulo>-service.js`.
