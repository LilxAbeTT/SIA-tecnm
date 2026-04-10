---
description: Analizar una necesidad general o especifica de SIA, recomendar el mejor enfoque y ejecutar lo acordado
---
# Workflow: Asesor Pre-Desarrollo SIA (`/asesor_pre_desarrollo_sia`)

## Objetivo

Este workflow existe para los casos en los que el usuario aun no quiere "tirar codigo" de inmediato, sino primero entender que conviene hacer y despues ejecutar lo aprobado.

Debe servir tanto para:
- acomodo de `divs`, layout, UX y componentes
- logica de registro, formularios y wizards
- estructura de modulos, refactors y cableado con router
- servicios, consultas Firebase, seguridad, estado y rendimiento

Si el usuario solo pide recomendaciones, primero analiza y recomienda.
Si el usuario pide recomendaciones y tambien autoriza aplicar la mejor opcion, recomienda y luego ejecuta.
Si el usuario aprueba una opcion despues del analisis, ejecuta exactamente esa opcion o combinacion aprobada.

---

## Uso

Ejemplos de invocacion:

- `@asesor_pre_desarrollo_sia Dame recomendaciones para acomodar mejor los divs de admin medi`
- `@asesor_pre_desarrollo_sia Revisa el flujo de registro y dime que conviene mejorar antes de tocar codigo`
- `@asesor_pre_desarrollo_sia Analiza el modulo de biblioteca y propon lo mejor para el siguiente sprint`
- `@asesor_pre_desarrollo_sia Revisa medi admin, recomiendame el mejor enfoque y aplica la opcion de menor riesgo`
- `@asesor_pre_desarrollo_sia Quiero mejorar un modulo pero no se si conviene refactor, componente nuevo o solo ajuste de UI`

---

## FASE 0: Contexto Minimo Obligatorio

Antes de recomendar o editar cualquier cosa:

1. Lee `.agents/project-map.md`.
2. Ubica el alcance real del pedido:
   - sistema en general
   - modulo completo
   - submodulo
   - flujo puntual
   - archivo concreto
3. Identifica el patron arquitectonico del alcance:
   - modulo global tipo `window.Modulo = (function(){ ... })()`
   - submodulo tipo `window.AdminMedi.Ui`, `window.AdminMedi.Agenda`, etc.
   - singleton global como `window.SIA_Register`
   - Web Component en `public/components/`
4. Identifica desde donde se carga o se invoca:
   - `public/core/router.js`
   - `public/app.js`
   - `public/index.html`
   - `onclick=""`, `onchange=""`, listeners, `customElements`

No des recomendaciones basadas en un solo archivo si el flujo depende de varios puntos de entrada.

---

## FASE 1: Clasificacion del Problema

Clasifica el pedido antes de proponer cambios. Puede caer en una o varias categorias:

1. `layout-ui`
   - acomodo de `divs`
   - distribucion de columnas
   - responsividad
   - jerarquia visual
   - tabs, modales, cards, shells

2. `ux-flujo`
   - pasos de wizard
   - orden de pantallas
   - feedback visual
   - loaders, validaciones, mensajes

3. `logica-modulo`
   - funciones demasiado grandes
   - estado compartido confuso
   - listeners fragiles
   - exportaciones faltantes

4. `datos-servicio`
   - consultas Firebase
   - servicios inexistentes o saturados
   - logica de negocio mezclada con UI

5. `seguridad-acceso`
   - roles
   - `allowedViews`
   - datos sensibles
   - reglas de escritura/lectura

6. `performance`
   - lecturas excesivas
   - render duplicado
   - listeners zombie
   - consultas N+1

7. `refactor-arquitectura`
   - modulo gigante
   - codigo duplicado
   - piezas que deben separarse en submodulos o componentes

8. `bug-correccion`
   - fallo reproducible
   - boton roto
   - flujo incompleto

---

## FASE 2: Lectura Tecnica Segun el Tipo de Pedido

### Si el problema es de layout o UI

Debes revisar como minimo:
- el archivo que renderiza el HTML o template
- el CSS relacionado en `public/styles.css` o `public/styles/`
- el contenedor real en `index.html` o el Web Component relacionado
- la forma en que se activan tabs, modales, botones y eventos
- el comportamiento mobile y desktop

Debes privilegiar el patron del proyecto:
- Bootstrap 5 primero
- HTML sanitizado si hay datos dinamicos
- no mover markup sin revisar listeners, `id`s y `data-*`

### Si el problema es de logica, registro o wizard

Debes revisar como minimo:
- modulo principal del flujo
- componente visual si existe
- `app.js` y/o `router.js` si participan en la entrada
- exportaciones globales usadas desde `index.html`
- validaciones de formularios, pasos, estado y submit final

Para registro en SIA, no asumas que es un modulo de router tradicional:
- revisar `public/modules/register.js`
- revisar `public/components/register-wizard.js`
- revisar `public/app.js`
- revisar `public/index.html`

### Si el problema toca Firebase, seguridad o rendimiento

Debes revisar como minimo:
- modulo o componente que dispara la accion
- servicio asociado en `public/services/`
- `firestore.rules` o `storage.rules` si el cambio toca permisos
- si hay consultas directas a DB desde UI, marcarlas como deuda o corregirlas

---

## FASE 3: Diagnostico Antes de Recomendar

Antes de proponer una solucion, debes construir un diagnostico corto y concreto que incluya:

1. Estado actual:
   - como funciona hoy
   - que archivos estan involucrados
   - que limitaciones tecnicas tiene

2. Hallazgos:
   - que esta desordenado
   - que esta duplicado
   - que esta acoplado de mas
   - que riesgo tiene romperse

3. Restricciones:
   - router
   - globals `window.*`
   - `onclick` inline
   - dependencia de Bootstrap
   - dependencia de servicios
   - reglas de seguridad

4. Riesgo de implementacion:
   - bajo
   - medio
   - alto

No pases a editar codigo sin haber aterrizado el problema en terminos de archivos, flujo y riesgo.

---

## FASE 4: Recomendaciones Priorizadas

Si el usuario pide recomendaciones, debes responder con opciones concretas, no con consejos vagos.

### Regla de cantidad

- Si el pedido es general o de "ideas de mejora", entregar minimo 5 recomendaciones realistas.
- Si el pedido es especifico sobre una sola area, entregar minimo 3 opciones concretas.

### Formato minimo de cada recomendacion

Cada opcion debe incluir:
- que se haria
- por que conviene
- archivos o capas afectadas
- impacto esperado
- costo/riesgo aproximado

### Regla de cierre

Siempre debes marcar una `Opcion recomendada` con razon tecnica clara.

No te limites a "hazlo mas bonito" o "refactoriza".
Debes aterrizar el consejo a la arquitectura real de SIA.

Ejemplos validos de recomendacion:
- mover un bloque de layout a un submodulo UI sin tocar logica de agenda
- crear un Web Component para una tarjeta repetida
- extraer validaciones de registro a helpers puros
- mover una consulta directa desde UI a `services/`
- dividir una funcion gigante antes de cambiar el comportamiento

---

## FASE 5: Acuerdo Antes de Implementar

Si el usuario solo pidio analisis o recomendaciones, NO modifiques codigo aun.

Debes cerrar esa respuesta con una invitacion explicita a elegir:
- una opcion
- varias opciones
- o autorizar la recomendada

Si el usuario dice algo equivalente a:
- "aplica la mejor opcion"
- "haz lo recomendado"
- "ejecuta la opcion 2"
- "mezcla la 1 y la 3"

entonces ya puedes pasar a implementacion.

Si desde el inicio el usuario pide recomendaciones y ejecucion en la misma solicitud, analiza, recomienda brevemente y ejecuta la opcion recomendada de menor riesgo o la que el usuario haya indicado.

---

## FASE 6: Ejecucion Guiada por el Tipo de Cambio

Una vez aprobado el enfoque, ejecuta el trabajo usando el workflow especializado que mejor corresponda:

1. `crear_modulo_sia.md`
   - si se crea o modifica un modulo o submodulo

2. `crear_web_component.md`
   - si conviene encapsular UI repetida o altamente visual

3. `crear_servicio_firebase.md`
   - si hace falta crear o mover logica a `public/services/`

4. `optimizar_firebase_queries.md`
   - si el problema es consumo, carga masiva o N+1

5. `refactorizar_modulo_gigante.md`
   - si el archivo ya no es mantenible y el cambio seria riesgoso sin split previo

6. `solucionar_bug_sia.md`
   - si el caso ya es un fallo puntual y reproducible

Si ningun workflow cubre exactamente el cambio, aplica este workflow como orquestador y combina las reglas utiles de los workflows existentes.

---

## FASE 7: Reglas Especificas de SIA

1. Antes de tocar `admin medi`, revisar el orquestador `public/modules/admin.medi.js` y su mapeo a:
   - `public/modules/admin-medi/ui.js`
   - `public/modules/admin-medi/agenda.js`
   - `public/modules/admin-medi/chat.js`
   - `public/modules/admin-medi/consultas.js`
   - `public/modules/admin-medi/tools.js`

2. Antes de tocar registro, revisar siempre:
   - `public/modules/register.js`
   - `public/components/register-wizard.js`
   - `public/app.js`
   - `public/index.html`

3. Si el cambio es de layout:
   - revisar clases Bootstrap existentes antes de inventar CSS nuevo
   - no romper `id`s usados por listeners o `querySelector`
   - no romper botones con `onclick`

4. Si el cambio es de logica:
   - no dejar consultas Firestore directas en modulos de UI si pueden vivir en servicios
   - mantener validacion de rol y acceso de punta a punta
   - agregar estados de carga o guardado si la accion es asincrona

5. Si el cambio afecta datos dinamicos:
   - sanitizar HTML
   - validar entradas
   - no exponer funciones publicas innecesarias en `window`

6. Si el cambio toca router o carga:
   - verificar orden de scripts
   - verificar nombres globales exportados
   - verificar que `init(...)` o el metodo publico siga siendo invocable

---

## FASE 8: Verificacion Obligatoria

Despues de implementar, verifica como minimo:

1. que el flujo siga cargando desde su punto de entrada real
2. que las exportaciones publicas no se hayan roto
3. que los `onclick`, listeners y `id`s sigan apuntando a algo valido
4. que el layout siga funcionando en el contexto real del modulo
5. que las llamadas async tengan feedback y manejo de error
6. que no se hayan agregado lecturas Firebase innecesarias
7. que no se haya movido logica sensible a la UI sin validacion

Si no puedes verificar algo, debes decirlo explicitamente en el reporte final.

---

## Formato de Respuesta Esperado

Cuando el usuario lo invoque, la salida debe seguir esta secuencia:

1. `Diagnostico actual`
2. `Opciones recomendadas`
3. `Opcion recomendada`
4. `Si el usuario aprueba: implementacion`
5. `Verificacion y riesgos pendientes`

---

## Regla Final

Este workflow no es solo consultivo.
Su responsabilidad completa es:

1. entender el problema
2. recomendar con criterio tecnico
3. aterrizar el alcance en archivos reales
4. ejecutar lo acordado sin improvisar
5. verificar que el resultado no rompa la arquitectura de SIA
