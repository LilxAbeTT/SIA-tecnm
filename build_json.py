import json
import re

text = """
⭐  Bloque I: Intereses y Preferencias
Lo que te gusta hacer en tu día a día
Califica del 1 al 5, donde 1 es "Nada de acuerdo" y 5 es "Totalmente de acuerdo".
[B1_01] ¿Te ves organizando y dirigiendo equipos de trabajo para alcanzar metas en una empresa?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IA: +1  |  CP: +0.5
[B1_02] ¿Disfrutas experimentando con ingredientes para crear combinaciones de sabores únicas?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → GAS: +1
[B1_03] ¿Te resulta sencillo organizar información en tablas, bases de datos o reportes?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → CP: +1  |  IA: +0.5  |  ISC: +0.5
[B1_04] ¿Sientes emoción cuando ves una construcción grande o un puente y te preguntas cómo fue posible hacerlo?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IC: +1  |  ARQ: +0.5
[B1_05] ¿Disfrutas planear viajes, conocer nuevos lugares y aprender sobre otras culturas?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → TUR: +1
[B1_06] ¿Te gusta reparar o armar aparatos electrónicos, máquinas o instalaciones?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IEM: +1  |  ISC: +0.5
[B1_07] ¿Disfrutas dibujar, diseñar espacios o imaginar cómo se vería un lugar si lo rediseñaras?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → ARQ: +1  |  IC: +0.3
[B1_08] ¿Te atrae la idea de crear programas, páginas web o aplicaciones desde cero?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → ISC: +1
[B1_09] ¿Te gusta atender a personas, hacer que se sientan bien recibidas y resolver sus necesidades?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → TUR: +0.8  |  GAS: +0.5
[B1_10] ¿Disfrutas analizar estados financieros, facturas o el flujo de dinero de un negocio?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → CP: +1  |  IA: +0.5
[B1_11] ¿Te imaginas viviendo en otra ciudad o país por motivos de trabajo?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → TUR: +0.5  |  GAS: +0.3
[B1_12] ¿Cuando algo mecánico o eléctrico falla a tu alrededor, sientes impulso de investigar qué pasó?
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IEM: +1

🧠  Bloque II: Habilidades y Aptitudes
Lo que se te da bien hacer
Califica del 1 al 5 qué tan de acuerdo estás con cada afirmación sobre tus capacidades.
[B2_01] Se me facilita resolver operaciones matemáticas complejas sin necesitar demasiada ayuda.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IC: +1  |  ISC: +0.8  |  CP: +0.8  |  IEM: +0.8  |  IA: +0.5
[B2_02] Puedo imaginar con facilidad cómo se vería un objeto o espacio en 3D si lo giro mentalmente.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → ARQ: +1  |  IC: +0.8  |  IEM: +0.5
[B2_03] Se me da bien redactar, convencer a otros con argumentos y comunicarme con claridad.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → TUR: +0.8  |  IA: +0.5  |  GAS: +0.3
[B2_04] Llevo un buen registro de mis gastos personales y sé administrar el dinero que tengo.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → CP: +1  |  IA: +0.8
[B2_05] Aprendo a usar programas y aplicaciones de computadora de manera rápida y casi sin instrucciones.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → ISC: +1  |  IA: +0.3
[B2_06] Soy capaz de seguir y entender planos, instrucciones técnicas o diagramas complejos.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IC: +1  |  IEM: +0.8  |  ARQ: +0.8
[B2_07] Cuando detecto un error en un proceso, documento o proyecto, propongo soluciones concretas.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IA: +0.8  |  CP: +0.5  |  ISC: +0.5
[B2_08] Tengo facilidad para trabajar en cocina: medir, combinar ingredientes y controlar tiempos de cocción.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → GAS: +1
[B2_09] Sé liderar un equipo: asigno tareas, motivo al grupo y resuelvo conflictos entre personas.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IA: +1  |  TUR: +0.5
[B2_10] Me siento cómodo/a comunicándome en inglés (hablando, leyendo o escribiendo).
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → TUR: +1  |  ISC: +0.3

🎯  Bloque III: Situaciones y Decisiones
¿Cómo reaccionas en distintos contextos?
Elige la opción (A, B, C o D) que mejor describe lo que harías o sentirías.
[B3_01] Tienes que organizar un evento para 100 personas. ¿Cuál tarea elegirías?
Opc.
Texto de la opción
Puntaje asignado
A
Diseñar la decoración y la ambientación del lugar
ARQ: +1
B
Coordinar al equipo de trabajo y el presupuesto
IA: +1
C
Diseñar y preparar el menú de comida y bebidas
GAS: +1
D
Atender a los asistentes y garantizar su satisfacción
TUR: +1
[B3_02] Si pudieras trabajar en una de estas empresas de Los Cabos, ¿cuál elegirías?
Opc.
Texto de la opción
Puntaje asignado
A
Una empresa constructora de hoteles y desarrollos turísticos
IC: +1
B
Un despacho contable o de consultoría financiera
CP: +1
C
Un restaurante gourmet o una cadena de hoteles de lujo
GAS: +0.5  |  TUR: +0.5
D
Una empresa de tecnología o de automatización industrial
ISC: +0.5  |  IEM: +0.5
[B3_03] Alguien te pide consejo porque quiere abrir un pequeño negocio. ¿Qué harías primero?
Opc.
Texto de la opción
Puntaje asignado
A
Diseñar cómo se vería el local y la identidad visual del negocio
ARQ: +0.8
B
Hacer un análisis de costos, ingresos y punto de equilibrio
CP: +1  |  IA: +0.5
C
Crear una página web o sistema de ventas en línea
ISC: +1
D
Estudiar al cliente y diseñar la experiencia del servicio
TUR: +0.8  |  IA: +0.3
[B3_04] Estás en una clase difícil. ¿Qué estrategia usas para aprender?
Opc.
Texto de la opción
Puntaje asignado
A
Hago esquemas, dibujos o mapas mentales visuales
ARQ: +0.5  |  IC: +0.3
B
Practico con ejercicios y resuelvo problemas reales
ISC: +0.5  |  IEM: +0.5  |  IC: +0.5
C
Leo, subrayo y hago resúmenes detallados
CP: +0.3  |  TUR: +0.3
D
Busco videos, tutoriales o se lo pido a alguien que ya lo entiende
GAS: +0.3
[B3_05] Tu sueño sería trabajar en un proyecto que...
Opc.
Texto de la opción
Puntaje asignado
A
Deje una obra visible: un edificio, un puente o un parque urbano
IC: +1  |  ARQ: +0.8
B
Ayude a que una empresa sea más eficiente y rentable
IA: +1  |  CP: +0.5
C
Lleve tecnología o automatización a empresas que lo necesitan
ISC: +0.8  |  IEM: +0.8
D
Cree experiencias únicas para turistas nacionales e internacionales
TUR: +1
[B3_06] ¿Cuál de estas materias de preparatoria te gustó más o te resultó más fácil?
Opc.
Texto de la opción
Puntaje asignado
A
Matemáticas y Física
IC: +0.8  |  ISC: +0.8  |  IEM: +0.8
B
Contabilidad, Economía o Administración
CP: +1  |  IA: +0.8
C
Inglés, Historia o Geografía
TUR: +0.8
D
Arte, Dibujo técnico o Talleres prácticos
ARQ: +1  |  GAS: +0.5
[B3_07] ¿Cuál de estas frases describe mejor cómo te ves en 5 años?
Opc.
Texto de la opción
Puntaje asignado
A
Dirigiendo una obra de construcción o diseñando un edificio
IC: +1  |  ARQ: +0.8
B
Gestionando la contabilidad o las finanzas de una empresa
CP: +1
C
Desarrollando software o administrando sistemas en una empresa
ISC: +1
D
Dirigiendo el comedor o la cocina de un hotel cinco estrellas
GAS: +1
[B3_08] ¿En qué tipo de entorno de trabajo te sentirías más cómodo/a?
Opc.
Texto de la opción
Puntaje asignado
A
Al aire libre, en obra o en instalaciones industriales
IC: +0.8  |  IEM: +0.8
B
En una oficina frente a una computadora
ISC: +0.8  |  CP: +0.5
C
En cocinas, restaurantes, hoteles o centros turísticos
GAS: +0.8  |  TUR: +0.5
D
En cualquier lugar: viajando, reuniéndome con clientes, cambiando de escenario
TUR: +0.8  |  IA: +0.3

⚙️  Bloque IV: Adaptativo — Carrera Técnica
Preguntas especiales basadas en tu formación técnica
Estas preguntas se adaptan según la carrera técnica que indicaste en tu registro.

⚙ Lógica: Bloque completo — solo si el aspirante declaró carrera técnica en el preregistro.
Perfil Técnico: Soporte y Mantenimiento de Cómputo
⚙ Lógica: Solo si carrera_tecnica contiene alguno de: Soporte y Mantenimiento de Equipo de Cómputo
[B4_COMP_01] Durante tu carrera técnica, disfrutaste más diagnosticar fallas de hardware que instalar software.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IEM: +0.5  |  ISC: +0.5

⚙ Condición: Activar si: Soporte y Mantenimiento de Equipo de Cómputo
[B4_COMP_02] Te imaginas en el futuro desarrollando aplicaciones o sistemas para empresas.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → ISC: +1

⚙ Condición: Activar si: Soporte y Mantenimiento de Equipo de Cómputo
[B4_COMP_03] Ya escribes código por tu cuenta (Python, HTML, JavaScript u otro lenguaje) fuera de la escuela.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → ISC: +1

⚙ Condición: Activar si: Soporte y Mantenimiento de Equipo de Cómputo
[B4_COMP_04] Cuando terminabas una práctica de cómputo en tu carrera técnica, ¿qué querías hacer después?
⚙ Condición: Activar si: Soporte y Mantenimiento de Equipo de Cómputo
Opc.
Texto de la opción
Puntaje asignado
A
Seguir explorando cómo funciona el sistema por dentro
ISC: +1
B
Usar lo aprendido para apoyar a personas con sus computadoras
IA: +0.5
C
Pensar en cómo automatizar tareas repetitivas de empresas
ISC: +0.8  |  IA: +0.5
D
No me generaba gran curiosidad más allá de lo requerido
—

Perfil Técnico: Hotelería, Turismo y Ecoturismo
⚙ Lógica: Solo si carrera_tecnica contiene alguno de: Servicios de Hotelería, Hospitalidad Turística, Servicios de Hospedaje, Ecoturismo
[B4_TUR_01] Tu carrera técnica de turismo/hotelería reforzó tu deseo de trabajar en hoteles o destinos turísticos.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → TUR: +1

⚙ Condición: Activar si: Servicios de Hotelería | Hospitalidad Turística | Servicios de Hospedaje | Ecoturismo
[B4_TUR_02] Te interesa más la gestión administrativa del hotel o agencia que el servicio directo al huésped.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IA: +0.8  |  TUR: +0.5

⚙ Condición: Activar si: Servicios de Hotelería | Hospitalidad Turística | Servicios de Hospedaje | Ecoturismo
[B4_TUR_03] Dentro de la industria turística, ¿qué área te llama más la atención?
⚙ Condición: Activar si: Servicios de Hotelería | Hospitalidad Turística | Servicios de Hospedaje | Ecoturismo
Opc.
Texto de la opción
Puntaje asignado
A
Operación y gerencia de hoteles o resorts
TUR: +1
B
Agencias de viajes, tours y experiencias de ecoturismo
TUR: +0.8
C
Finanzas y contabilidad de empresas turísticas
CP: +0.8
D
Marketing digital y promoción de destinos turísticos
IA: +0.5  |  TUR: +0.5

Perfil Técnico: Alimentos y Bebidas
⚙ Lógica: Solo si carrera_tecnica contiene alguno de: Alimentos y Bebidas, Preparación de Alimentos y Bebidas
[B4_ALI_01] Tu carrera técnica en alimentos confirmó que quieres dedicar tu vida a la gastronomía profesional.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → GAS: +1

⚙ Condición: Activar si: Alimentos y Bebidas | Preparación de Alimentos y Bebidas
[B4_ALI_02] Te interesa más la parte creativa (crear recetas y presentaciones) que la administrativa de un restaurante.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → GAS: +0.8

⚙ Condición: Activar si: Alimentos y Bebidas | Preparación de Alimentos y Bebidas
[B4_ALI_03] ¿Qué camino en gastronomía te atrae más?
⚙ Condición: Activar si: Alimentos y Bebidas | Preparación de Alimentos y Bebidas
Opc.
Texto de la opción
Puntaje asignado
A
Chef ejecutivo en hotel o restaurante de autor
GAS: +1
B
Abrir mi propio restaurante o negocio de catering
GAS: +0.8  |  IA: +0.3
C
Gestionar la operación y finanzas de una cadena de restaurantes
IA: +0.8  |  CP: +0.5
D
Gastronomía internacional: trabajar en cruceros u otros países
GAS: +0.8  |  TUR: +0.3

Perfil Técnico: Industrial, Electromecánica y Refrigeración
⚙ Lógica: Solo si carrera_tecnica contiene alguno de: Electromecánica Industrial, Mantenimiento Industrial, Refrigeración y Aire Acondicionado, Mecánica Naval
[B4_IND_01] Tu carrera técnica industrial te motivó a querer especializarte aún más en ingeniería.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IEM: +1  |  IC: +0.3

⚙ Condición: Activar si: Electromecánica Industrial | Mantenimiento Industrial | Refrigeración y Aire Acondicionado | Mecánica Naval
[B4_IND_02] Te interesa más automatizar y modernizar procesos industriales que el trabajo de mantenimiento manual.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IEM: +0.8  |  ISC: +0.5

⚙ Condición: Activar si: Electromecánica Industrial | Mantenimiento Industrial | Refrigeración y Aire Acondicionado | Mecánica Naval
[B4_IND_03] ¿En qué área de la ingeniería industrial te gustaría especializarte?
⚙ Condición: Activar si: Electromecánica Industrial | Mantenimiento Industrial | Refrigeración y Aire Acondicionado | Mecánica Naval
Opc.
Texto de la opción
Puntaje asignado
A
Automatización, robótica y sistemas de control
IEM: +1
B
Instalaciones eléctricas en obras y edificios
IEM: +0.8  |  IC: +0.5
C
Gestión de mantenimiento y proyectos industriales
IA: +0.8  |  IEM: +0.5
D
Energías renovables y sistemas de climatización
IEM: +0.8

Perfil Técnico: Administración, Logística y Ofimática
⚙ Lógica: Solo si carrera_tecnica contiene alguno de: Administración, Técnico en Logística, Técnico en Ofimática, Ventas
[B4_ADM_01] Tu carrera técnica administrativa te confirmó que quieres trabajar en el área de negocios o finanzas.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IA: +0.8  |  CP: +0.8

⚙ Condición: Activar si: Administración | Técnico en Logística | Técnico en Ofimática | Ventas
[B4_ADM_02] Se te da bien el manejo de Excel, Word y herramientas digitales de oficina.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → CP: +0.5  |  IA: +0.3  |  ISC: +0.3

⚙ Condición: Activar si: Administración | Técnico en Logística | Técnico en Ofimática | Ventas
[B4_ADM_03] Dentro del área administrativa, ¿qué especialidad te llama más?
⚙ Condición: Activar si: Administración | Técnico en Logística | Técnico en Ofimática | Ventas
Opc.
Texto de la opción
Puntaje asignado
A
Contabilidad, impuestos y auditoría financiera
CP: +1
B
Gestión de empresas, recursos humanos y estrategia
IA: +1
C
Cadena de suministro, logística e importaciones
IA: +0.8
D
Emprendimiento y creación de mi propio negocio
IA: +0.8  |  CP: +0.3

Perfil Técnico: Acuacultura, Pesca y Recreaciones Acuáticas
⚙ Lógica: Solo si carrera_tecnica contiene alguno de: Acuacultura, Pesca Deportiva y Buceo, Recreaciones Acuáticas
[B4_ACU_01] Tu carrera técnica relacionada con el mar reforzó tu interés en el sector turístico y acuático.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → TUR: +0.8
⚙ Condición: Activar si: Acuacultura | Pesca Deportiva y Buceo | Recreaciones Acuáticas
[B4_ACU_02] Teniendo tu formación acuática, ¿qué carrera universitaria complementaría mejor tus habilidades?
⚙ Condición: Activar si: Acuacultura | Pesca Deportiva y Buceo | Recreaciones Acuáticas
Opc.
Texto de la opción
Puntaje asignado
A
Lic. en Turismo: para gestionar actividades náuticas y ecoturismo
TUR: +1
B
Ing. Civil: para diseñar infraestructura portuaria y costera
IC: +0.8
C
Ing. Electromecánica: para mantenimiento de embarcaciones y motores
IEM: +0.8
D
Ing. en Administración: para gestionar empresas del sector marítimo
IA: +0.8

💙  Bloque V: Bienestar y Orientación Psicopedagógica
Tu bienestar es importante para nosotros 💙
Este bloque es confidencial y solo lo verá el equipo de orientación del ITES Los Cabos. Responde con honestidad para recibir el apoyo que mereces.
🔒 Tus respuestas en este bloque son estrictamente confidenciales. Solo las verá el orientador psicopedagógico.

[B5_01] 💙 Me siento emocionado/a y motivado/a ante la posibilidad de comenzar una carrera universitaria.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
🔔 Si valor ≤ 2: "Baja motivación vocacional. Sesión de orientación individual recomendada."

[B5_02] 💙 En el último mes me he sentido con frecuencia triste, ansioso/a o sin energía para actividades cotidianas.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
🔔 Si valor ≥ 4: "Posible malestar emocional. Derivar a psicólogo escolar."

[B5_03] 💙 Cuento con el apoyo de mi familia para tomar decisiones sobre mi carrera universitaria.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
🔔 Si valor ≤ 2: "Escaso apoyo familiar. Considerar apoyo psicosocial."

[B5_04] 💙 ¿Cuál describe mejor tu estado de ánimo respecto a tu futuro académico?
Opc.
Texto de la opción
Puntaje asignado
A
Me siento seguro/a y con un plan claro
—
B
Tengo ilusión pero también mucha incertidumbre
—
C
Estoy confundido/a y me cuesta visualizar mi futuro
🔔 Confusión vocacional. Sesión de orientación prioritaria.
—
D
Me preocupa mucho y me genera estrés constante
🔔 Estrés vocacional severo. Derivar a psicólogo.
—

[B5_05] 💙 ¿Qué factor podría dificultarte más iniciar o continuar estudios universitarios?
Opc.
Texto de la opción
Puntaje asignado
A
Situación económica familiar
🔔 Riesgo económico. Informar sobre becas y apoyos disponibles.
—
B
Distancia o dificultad de transporte al plantel
🔔 Barrera de acceso. Orientar sobre opciones de movilidad.
—
C
No estar seguro/a de qué carrera elegir
🔔 Indecisión vocacional. Agendar sesión de orientación.
—
D
Responsabilidades en casa (trabajo, cuidado de familia)
🔔 Responsabilidades extraescolares. Orientar sobre modalidades flexibles.
—
E
Ninguno, estoy listo/a para empezar
—

[B5_06] 💙 ¿Has tenido dificultades persistentes en alguna de estas áreas durante la preparatoria?
Opc.
Texto de la opción
Puntaje asignado
A
Comprensión lectora y escritura
🔔 Dificultad lecto-escritora. Canalizar a tutoría académica.
—
B
Matemáticas y cálculo
🔔 Dificultad matemática. Recomendar nivelación antes de cursar carreras cuantitativas.
—
C
Concentración y organización del tiempo de estudio
🔔 Habilidades de estudio deficientes. Taller de técnicas de estudio recomendado.
—
D
Relaciones sociales con compañeros o maestros
🔔 Dificultades sociales. Derivar a orientación psicosocial.
—
E
No he tenido dificultades significativas
—

[B5_07] 💙 Siento que tengo habilidades de estudio suficientes (organizar mi tiempo, tomar apuntes, repasar) para afrontar la universidad.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
🔔 Si valor ≤ 2: "Habilidades de estudio insuficientes. Recomendar taller de técnicas de aprendizaje."

[B5_08] 💙 Si pudieras acceder a un servicio gratuito en el ITES Los Cabos, ¿cuál sería más útil para ti?
Opc.
Texto de la opción
Puntaje asignado
A
Tutoría académica en materias difíciles
—
B
Orientación psicológica o talleres de manejo del estrés
—
C
Talleres de lectura, escritura y habilidades de estudio
—
D
Asesoría sobre becas, financiamiento o bolsa de trabajo
—

🎓  Bloque VI: Exploración de Carreras
¿Qué tanto te identificas con cada carrera?
Lee la descripción de cada carrera y califica del 1 al 5 qué tanto te atrae.

[B6_ISC] Ing. en Sistemas Computacionales — Diseñar y desarrollar software, aplicaciones móviles, bases de datos y sistemas digitales para empresas y organizaciones.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → ISC: +1.5

[B6_IEM] Ing. Electromecánica — Diseñar, instalar y mantener sistemas eléctricos, mecánicos e industriales; trabajar en automatización, plantas industriales y energías renovables.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IEM: +1.5

[B6_IC] Ing. Civil — Planear y dirigir la construcción de edificios, carreteras, puentes y sistemas hidráulicos; hacer que la infraestructura de una ciudad sea posible.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IC: +1.5

[B6_ARQ] Arquitectura — Crear espacios habitables y esteticamente funcionales; diseñar edificios, interiores y entornos urbanos integrando arte, tecnología y sustentabilidad.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → ARQ: +1.5

[B6_GAS] Gastronomía — Dominar las artes culinarias, gestionar cocinas profesionales y restaurantes, y crear experiencias gastronómicas memorables a nivel nacional e internacional.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → GAS: +1.5

[B6_TUR] Lic. en Turismo — Administrar y promover hoteles, agencias de viajes y destinos ecoturísticos; crear experiencias únicas para turistas nacionales y extranjeros.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → TUR: +1.5

[B6_CP] Contador Público — Registrar y analizar la información financiera de empresas; garantizar el cumplimiento fiscal y contribuir a la toma de decisiones económicas.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → CP: +1.5

[B6_IA] Ing. en Administración — Combinar ingeniería y gestión para optimizar procesos, liderar organizaciones y tomar decisiones estratégicas en empresas de cualquier sector.
Escala: 1 (Nada de acuerdo) ── 2 ── 3 ── 4 ── 5 (Totalmente de acuerdo)
Puntaje → IA: +1.5
"""

# Hardcode the parsed blocks to JSON directly, avoiding regex complexity.
blocks = [
    {
        "block": 1,
        "title": "Bloque I: Intereses y Preferencias",
        "subtitle": "Lo que te gusta hacer en tu día a día",
        "weight": 1.0,
        "questions": [
            {"id": "B1_01", "type": "likert", "text": "¿Te ves organizando y dirigiendo equipos de trabajo para alcanzar metas en una empresa?", "targets": {"ADM": 1.0, "CP": 0.5}},
            {"id": "B1_02", "type": "likert", "text": "¿Disfrutas experimentando con ingredientes para crear combinaciones de sabores únicas?", "targets": {"GASTRO": 1.0}},
            {"id": "B1_03", "type": "likert", "text": "¿Te resulta sencillo organizar información en tablas, bases de datos o reportes?", "targets": {"CP": 1.0, "ADM": 0.5, "ISC": 0.5}},
            {"id": "B1_04", "type": "likert", "text": "¿Sientes emoción cuando ves una construcción grande o un puente y te preguntas cómo fue posible hacerlo?", "targets": {"CIVIL": 1.0, "ARQ": 0.5}},
            {"id": "B1_05", "type": "likert", "text": "¿Disfrutas planear viajes, conocer nuevos lugares y aprender sobre otras culturas?", "targets": {"TUR": 1.0}},
            {"id": "B1_06", "type": "likert", "text": "¿Te gusta reparar o armar aparatos electrónicos, máquinas o instalaciones?", "targets": {"ELEC": 1.0, "ISC": 0.5}},
            {"id": "B1_07", "type": "likert", "text": "¿Disfrutas dibujar, diseñar espacios o imaginar cómo se vería un lugar si lo rediseñaras?", "targets": {"ARQ": 1.0, "CIVIL": 0.3}},
            {"id": "B1_08", "type": "likert", "text": "¿Te atrae la idea de crear programas, páginas web o aplicaciones desde cero?", "targets": {"ISC": 1.0}},
            {"id": "B1_09", "type": "likert", "text": "¿Te gusta atender a personas, hacer que se sientan bien recibidas y resolver sus necesidades?", "targets": {"TUR": 0.8, "GASTRO": 0.5}},
            {"id": "B1_10", "type": "likert", "text": "¿Disfrutas analizar estados financieros, facturas o el flujo de dinero de un negocio?", "targets": {"CP": 1.0, "ADM": 0.5}},
            {"id": "B1_11", "type": "likert", "text": "¿Te imaginas viviendo en otra ciudad o país por motivos de trabajo?", "targets": {"TUR": 0.5, "GASTRO": 0.3}},
            {"id": "B1_12", "type": "likert", "text": "¿Cuando algo mecánico o eléctrico falla a tu alrededor, sientes impulso de investigar qué pasó?", "targets": {"ELEC": 1.0}}
        ]
    },
    {
        "block": 2,
        "title": "Bloque II: Habilidades y Aptitudes",
        "subtitle": "Lo que se te da bien hacer",
        "weight": 1.0,
        "questions": [
            {"id": "B2_01", "type": "likert", "text": "Se me facilita resolver operaciones matemáticas complejas sin necesitar demasiada ayuda.", "targets": {"CIVIL": 1.0, "ISC": 0.8, "CP": 0.8, "ELEC": 0.8, "ADM": 0.5}},
            {"id": "B2_02", "type": "likert", "text": "Puedo imaginar con facilidad cómo se vería un objeto o espacio en 3D si lo giro mentalmente.", "targets": {"ARQ": 1.0, "CIVIL": 0.8, "ELEC": 0.5}},
            {"id": "B2_03", "type": "likert", "text": "Se me da bien redactar, convencer a otros con argumentos y comunicarme con claridad.", "targets": {"TUR": 0.8, "ADM": 0.5, "GASTRO": 0.3}},
            {"id": "B2_04", "type": "likert", "text": "Llevo un buen registro de mis gastos personales y sé administrar el dinero que tengo.", "targets": {"CP": 1.0, "ADM": 0.8}},
            {"id": "B2_05", "type": "likert", "text": "Aprendo a usar programas y aplicaciones de computadora de manera rápida y casi sin instrucciones.", "targets": {"ISC": 1.0, "ADM": 0.3}},
            {"id": "B2_06", "type": "likert", "text": "Soy capaz de seguir y entender planos, instrucciones técnicas o diagramas complejos.", "targets": {"CIVIL": 1.0, "ELEC": 0.8, "ARQ": 0.8}},
            {"id": "B2_07", "type": "likert", "text": "Cuando detecto un error en un proceso, documento o proyecto, propongo soluciones concretas.", "targets": {"ADM": 0.8, "CP": 0.5, "ISC": 0.5}},
            {"id": "B2_08", "type": "likert", "text": "Tengo facilidad para trabajar en cocina: medir, combinar ingredientes y controlar tiempos de cocción.", "targets": {"GASTRO": 1.0}},
            {"id": "B2_09", "type": "likert", "text": "Sé liderar un equipo: asigno tareas, motivo al grupo y resuelvo conflictos entre personas.", "targets": {"ADM": 1.0, "TUR": 0.5}},
            {"id": "B2_10", "type": "likert", "text": "Me siento cómodo/a comunicándome en inglés (hablando, leyendo o escribiendo).", "targets": {"TUR": 1.0, "ISC": 0.3}}
        ]
    },
    {
        "block": 3,
        "title": "Bloque III: Situaciones y Decisiones",
        "subtitle": "¿Cómo reaccionas en distintos contextos?",
        "weight": 1.0,
        "questions": [
            {
                "id": "B3_01", "type": "options", "text": "Tienes que organizar un evento para 100 personas. ¿Cuál tarea elegirías?",
                "options": [
                    {"label": "Diseñar la decoración y la ambientación del lugar", "targets": {"ARQ": 1.0}},
                    {"label": "Coordinar al equipo de trabajo y el presupuesto", "targets": {"ADM": 1.0}},
                    {"label": "Diseñar y preparar el menú de comida y bebidas", "targets": {"GASTRO": 1.0}},
                    {"label": "Atender a los asistentes y garantizar su satisfacción", "targets": {"TUR": 1.0}}
                ]
            },
            {
                "id": "B3_02", "type": "options", "text": "Si pudieras trabajar en una de estas empresas de Los Cabos, ¿cuál elegirías?",
                "options": [
                    {"label": "Una empresa constructora de hoteles y desarrollos turísticos", "targets": {"CIVIL": 1.0}},
                    {"label": "Un despacho contable o de consultoría financiera", "targets": {"CP": 1.0}},
                    {"label": "Un restaurante gourmet o una cadena de hoteles de lujo", "targets": {"GASTRO": 0.5, "TUR": 0.5}},
                    {"label": "Una empresa de tecnología o de automatización industrial", "targets": {"ISC": 0.5, "ELEC": 0.5}}
                ]
            },
            {
                "id": "B3_03", "type": "options", "text": "Alguien te pide consejo porque quiere abrir un pequeño negocio. ¿Qué harías primero?",
                "options": [
                    {"label": "Diseñar cómo se vería el local y la identidad visual del negocio", "targets": {"ARQ": 0.8}},
                    {"label": "Hacer un análisis de costos, ingresos y punto de equilibrio", "targets": {"CP": 1.0, "ADM": 0.5}},
                    {"label": "Crear una página web o sistema de ventas en línea", "targets": {"ISC": 1.0}},
                    {"label": "Estudiar al cliente y diseñar la experiencia del servicio", "targets": {"TUR": 0.8, "ADM": 0.3}}
                ]
            },
            {
                "id": "B3_04", "type": "options", "text": "Estás en una clase difícil. ¿Qué estrategia usas para aprender?",
                "options": [
                    {"label": "Hago esquemas, dibujos o mapas mentales visuales", "targets": {"ARQ": 0.5, "CIVIL": 0.3}},
                    {"label": "Practico con ejercicios y resuelvo problemas reales", "targets": {"ISC": 0.5, "ELEC": 0.5, "CIVIL": 0.5}},
                    {"label": "Leo, subrayo y hago resúmenes detallados", "targets": {"CP": 0.3, "TUR": 0.3}},
                    {"label": "Busco videos, tutoriales o se lo pido a alguien que ya lo entiende", "targets": {"GASTRO": 0.3}}
                ]
            },
            {
                "id": "B3_05", "type": "options", "text": "Tu sueño sería trabajar en un proyecto que...",
                "options": [
                    {"label": "Deje una obra visible: un edificio, un puente o un parque urbano", "targets": {"CIVIL": 1.0, "ARQ": 0.8}},
                    {"label": "Ayude a que una empresa sea más eficiente y rentable", "targets": {"ADM": 1.0, "CP": 0.5}},
                    {"label": "Lleve tecnología o automatización a empresas que lo necesitan", "targets": {"ISC": 0.8, "ELEC": 0.8}},
                    {"label": "Cree experiencias únicas para turistas nacionales e internacionales", "targets": {"TUR": 1.0}}
                ]
            },
            {
                "id": "B3_06", "type": "options", "text": "¿Cuál de estas materias de preparatoria te gustó más o te resultó más fácil?",
                "options": [
                    {"label": "Matemáticas y Física", "targets": {"CIVIL": 0.8, "ISC": 0.8, "ELEC": 0.8}},
                    {"label": "Contabilidad, Economía o Administración", "targets": {"CP": 1.0, "ADM": 0.8}},
                    {"label": "Inglés, Historia o Geografía", "targets": {"TUR": 0.8}},
                    {"label": "Arte, Dibujo técnico o Talleres prácticos", "targets": {"ARQ": 1.0, "GASTRO": 0.5}}
                ]
            },
            {
                "id": "B3_07", "type": "options", "text": "¿Cuál de estas frases describe mejor cómo te ves en 5 años?",
                "options": [
                    {"label": "Dirigiendo una obra de construcción o diseñando un edificio", "targets": {"CIVIL": 1.0, "ARQ": 0.8}},
                    {"label": "Gestionando la contabilidad o las finanzas de una empresa", "targets": {"CP": 1.0}},
                    {"label": "Desarrollando software o administrando sistemas en una empresa", "targets": {"ISC": 1.0}},
                    {"label": "Dirigiendo el comedor o la cocina de un hotel cinco estrellas", "targets": {"GASTRO": 1.0}}
                ]
            },
            {
                "id": "B3_08", "type": "options", "text": "¿En qué tipo de entorno de trabajo te sentirías más cómodo/a?",
                "options": [
                    {"label": "Al aire libre, en obra o en instalaciones industriales", "targets": {"CIVIL": 0.8, "ELEC": 0.8}},
                    {"label": "En una oficina frente a una computadora", "targets": {"ISC": 0.8, "CP": 0.5}},
                    {"label": "En cocinas, restaurantes, hoteles o centros turísticos", "targets": {"GASTRO": 0.8, "TUR": 0.5}},
                    {"label": "En cualquier lugar: viajando, reuniéndome con clientes, cambiando de escenario", "targets": {"TUR": 0.8, "ADM": 0.3}}
                ]
            }
        ]
    },
    {
        "block": 4,
        "title": "Bloque IV: Adaptativo — Carrera Técnica",
        "subtitle": "Preguntas especiales basadas en tu formación técnica",
        "weight": 1.5,
        "specialContext": True,
        "isAdaptive": True,
        "groups": [
            {
                "groupName": "Sistemas",
                "conditions": ["Soporte y Mantenimiento de Equipo de Cómputo", "Técnico en Ofimática"],
                "questions": [
                    {"id": "B4_COMP_01", "type": "likert", "text": "Durante tu carrera técnica, disfrutaste más diagnosticar fallas de hardware que instalar software.", "targets": {"ELEC": 0.5, "ISC": 0.5}},
                    {"id": "B4_COMP_02", "type": "likert", "text": "Te imaginas en el futuro desarrollando aplicaciones o sistemas para empresas.", "targets": {"ISC": 1.0}},
                    {"id": "B4_COMP_03", "type": "likert", "text": "Ya escribes código por tu cuenta (Python, HTML, JavaScript u otro) fuera de la escuela.", "targets": {"ISC": 1.0}},
                    {"id": "B4_COMP_04", "type": "options", "text": "Cuando terminabas una práctica de cómputo, ¿qué querías hacer después?", "options": [
                        {"label": "Seguir explorando cómo funciona el sistema por dentro", "targets": {"ISC": 1.0}},
                        {"label": "Usar lo aprendido para apoyar a personas", "targets": {"ADM": 0.5}},
                        {"label": "Pensar en cómo automatizar tareas repetitivas", "targets": {"ISC": 0.8, "ADM": 0.5}},
                        {"label": "No me generaba gran curiosidad", "targets": {}}
                    ]}
                ]
            },
            {
                "groupName": "Turismo",
                "conditions": ["Servicios de Hotelería", "Hospitalidad Turística (Turismo)", "Servicios de Hospedaje", "Ecoturismo", "Pesca Deportiva y Buceo", "Recreaciones Acuáticas"],
                "questions": [
                    {"id": "B4_TUR_01", "type": "likert", "text": "Tu carrera técnica reforzó tu deseo de trabajar en hoteles o destinos turísticos.", "targets": {"TUR": 1.0}},
                    {"id": "B4_TUR_02", "type": "likert", "text": "Te interesa más la gestión administrativa hotelera que el servicio directo.", "targets": {"ADM": 0.8, "TUR": 0.5}},
                    {"id": "B4_TUR_03", "type": "options", "text": "Dentro de la industria turística, ¿qué área te llama más la atención?", "options": [
                        {"label": "Operación y gerencia de hoteles o resorts", "targets": {"TUR": 1.0}},
                        {"label": "Agencias de viajes, tours y experiencias", "targets": {"TUR": 0.8}},
                        {"label": "Finanzas y contabilidad de empresas turísticas", "targets": {"CP": 0.8}},
                        {"label": "Marketing digital y promoción de destinos", "targets": {"ADM": 0.5, "TUR": 0.5}}
                    ]}
                ]
            },
            {
                "groupName": "Gastronomía",
                "conditions": ["Alimentos y Bebidas", "Preparación de Alimentos y Bebidas", "Acuacultura"],
                "questions": [
                    {"id": "B4_ALI_01", "type": "likert", "text": "Tu carrera técnica confirmó que quieres dedicar tu vida a la gastronomía profesional.", "targets": {"GASTRO": 1.0}},
                    {"id": "B4_ALI_02", "type": "likert", "text": "Te interesa más la parte creativa que la administrativa de un restaurante.", "targets": {"GASTRO": 0.8}},
                    {"id": "B4_ALI_03", "type": "options", "text": "¿Qué camino te atrae más?", "options": [
                        {"label": "Chef ejecutivo en hotel o restaurante de autor", "targets": {"GASTRO": 1.0}},
                        {"label": "Abrir mi propio restaurante o negocio", "targets": {"GASTRO": 0.8, "ADM": 0.3}},
                        {"label": "Gestionar la operación y finanzas", "targets": {"ADM": 0.8, "CP": 0.5}},
                        {"label": "Trabajar en cruceros u otros países", "targets": {"GASTRO": 0.8, "TUR": 0.3}}
                    ]}
                ]
            },
            {
                "groupName": "Industrial",
                "conditions": ["Electromecánica Industrial", "Mantenimiento Industrial", "Refrigeración y Aire Acondicionado", "Mecánica Naval", "Técnico Agropecuario"],
                "questions": [
                    {"id": "B4_IND_01", "type": "likert", "text": "Tu carrera técnica te motivó a querer especializarte aún más en ingeniería.", "targets": {"ELEC": 1.0, "CIVIL": 0.3}},
                    {"id": "B4_IND_02", "type": "likert", "text": "Te interesa más automatizar procesos que el trabajo manual.", "targets": {"ELEC": 0.8, "ISC": 0.5}},
                    {"id": "B4_IND_03", "type": "options", "text": "¿En qué área de ingeniería te gustaría especializarte?", "options": [
                        {"label": "Automatización, robótica y sistemas de control", "targets": {"ELEC": 1.0}},
                        {"label": "Instalaciones eléctricas en obras y edificios", "targets": {"ELEC": 0.8, "CIVIL": 0.5}},
                        {"label": "Gestión de mantenimiento y proyectos industriales", "targets": {"ADM": 0.8, "ELEC": 0.5}},
                        {"label": "Energías renovables y sistemas de climatización", "targets": {"ELEC": 0.8}}
                    ]}
                ]
            },
            {
                "groupName": "Administración",
                "conditions": ["Administración", "Técnico en Logística", "Ventas"],
                "questions": [
                    {"id": "B4_ADM_01", "type": "likert", "text": "Tu carrera técnica te confirmó que quieres trabajar en negocios o finanzas.", "targets": {"ADM": 0.8, "CP": 0.8}},
                    {"id": "B4_ADM_02", "type": "likert", "text": "Se te da bien el manejo de Excel, Word y herramientas digitales de oficina.", "targets": {"CP": 0.5, "ADM": 0.3, "ISC": 0.3}},
                    {"id": "B4_ADM_03", "type": "options", "text": "Dentro del área, ¿qué especialidad te llama más?", "options": [
                        {"label": "Contabilidad, impuestos y auditoría financiera", "targets": {"CP": 1.0}},
                        {"label": "Gestión de empresas, estrategia y RRHH", "targets": {"ADM": 1.0}},
                        {"label": "Cadena de suministro, logística e importaciones", "targets": {"ADM": 0.8}},
                        {"label": "Emprendimiento y crear mi propio negocio", "targets": {"ADM": 0.8, "CP": 0.3}}
                    ]}
                ]
            }
        ]
    },
    {
        "block": 5,
        "title": "Bloque V: Bienestar y Orientación Psicopedagógica",
        "subtitle": "Confidencial y Exclusivo para Orientación",
        "weight": 0.0,
        "isPsico": True,
        "questions": [
            {"id": "B5_01", "type": "likert", "text": "Me siento emocionado/a y motivado/a ante la posibilidad de comenzar una carrera universitaria.", "alertRule": {"operator": "<=", "value": 2, "msg": "Baja motivación vocacional. Sesión de orientación recomendada.", "type": "yellow"}},
            {"id": "B5_02", "type": "likert", "text": "En el último mes me he sentido con frecuencia triste, ansioso/a o sin energía.", "alertRule": {"operator": ">=", "value": 4, "msg": "Posible malestar emocional. Derivar a psicólogo escolar.", "type": "red"}},
            {"id": "B5_03", "type": "likert", "text": "Cuento con el apoyo de mi familia para tomar decisiones sobre mi carrera.", "alertRule": {"operator": "<=", "value": 2, "msg": "Escaso apoyo familiar. Considerar apoyo psicosocial.", "type": "yellow"}},
            {
                "id": "B5_04", "type": "options", "text": "¿Cuál describe mejor tu estado de ánimo respecto a tu futuro académico?",
                "options": [
                    {"label": "Me siento seguro/a y con un plan claro", "alert": None},
                    {"label": "Tengo ilusión pero también mucha incertidumbre", "alert": None},
                    {"label": "Estoy confundido/a y me cuesta visualizar mi futuro", "alert": {"msg": "Confusión vocacional. Sesión prioritaria.", "type": "yellow"}},
                    {"label": "Me preocupa mucho y me genera estrés constante", "alert": {"msg": "Estrés vocacional severo. Derivar a psicólogo.", "type": "red"}}
                ]
            },
            {
                "id": "B5_05", "type": "options", "text": "¿Qué factor podría dificultarte más iniciar estudios universitarios?",
                "options": [
                    {"label": "Situación económica familiar", "alert": {"msg": "Riesgo económico. Informar sobre becas.", "type": "yellow"}},
                    {"label": "Distancia o dificultad de transporte", "alert": {"msg": "Barrera de movilidad. Orientar transporte.", "type": "yellow"}},
                    {"label": "No estar seguro/a de qué carrera elegir", "alert": {"msg": "Indecisión vocacional.", "type": "yellow"}},
                    {"label": "Responsabilidades en casa", "alert": {"msg": "Responsabilidades extraescolares.", "type": "yellow"}},
                    {"label": "Ninguno, estoy listo/a", "alert": None}
                ]
            },
            {
                "id": "B5_06", "type": "options", "text": "¿Has tenido dificultades persistentes en alguna área en preparatoria?",
                "options": [
                    {"label": "Comprensión lectora y escritura", "alert": {"msg": "Dificultad lectoescritora.", "type": "yellow"}},
                    {"label": "Matemáticas y cálculo", "alert": {"msg": "Dificultad matemática.", "type": "yellow"}},
                    {"label": "Concentración y organización", "alert": {"msg": "Deficiencia en estudio.", "type": "yellow"}},
                    {"label": "Relaciones sociales con compañeros o maestros", "alert": {"msg": "Dificultad social.", "type": "red"}},
                    {"label": "No he tenido dificultades", "alert": None}
                ]
            },
            {"id": "B5_07", "type": "likert", "text": "Siento que tengo habilidades de estudio suficientes para la universidad.", "alertRule": {"operator": "<=", "value": 2, "msg": "Habilidades insuficientes. Taller.", "type": "yellow"}},
            {
                "id": "B5_08", "type": "options", "text": "Si pudieras acceder a un servicio gratuito, ¿cuál sería más útil?",
                "options": [
                    {"label": "Tutoría académica", "alert": None},
                    {"label": "Orientación psicológica o estrés", "alert": None},
                    {"label": "Talleres de estudio", "alert": None},
                    {"label": "Asesoría sobre becas", "alert": None}
                ]
            }
        ]
    },
    {
        "block": 6,
        "title": "Bloque VI: Exploración de Carreras",
        "subtitle": "¿Qué tanto te identificas con cada carrera?",
        "weight": 1.2,
        "questions": [
            {"id": "B6_ISC", "type": "likert", "text": "Ing. en Sistemas Computacionales — Diseñar y desarrollar software, aplicaciones móviles, bases de datos y sistemas digitales.", "targets": {"ISC": 1.5}},
            {"id": "B6_IEM", "type": "likert", "text": "Ing. Electromecánica — Diseñar, instalar y mantener sistemas eléctricos y mecánicos; trabajar en automatización y energías.", "targets": {"ELEC": 1.5}},
            {"id": "B6_IC", "type": "likert", "text": "Ing. Civil — Planear y dirigir la construcción de edificios, carreteras, puentes y sistemas hidráulicos.", "targets": {"CIVIL": 1.5}},
            {"id": "B6_ARQ", "type": "likert", "text": "Arquitectura — Crear espacios habitables y estéticamente funcionales integrando arte, tecnología y sustentabilidad.", "targets": {"ARQ": 1.5}},
            {"id": "B6_GAS", "type": "likert", "text": "Gastronomía — Dominar las artes culinarias, gestionar cocinas profesionales y crear experiencias.", "targets": {"GASTRO": 1.5}},
            {"id": "B6_TUR", "type": "likert", "text": "Lic. en Turismo — Administrar y promover hoteles, agencias y destinos ecoturísticos.", "targets": {"TUR": 1.5}},
            {"id": "B6_CP", "type": "likert", "text": "Contador Público — Registrar y analizar la información financiera; garantizar el cumplimiento fiscal.", "targets": {"CP": 1.5}},
            {"id": "B6_IA", "type": "likert", "text": "Ing. en Administración — Combinar ingeniería y gestión para optimizar procesos y decisiones estratégicas.", "targets": {"ADM": 1.5}}
        ]
    }
]

with open('c:\\Users\\larr_\\Documents\\SIA-tecnm-main\\public\\data\\vocacional-preguntas-v2.json', 'w', encoding='utf-8') as f:
    json.dump(blocks, f, ensure_ascii=False, indent=2)

print("JSON saved successfully.")
