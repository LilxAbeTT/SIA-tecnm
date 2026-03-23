// Script para registrar encuestas de servicio predeterminadas
// Ejecutar en la consola del navegador después de iniciar sesión como admin

// IMPORTANTE: Asegúrate de tener acceso a ctx (contexto de usuario)
// y que EncuestasServicioService esté cargado

async function registerServiceSurveys() {
  console.log('🚀 Iniciando registro de encuestas de servicio...');

  try {
    // ========== ENCUESTA DE SERVICIO MÉDICO ==========
    console.log('📋 Registrando encuesta de Servicio Médico...');
    await EncuestasServicioService.createServiceSurvey(window.appContext, 'servicio-medico', {
      title: 'Encuesta de Satisfacción - Servicio Médico',
      description: '¡Hola! Nos gustaría conocer tu experiencia. Ayúdanos a mejorar la calidad de nuestro servicio médico.',
      questions: [
        {
          id: 'q0',
          type: 'multiple',
          text: '¿Con qué frecuencia utilizas el Servicio Médico?',
          required: true,
          options: ['Primera vez', 'Ocasionalmente', 'Frecuentemente']
        },
        {
          id: 'q1',
          type: 'multiple',
          text: 'El horario del Servicio Médico es adecuado.',
          required: true,
          options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo']
        },
        {
          id: 'q2',
          type: 'multiple',
          text: 'La ubicación y señalización del consultorio son claras.',
          required: true,
          options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala']
        },
        {
          id: 'q3',
          type: 'multiple',
          text: 'El tiempo de espera para ser atendido fue razonable.',
          required: true,
          options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo']
        },
        {
          id: 'q4',
          type: 'multiple',
          text: 'El personal médico mostró trato respetuoso y amable.',
          required: true,
          options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo']
        },
        {
          id: 'q5',
          type: 'multiple',
          text: 'El personal generó confianza durante la atención.',
          required: true,
          options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala']
        },
        {
          id: 'q6',
          type: 'multiple',
          text: 'Las explicaciones brindadas sobre mi estado de salud fueron claras.',
          required: true,
          options: ['Muy buenas', 'Buenas', 'Regulares', 'Malas', 'Muy malas']
        },
        {
          id: 'q7',
          type: 'multiple',
          text: 'Las instalaciones se encontraban limpias y en condiciones adecuadas.',
          required: true,
          options: ['Muy buenas', 'Buenas', 'Regulares', 'Malas', 'Muy malas']
        },
        {
          id: 'q8',
          type: 'multiple',
          text: 'El consultorio cuenta con privacidad suficiente para la atención.',
          required: true,
          options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala']
        },
        {
          id: 'q9',
          type: 'multiple',
          text: 'La atención recibida resolvió mi necesidad médica.',
          required: true,
          options: ['Totalmente', 'Parcialmente', 'No']
        },
        {
          id: 'q10',
          type: 'multiple',
          text: 'En caso de canalización externa, la orientación proporcionada fue clara.',
          required: false,
          options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala', 'No aplica']
        },
        {
          id: 'q11',
          type: 'multiple',
          text: 'En general, estoy satisfecho(a) con el Servicio Médico del ITES.',
          required: true,
          options: ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho', 'Nada satisfecho']
        },
        {
          id: 'q12',
          type: 'multiple',
          text: 'Recomendaría el Servicio Médico a otros miembros de la comunidad.',
          required: true,
          options: ['Sí', 'Tal vez', 'No']
        },
        {
          id: 'q13',
          type: 'open',
          text: '¿Qué aspecto del Servicio Médico consideras que puede mejorar?',
          required: false
        },
        {
          id: 'q14',
          type: 'open',
          text: '¿Deseas agregar algún comentario adicional?',
          required: false
        }
      ],
      enabled: false, // Deshabilitada por defecto hasta configurar
      config: {
        frequency: 'per-use',
        customDays: null,
        showToAll: false,
        maxSkips: 2
      }
    });
    console.log('✅ Encuesta de Servicio Médico registrada');

    // ========== ENCUESTA DE PSICOLOGÍA ==========
    console.log('📋 Registrando encuesta de Psicología...');
    await EncuestasServicioService.createServiceSurvey(window.appContext, 'psicologia', {
      title: 'Encuesta de Satisfacción - Atención Psicopedagógica',
      description: '¡Hola! Tu opinión es muy valiosa para nosotros y nos ayuda a mejorar el servicio de apoyo psicopedagógico.',
      questions: [
        {
          id: 'q0',
          type: 'multiple',
          text: '¿Con qué frecuencia utilizas el Servicio de Psicología?',
          required: true,
          options: ['Primera vez', 'Ocasionalmente', 'Frecuentemente']
        },
        {
          id: 'q1',
          type: 'multiple',
          text: 'El horario del servicio es adecuado.',
          required: true,
          options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo']
        },
        {
          id: 'q2',
          type: 'multiple',
          text: 'La ubicación y señalización del consultorio son claras.',
          required: true,
          options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala']
        },
        {
          id: 'q3',
          type: 'multiple',
          text: 'El tiempo de espera para ser atendido fue razonable.',
          required: true,
          options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo']
        },
        // Preguntas específicas de psicología
        {
          id: 'q4',
          type: 'multiple',
          text: '¿La atención proporcionada fue respetuosa y profesional?',
          required: true,
          options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala']
        },
        {
          id: 'q5',
          type: 'multiple',
          text: '¿Se sintió escuchado(a) durante la sesión?',
          required: true,
          options: ['Totalmente', 'Parcialmente', 'No']
        },
        {
          id: 'q6',
          type: 'multiple',
          text: '¿El apoyo recibido le ayudó a aclarar o mejorar la situación que planteó?',
          required: true,
          options: ['Totalmente', 'Parcialmente', 'No']
        },
        {
          id: 'q7',
          type: 'multiple',
          text: '¿El personal psicopedagógico brindó herramientas o recomendaciones útiles?',
          required: true,
          options: ['Muy útiles', 'Útiles', 'Poco útiles', 'No útiles']
        },
        {
          id: 'q8',
          type: 'multiple',
          text: '¿El proceso para solicitar el servicio fue sencillo?',
          required: true,
          options: ['Muy sencillo', 'Sencillo', 'Complicado', 'Muy complicado']
        },
        {
          id: 'q9',
          type: 'multiple',
          text: '¿Sintió que su información fue tratada con confidencialidad?',
          required: true,
          options: ['Totalmente', 'Parcialmente', 'No']
        },
        {
          id: 'q10',
          type: 'multiple',
          text: 'Las instalaciones se encontraban limpias y en condiciones adecuadas.',
          required: true,
          options: ['Muy buenas', 'Buenas', 'Regulares', 'Malas', 'Muy malas']
        },
        {
          id: 'q11',
          type: 'multiple',
          text: 'El consultorio cuenta con privacidad suficiente para la atención.',
          required: true,
          options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala']
        },
        {
          id: 'q12',
          type: 'multiple',
          text: '¿Qué tan satisfecho(a) está con el servicio de apoyo psicopedagógico?',
          required: true,
          options: ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho', 'Nada satisfecho']
        },
        {
          id: 'q13',
          type: 'multiple',
          text: 'Recomendaría el servicio a otros miembros de la comunidad.',
          required: true,
          options: ['Sí', 'Tal vez', 'No']
        },
        {
          id: 'q14',
          type: 'open',
          text: '¿Qué aspecto del servicio consideras que puede mejorar?',
          required: false
        },
        {
          id: 'q15',
          type: 'open',
          text: '¿Deseas agregar algún comentario adicional?',
          required: false
        }
      ],
      enabled: false,
      config: {
        frequency: 'per-use',
        customDays: null,
        showToAll: false,
        maxSkips: 2
      }
    });
    console.log('✅ Encuesta de Psicología registrada');

    // ========== ENCUESTA DE BIBLIOTECA ==========
    console.log('📋 Registrando encuesta de Biblioteca...');
    await EncuestasServicioService.createServiceSurvey(window.appContext, 'biblioteca', {
      title: 'Encuesta de Satisfacción - Biblioteca',
      description: '¡Hola! Compártenos tu experiencia para ayudarnos a mejorar los servicios de la biblioteca.',
      questions: [
        {
          id: 'q0',
          type: 'multiple',
          text: '¿El personal de Biblioteca le brindó atención amable y respetuosa?',
          required: true,
          options: ['Muy buena', 'Buena', 'Regular', 'Mala', 'Muy mala']
        },
        {
          id: 'q1',
          type: 'multiple',
          text: '¿Recibió apoyo oportuno para localizar material o resolver dudas?',
          required: true,
          options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo', 'No aplica']
        },
        {
          id: 'q2',
          type: 'multiple',
          text: '¿El material bibliográfico (libros, revistas, recursos digitales) fue suficiente y adecuado?',
          required: true,
          options: ['Muy bueno', 'Bueno', 'Regular', 'Malo', 'Muy malo']
        },
        {
          id: 'q3',
          type: 'multiple',
          text: '¿Las instalaciones de la Biblioteca estaban limpias y en buen estado?',
          required: true,
          options: ['Muy buenas', 'Buenas', 'Regulares', 'Malas', 'Muy malas']
        },
        {
          id: 'q4',
          type: 'multiple',
          text: '¿El equipo de cómputo y áreas de estudio funcionaba correctamente?',
          required: true,
          options: ['Muy bien', 'Bien', 'Regular', 'Mal', 'Muy mal', 'No aplica']
        },
        {
          id: 'q5',
          type: 'multiple',
          text: '¿Encontró disponibilidad de espacios o recursos cuando los necesitó?',
          required: true,
          options: ['Siempre', 'Casi siempre', 'A veces', 'Rara vez', 'Nunca']
        },
        {
          id: 'q6',
          type: 'multiple',
          text: '¿Qué tan satisfecho(a) está con los servicios de la Biblioteca?',
          required: true,
          options: ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho', 'Nada satisfecho']
        },
        {
          id: 'q7',
          type: 'open',
          text: '¿Qué aspecto de la Biblioteca consideras que puede mejorar?',
          required: false
        },
        {
          id: 'q8',
          type: 'open',
          text: '¿Deseas agregar algún comentario adicional?',
          required: false
        }
      ],
      enabled: false,
      config: {
        frequency: 'per-use',
        customDays: null,
        showToAll: false,
        maxSkips: 2
      }
    });
    console.log('✅ Encuesta de Biblioteca registrada');

    console.log('');
    console.log('🎉 ¡Todas las encuestas de servicio han sido registradas exitosamente!');
    console.log('');
    console.log('📌 Próximos pasos:');
    console.log('1. Ve a la sección "Encuestas de Servicio" en el panel de administración');
    console.log('2. Configura la frecuencia y habilita las encuestas que desees');
    console.log('3. Las encuestas comenzarán a mostrarse automáticamente a los usuarios');

  } catch (error) {
    console.error('❌ Error al registrar encuestas:', error);
    console.error('Detalles:', error.message);
  }
}

// Instrucciones de uso
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  SCRIPT DE REGISTRO DE ENCUESTAS DE SERVICIO');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('Para ejecutar este script:');
console.log('1. Asegúrate de estar autenticado como administrador');
console.log('2. Verifica que window.appContext esté disponible');
console.log('3. Ejecuta: registerServiceSurveys()');
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
