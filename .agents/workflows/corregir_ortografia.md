---
description: Corregir ortografía, mojibake y problemas de codificación UTF-8 en textos visibles del proyecto
---
# Workflow: Corrección Ortográfica y de Codificación

Usa este flujo cuando aparezcan acentos rotos, `ñ` corruptas, signos raros como `Ã`, `Â`, `â`, `ï¿½`, `�`, o textos visibles sin acentos.

## Objetivo

Corregir textos visibles para el usuario sin romper lógica, claves internas, comparaciones de roles, nombres de propiedades ni valores persistidos en base de datos.

## 1. Diagnostica antes de reemplazar

No asumas que todo es "ortografía". Primero identifica el tipo de problema:

1. **Mojibake por doble codificación**
   - Ejemplos: `MÃ©dico`, `ConfiguraciÃ³n`, `PsicologÃ­a`.
   - Suele indicar UTF-8 leído como Windows-1252/Latin-1 y guardado otra vez.

2. **Archivo guardado en otro encoding**
   - El navegador muestra `�`, `?` o símbolos raros aunque el texto "antes estaba bien".
   - Revisa bytes crudos si hace falta.

3. **Pérdida real de caracteres**
   - Si ya existe `�` o `?` dentro de palabras (`Integraci?n`, `est?`, `M?dico`), el carácter original pudo perderse.
   - En ese caso usa contexto, historial git o textos equivalentes del proyecto para restaurarlo.

4. **Ortografía real**
   - Ejemplos: `Medico`, `Tecnico`, `Configuracion`, `modulos`, `proxima`.
   - Aquí no hay corrupción de encoding; solo falta corrección lingüística.

## 2. Confirma el encoding real del archivo

Antes de editar, valida el archivo con al menos dos métodos:

- Lee el contenido normal.
- Busca patrones sospechosos con `rg`, por ejemplo:
  - `rg -n "Ã|Â|â|ðŸ|ï¿½|�" public .agents`
- Si hay duda, inspecciona bytes con `Format-Hex`.

Regla importante:

- Si `Get-Content` se ve mal pero `Format-Hex` muestra UTF-8 correcto, el problema puede ser solo de la consola.
- Si `rg` encuentra mojibake real dentro del archivo fuente, sí hay que corregir el archivo.

## 3. Define el alcance real

No revises solo el archivo activo. Escanea todos los textos visibles relacionados:

- HTML estático
- `innerHTML`
- `textContent`
- template literals
- placeholders
- labels
- toasts
- alerts
- modals
- títulos
- botones
- opciones de `select`
- mensajes de estado

Prioriza estas rutas:

- `public/**/*.html`
- `public/**/*.js`
- `public/components/**/*.js`
- `public/modules/**/*.js`
- `public/services/**/*.js`
- `*.md` si ese texto también se usa como guía operativa

## 4. Corrige de la forma menos riesgosa

### Si el archivo completo está doble-codificado

- Aplica una reparación controlada del archivo completo.
- Solo hazlo si después de la conversión baja claramente la cantidad de patrones sospechosos.
- Revisa el resultado antes de guardar.

### Si solo hay unas cuantas cadenas rotas

- Haz reemplazos puntuales.
- Corrige solo textos visibles o comentarios operativos si forman parte del workflow.

### Si hay `?` o `�` dentro de palabras

- No adivines a ciegas.
- Busca la misma frase en:
  - `git show HEAD:<archivo>`
  - otros módulos
  - etiquetas equivalentes
  - commits anteriores

## 5. No rompas la lógica

Antes de cambiar una palabra con acento, verifica si ese texto es:

- una etiqueta visible para el usuario
- un valor persistido en Firestore
- una clave de configuración
- un `role`
- un `id`
- un nombre de propiedad
- parte de una comparación estricta

Regla:

- Corrige libremente lo visible.
- Cambia valores internos solo si confirmas que todo el sistema usa la misma forma.

Ejemplos:

- Visible: `Servicio Medico` -> `Servicio Médico`
- Visible: `Configuracion manual` -> `Configuración manual`
- Visible: `Psicologia` -> `Psicología`
- Interno: `psicologo`, `medico`, `view-medi`, `tipoServicio` solo se cambian si está validado en toda la app

## 6. Revisión ortográfica mínima obligatoria

Después de corregir el encoding, revisa ortografía real:

- acentos: `médico`, `configuración`, `próxima`, `técnico`
- `ñ`: `sección`, `diseño`, `contraseña`
- signos de apertura: `¿` y `¡`
- mayúsculas con acento: `MÉDICO`, `CONFIGURACIÓN`
- palabras frecuentes del proyecto:
  - `matrícula`
  - `catálogo`
  - `préstamo`
  - `diagnóstico`
  - `psicológica`
  - `módulos`
  - `sesión`
  - `conexión`

## 7. Verificación final

Al terminar:

1. Vuelve a buscar mojibake:
   - `rg -n "Ã|Â|â|ðŸ|ï¿½|�" public .agents`
2. Busca restos de caracteres perdidos en textos visibles:
   - palabras con `?` dentro
   - signos raros en labels, placeholders, botones y modales
3. Confirma que no rompiste template literals, comillas o HTML.
4. Si corregiste roles o strings compartidos, revisa comparaciones y filtros relacionados.

## 8. Entregable esperado

La revisión debe cerrar con:

- causa raíz detectada
- archivos corregidos
- ejemplos de textos reparados
- verificación ejecutada
- riesgos residuales si quedó algún caso ambiguo
