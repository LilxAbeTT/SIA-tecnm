---
description: Crear o modificar un Servicio de Firebase v9 Modular
---
# Workflow para la persistencia e interacción con Firebase

Cuando debas crear funciones lógicas que se conecten a la base de datos (Firestore, Authentication, Storage), sigue estos pasos:

1. **Ubicación Requerida:** Todo servicio se coloca dentro de `public/services/<nombre>-service.js`.
2. **Importaciones Funcionales:** Utiliza el SDK v9 Modular estrictamente. 
   - `import { doc, getDoc, collection, setDoc, updateDoc } from "firebase/firestore";`
   - Asegúrate de importar la instancia de DB `import { db } from '../config/firebase.js';` (o desde la ruta correcta de configuración).
3. **Manejo Inteligente de Errores Catch-Thru:**
   - Envuelve TODA llamada a base de datos en un bloque `try/catch`.
   - Lanza el error capturado o maneja el estado retornando un formato estándar: `{ success: true, data: resultado }` o `{ success: false, error: e.message }`.
4. **Optimizaciones de Consultas (Performance):**
   - Usa `limit()` para listas paginadas innecesarias.
   - Usa `where()` para reducir el volumen de descarga.
   - Piensa siempre en la regla de "Menor consumo de Queries" establecida en The Golden Rules de SIA.
5. **Documentación:** Agrega comentarios describiendo los índices o inputs requeridos.
