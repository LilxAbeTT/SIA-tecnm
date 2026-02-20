
/**
 * DIRECTORIO DE DEPARTAMENTOS Y ROLES OFICIALES
 * Fuente de la verdad para control de acceso y vistas por departamento.
 */

// Compatibilidad: Asignar a window para que funcione con o sin módulos
window.DEPARTMENT_DIRECTORY = {
    // ==========================================
    // DIRECCIÓN Y SUBDIRECCIONES (Aula: Student, Foro: Admin)
    // ==========================================
    'direcciongeneral@loscabos.tecnm.mx': {
        name: 'Tamara Alejandra Montalvo Arce',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'direccionacademica@loscabos.tecnm.mx': {
        name: 'Claudia Díaz Zavala',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'direccionplanvinc@loscabos.tecnm.mx': {
        name: 'José Rubén Cota Manriquez',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'direccioninvestigacion@loscabos.tecnm.mx': {
        name: 'Virginia Berenice Niebla Zatarain',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'subdireccionacademica@loscabos.tecnm.mx': {
        name: 'Miguel Martín Millán Jiménez',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'subdireccionvinculacion@loscabos.tecnm.mx': {
        name: 'Jorge Luis Espinoza Hernández',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'subdireccionadministrativa@loscabos.tecnm.mx': {
        name: 'Ignacio Velázquez Medina',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'subdireccionplaneacion@loscabos.tecnm.mx': {
        name: 'Darisnel Gómez Rodríguez',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },

    // ==========================================
    // DIVISIONES ACADÉMICAS (Aula: Student, Foro: Admin)
    // ==========================================
    'divisionarquitectura@loscabos.tecnm.mx': {
        name: 'Jessica Alcántara Rivera',
        role: 'department_admin',
        permissions: { foro: 'admin' },
        allowedViews: ['view-foro'],
        targetCareers: ['ARQ']
    },
    'divisionacontadorpublico@loscabos.tecnm.mx': {
        name: 'Marco Antonio García Álvarez',
        role: 'department_admin',
        permissions: { foro: 'admin' },
        allowedViews: ['view-foro'],
        targetCareers: ['CON']
    },
    'divisiongastronomia@loscabos.tecnm.mx': {
        name: 'Nelly Ruth Solís Granados',
        role: 'department_admin',
        permissions: { foro: 'admin' },
        allowedViews: ['view-foro'],
        targetCareers: ['GAS']
    },
    'divisioncivil@loscabos.tecnm.mx': {
        name: 'Omar Martínez Cano',
        role: 'department_admin',
        permissions: { foro: 'admin' },
        allowedViews: ['view-foro'],
        targetCareers: ['CIV']
    },
    'divisionelectromecanica@loscabos.tecnm.mx': {
        name: 'Argelia Concepción Bañaga Avilés',
        role: 'department_admin',
        permissions: { foro: 'admin' },
        allowedViews: ['view-foro'],
        targetCareers: ['ELE']
    },
    'divisionadministracion@loscabos.tecnm.mx': {
        name: 'Hisela García Sánchez',
        role: 'department_admin',
        permissions: { foro: 'admin' },
        allowedViews: ['view-foro'],
        targetCareers: ['ADM']
    },
    'divisionsistemas@loscabos.tecnm.mx': {
        name: 'Víctor Manuel Verdugo Mendoza',
        role: 'department_admin',
        permissions: { foro: 'admin' },
        allowedViews: ['view-foro'],
        targetCareers: ['ISC']
    },
    'divisionturismo@loscabos.tecnm.mx': {
        name: 'Fermín Hernández Mendoza',
        role: 'department_admin',
        permissions: { foro: 'admin' },
        allowedViews: ['view-foro'],
        targetCareers: ['TUR']
    },
    // ==========================================
    // DEPARTAMENTOS DE SOPORTE Y GESTIÓN
    // ==========================================
    'desarrolloacademico@loscabos.tecnm.mx': {
        name: 'Dulce Lucia Palacios Márquez',
        role: 'department_admin',
        permissions: { reportes: 'admin' },
        allowedViews: ['view-reportes']
    },
    'extraescolares@loscabos.tecnm.mx': {
        name: 'Departamento de Vinculación',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'vinculacion@loscabos.tecnm.mx': {
        name: 'Departamento de Vinculación',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'difusion@loscabos.tecnm.mx': {
        name: 'Nallely Guillermina Castillo Avilés',
        role: 'department_admin',
        permissions: { foro: 'superadmin', avisos: 'admin' },
        allowedViews: ['view-dashboard', 'view-foro']
    },
    'residenciasyserviciosocial@loscabos.tecnm.mx': {
        name: 'Norma Agúndez Pimentel',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'planeacionyprogramacion@loscabos.tecnm.mx': {
        name: 'Aranza Linares Arce',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'estadisticayevaluacion@loscabos.tecnm.mx': {
        name: 'Francisca Marañón Valle',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'serviciosescolares@loscabos.tecnm.mx': {
        name: 'Estrella Espinoza López',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'departamentopersonal@loscabos.tecnm.mx': {
        name: 'Mayra Lidia Rojas Cozar',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'recursosfinancieros@loscabos.tecnm.mx': {
        name: 'Leodegario Landín Lucero',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'serviciosgenerales@loscabos.tecnm.mx': {
        name: 'Perla Daniela Benítez Cárdenas',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'transparencia@loscabos.tecnm.mx': {
        name: 'Adriana Reyes Roldán',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'calidad@loscabos.tecnm.mx': {
        name: 'Ileana López Zavala',
        role: 'department_admin',
        permissions: { lactario: 'admin', quejas: 'admin', encuestas: 'admin' },
        allowedViews: ['view-lactario', 'view-quejas', 'view-encuestas']
    },
    'centrodelenguas@loscabos.tecnm.mx': {
        name: 'Patricia Piña Villarreal',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'titulacion@loscabos.tecnm.mx': {
        name: 'Blanca Estela Calleja Valente',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'becas@loscabos.tecnm.mx': {
        name: 'Verónica Cota Montaño',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },
    'tutorias@loscabos.tecnm.mx': {
        name: 'Paula Lorenzo Victoriano',
        role: 'department_admin',
        permissions: { aula: 'student', foro: 'admin' },
        allowedViews: ['view-aula', 'view-foro']
    },

    // ==========================================
    // ESPECIALES: PSICOLOGÍA Y BIBLIOTECA
    // ==========================================
    'atencionpsicopedagogica@loscabos.tecnm.mx': {
        name: 'Atención Psicopedagógica',
        role: 'medico',
        specialty: 'psicologo',
        permissions: { medi: 'psicologo' },
        allowedViews: ['view-medi']
    },

    'atencionmedica@loscabos.tecnm.mx': {
        name: 'Atención Médica',
        role: 'medico',
        specialty: 'medico',
        permissions: { medi: 'medico' },
        allowedViews: ['view-medi']
    },

    'biblioteca@loscabos.tecnm.mx': {
        name: 'Biblioteca Escolar',
        role: 'biblio',
        permissions: { biblio: 'biblio' },
        allowedViews: ['view-biblio']
    },
};
