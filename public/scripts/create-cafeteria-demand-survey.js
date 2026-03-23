// Script utilitario para crear una encuesta privada/borrador
// sobre demanda del modulo de cafeteria en SIA.
//
// Uso sugerido en consola del navegador:
// 1. Inicia sesion como admin de encuestas.
// 2. Asegurate de que EncuestasService este cargado.
// 3. Ejecuta: createPrivateCafeteriaDemandSurvey()
//
// Nota:
// - La pregunta de ranking/multiseleccion se crea como texto abierto
//   porque el modulo actual no soporta ordenamiento ni seleccion multiple nativa.

function getEncuestasScriptCtx() {
  const ctx = window.SIA?.getCtx?.() || window.appContext || null;
  if (!ctx) throw new Error('No se encontro contexto de app. Abre SIA e inicia sesion como admin.');
  if (!ctx.user && ctx.auth?.currentUser) {
    return { ...ctx, user: ctx.auth.currentUser };
  }
  return ctx;
}

function buildCafeteriaDemandSurveyPayload() {
  return {
    title: 'Diagnostico de demanda - Modulo de Cafeteria en SIA',
    description: 'Encuesta privada en borrador para medir demanda, habitos y percepcion del posible modulo digital de cafeteria dentro de SIA.',
    audience: ['todos'],
    isPublic: false,
    status: 'draft',
    scheduling: {
      type: 'manual',
      startDate: null,
      endDate: null
    },
    delivery: {
      mandatoryMode: 'optional',
      blocking: false,
      showInStories: true,
      spotlight: false
    },
    questions: [
      {
        id: 'q0',
        type: 'multiple',
        text: 'Seccion 1 - Habitos actuales: Con que frecuencia consumes en la cafeteria de la institucion?',
        required: true,
        options: ['Todos los dias', '3-4 veces por semana', '1-2 veces por semana', 'Rara vez', 'Nunca']
      },
      {
        id: 'q1',
        type: 'multiple',
        text: 'Cuanto tiempo promedio esperas para ser atendido en la cafeteria durante la hora pico?',
        required: true,
        options: ['Menos de 5 min', '5-10 min', '10-20 min', 'Mas de 20 min']
      },
      {
        id: 'q2',
        type: 'multiple',
        text: 'Alguna vez has dejado de comprar en la cafeteria por falta de tiempo?',
        required: true,
        options: ['Si, frecuentemente', 'Si, algunas veces', 'Rara vez', 'No']
      },
      {
        id: 'q3',
        type: 'multiple',
        text: 'Cual es la mayor razon por la que no compras en la cafeteria?',
        required: true,
        options: [
          'Las filas son muy largas',
          'No se que hay de menu hasta que llego',
          'No me alcanza el tiempo del receso',
          'Los precios',
          'Prefiero traer comida de casa',
          'Otra'
        ]
      },
      {
        id: 'q4',
        type: 'multiple',
        text: 'Seccion 2 - Interes en el modulo digital: El sistema SIA podria incluir un modulo de cafeteria donde puedas ver el menu, hacer tu pedido desde el telefono y solo pasar a recogerlo. Que tan interesado estarias?',
        required: true,
        options: ['Muy interesado', 'Interesado', 'Poco interesado', 'No me interesa']
      },
      {
        id: 'q5',
        type: 'multiple',
        text: 'Si pudieras ver el menu del dia desde SIA antes de salir al receso, cambiaria tu decision de comprar en la cafeteria?',
        required: true,
        options: ['Si, compraria mas seguido', 'Posiblemente', 'No cambiaria nada']
      },
      {
        id: 'q6',
        type: 'open',
        text: 'Cuales de estas funciones te parecen mas utiles? Escribe tus 3 funciones favoritas en orden de prioridad: ver menu del dia con fotos y precios, pedir anticipado y recoger sin fila, tiempo estimado de preparacion, pagar por transferencia, ver resenas y calificaciones.',
        required: true
      },
      {
        id: 'q7',
        type: 'multiple',
        text: 'Utilizarias la funcion de "pedir desde SIA y recoger en ventanilla sin hacer fila"?',
        required: true,
        options: ['Definitivamente si', 'Probablemente si', 'Probablemente no', 'No']
      },
      {
        id: 'q8',
        type: 'multiple',
        text: 'Seccion 3 - Impacto economico: Si hubiera un modulo de pedidos en SIA, crees que comprarias en la cafeteria con mas frecuencia?',
        required: true,
        options: ['Si, definitivamente', 'Probablemente si', 'Sin cambios', 'Probablemente menos']
      },
      {
        id: 'q9',
        type: 'multiple',
        text: 'Cuanto gastas en promedio por visita a la cafeteria?',
        required: true,
        options: ['Menos de $30', '$30-$60', '$60-$100', 'Mas de $100']
      },
      {
        id: 'q10',
        type: 'multiple',
        text: 'Estarias dispuesto a pagar con transferencia bancaria si eso agiliza tu pedido?',
        required: true,
        options: ['Si', 'No', 'Dependeria del monto']
      },
      {
        id: 'q11',
        type: 'scale',
        text: 'Seccion 4 - Experiencia actual del servicio: Como calificarias el servicio actual de la cafeteria?',
        required: true,
        min: 1,
        max: 5
      },
      {
        id: 'q12',
        type: 'multiple',
        text: 'Que mejoraria mas tu experiencia en la cafeteria?',
        required: true,
        options: [
          'Mayor variedad de platillos',
          'Precios mas accesibles',
          'Menos tiempo de espera',
          'Mejor atencion',
          'Horarios extendidos',
          'Poder pedir por anticipado'
        ]
      },
      {
        id: 'q13',
        type: 'multiple',
        text: 'Recomendarias usar un modulo de cafeteria en SIA a otros companeros?',
        required: true,
        options: ['Si', 'No', 'Tal vez']
      }
    ]
  };
}

async function createPrivateCafeteriaDemandSurvey() {
  const ctx = getEncuestasScriptCtx();

  if (!window.EncuestasService?.createSurvey || !window.EncuestasService?.getAllSurveys) {
    throw new Error('EncuestasService no esta disponible. Abre el modulo de encuestas antes de ejecutar el script.');
  }

  const payload = buildCafeteriaDemandSurveyPayload();

  try {
    const existing = await window.EncuestasService.getAllSurveys(ctx, { includeArchived: true });
    const duplicated = (existing || []).find((survey) => survey.title === payload.title && survey.status !== 'archived');

    if (duplicated) {
      console.warn('[Encuestas] Ya existe una encuesta con este titulo:', duplicated.id);
      return duplicated;
    }

    const created = await window.EncuestasService.createSurvey(ctx, payload);
    console.log('[Encuestas] Encuesta creada en borrador:', created?.id || created);
    console.log('[Encuestas] Titulo:', payload.title);
    console.log('[Encuestas] Audiencia:', payload.audience.join(', '));
    console.log('[Encuestas] Privada:', !payload.isPublic);
    console.log('[Encuestas] Estado:', payload.status);
    return created;
  } catch (error) {
    console.error('[Encuestas] No se pudo crear la encuesta de cafeteria:', error);
    throw error;
  }
}

console.log('');
console.log('============================================================');
console.log('  SCRIPT: ENCUESTA PRIVADA DE DEMANDA PARA CAFETERIA');
console.log('============================================================');
console.log('1. Inicia sesion como admin de encuestas.');
console.log('2. Abre el modulo /encuestas para cargar EncuestasService.');
console.log('3. Ejecuta: createPrivateCafeteriaDemandSurvey()');
console.log('============================================================');
console.log('');
