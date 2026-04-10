if (!window.CampusMapData) {
  window.CampusMapData = (function () {
    const image = Object.freeze({
      src: '/images/campus-map/mapa-ites.png',
      alt: 'Croquis del campus ITES Los Cabos con edificios y accesos.',
    });

    const buildings = Object.freeze([
      {
        id: 'D',
        code: 'D',
        shortLabel: 'D',
        title: 'Edificio D',
        stripLabel: 'EDIFICIO "D"',
        zone: 'Zona central oriente',
        summary:
          'Bloque academico y administrativo con oficinas directivas, divisiones academicas y aulas.',
        badges: ['Direccion', 'Aulas', 'Centro de Lenguas'],
        color: '#d73a3a',
        textColor: '#ffffff',
        hotspot: { x: 54.4, y: 60.0 },
        cards: [
          {
            title: 'Planta alta, oficinas de:',
            items: [
              'Direccion General',
              'Direccion Academica',
              'Subdireccion Academica',
              'Subdireccion de Investigacion',
              'Departamento de Difusion y Concertacion',
              'Departamento de Desarrollo Academico',
              'Departamento de Calidad',
              'Unidad de Transparencia',
              'Oficina de la Division de Contador Publico',
              'Aulas de la carrera de Contador Publico',
            ],
          },
          {
            title: 'Planta baja:',
            items: [
              'Oficina de la Division de Ingenieria en Administracion',
              'Aulas de la carrera de Ingenieria en Administracion',
            ],
          },
        ],
        featuredServices: [
          'Centro de Lenguas',
          'Centro de Informacion (Biblioteca)',
          'Bano de mujeres con cambiador de panales y bano de caballeros',
          'Banos para estudiantes',
          'Banos para usuarios de oficinas',
        ],
      },
      {
        id: 'E',
        code: 'E',
        shortLabel: 'E',
        title: 'Edificio E',
        stripLabel: 'EDIFICIO "E"',
        zone: 'Frente al acceso principal',
        summary:
          'Bloque academico de dos niveles donde conviven la division de Sistemas y la division de Turismo.',
        badges: ['Sistemas', 'Turismo', '2 niveles'],
        color: '#2f6fd0',
        textColor: '#ffffff',
        hotspot: { x: 46.6, y: 50.1 },
        cards: [
          {
            title: 'Planta alta:',
            items: [
              'Division de Ingenieria en Sistemas Computacionales',
              'Aulas de la carrera de Ingenieria en Sistemas Computacionales',
            ],
          },
          {
            title: 'Planta baja:',
            items: [
              'Oficina de la Division de Licenciatura en Turismo',
              'Aulas de la carrera de Licenciatura en Turismo',
            ],
          },
        ],
        featuredServices: ['Banos para damas y caballeros'],
      },
      {
        id: 'V',
        code: 'V',
        shortLabel: 'V',
        title: 'Edificio V',
        stripLabel: 'EDIFICIO "V"',
        zone: 'Sector norte-oriente',
        summary:
          'Concentra servicios administrativos, ventanillas y varios espacios de atencion institucional.',
        badges: ['Administracion', 'Vinculacion', 'Servicios'],
        color: '#a137a9',
        textColor: '#ffffff',
        hotspot: { x: 55.1, y: 47.0 },
        cards: [
          {
            title: 'Edificio de una planta, oficinas de:',
            items: [
              'Subdireccion de Servicios Administrativos',
              'Departamento de Servicios Generales',
              'Compras',
              'Departamento de Recursos Financieros',
              'Departamento de Personal',
              'Oficina de Nominas',
              'Oficina de Prestaciones',
              'Subdireccion de Vinculacion',
              'Departamento de Vinculacion',
              'Departamento de Residencias Profesionales y Servicio Social',
            ],
          },
          {
            title: 'Una planta:',
            items: [
              'Subdireccion de Planeacion',
              'Departamento de Control Escolar',
              'Departamento de Planeacion',
              'Departamento de Estadistica',
              'Aula Octaviano Ojeda Villalobos',
              'Aula Centro de Desarrollo de Software',
              'Cubiculo: Sindicato (SUPDAITES)',
              'Aula: Centro de Desarrollo de Software',
              'Aula: Ramon Ojeda Mestre',
              'Aula: Rafael Verdugo',
            ],
          },
        ],
        featuredServices: [
          'Ventanilla de Ingresos (Caja)',
          'Ventanilla de Servicios Estudiantiles y de Control Escolar',
          'Oficina de Soporte Tecnico',
          'Atencion Psicopedagogica',
          'Sala de Lactancia',
          'Atencion Medica',
          'Banos: uno para damas con cambiador y uno para caballeros',
          'Restaurante-Escuela "Damiana"',
        ],
      },
      {
        id: 'I',
        code: 'I',
        shortLabel: 'I',
        title: 'Edificio I',
        stripLabel: 'EDIFICIO "I"',
        zone: 'Costado norte del Edificio V',
        summary: 'Espacio destinado a cafeteria y servicio de alimentos dentro del campus.',
        badges: ['Cafeteria', 'Servicios'],
        color: '#d7d437',
        textColor: '#1f2937',
        hotspot: { x: 56.7, y: 38.7 },
        cards: [
          {
            title: 'Una planta:',
            items: ['Cafeteria'],
          },
        ],
        featuredServices: [],
      },
      {
        id: 'N',
        code: 'N',
        shortLabel: 'N',
        title: 'Edificio N',
        stripLabel: 'EDIFICIO "N"',
        zone: 'Sector norte, junto a las canchas',
        summary: 'Bloque de talleres especializado para la operacion academica de Gastronomia.',
        badges: ['Gastronomia', 'Talleres'],
        color: '#23854a',
        textColor: '#ffffff',
        hotspot: { x: 44.7, y: 27.8 },
        cards: [
          {
            title: 'Una planta:',
            items: ['Talleres de Gastronomia'],
          },
        ],
        featuredServices: [],
      },
      {
        id: 'O',
        code: 'O',
        shortLabel: 'O',
        title: 'Edificio O',
        stripLabel: 'EDIFICIO "O"',
        zone: 'Sector poniente alto',
        summary:
          'Agrupa talleres de ingenieria y la division de Electromecanica, ademas de espacios institucionales anexos.',
        badges: ['Ingenierias', 'Auditorio', 'Quimica'],
        color: '#b87333',
        textColor: '#ffffff',
        hotspot: { x: 36.7, y: 27.9 },
        cards: [
          {
            title: 'Planta baja:',
            items: ['Talleres de Ingenieria'],
          },
          {
            title: 'Planta alta:',
            items: [
              'Oficina de la Division de Ingenieria Electromecanica',
              'Aulas de la carrera de Ingenieria Electromecanica',
            ],
          },
        ],
        featuredServices: [
          'Auditorio Institucional',
          'Laboratorio de Quimica',
          'Bano adaptado (uso preferente para personas con movilidad reducida)',
        ],
      },
      {
        id: 'P',
        code: 'P',
        shortLabel: 'P',
        title: 'Edificio P',
        stripLabel: 'EDIFICIO "P"',
        zone: 'Sector poniente medio',
        summary:
          'Edificio academico para Arquitectura con oficinas, aulas, talleres y servicios de computo.',
        badges: ['Arquitectura', 'Computo', 'SIDE'],
        color: '#43a9c7',
        textColor: '#ffffff',
        hotspot: { x: 29.9, y: 35.7 },
        cards: [
          {
            title: 'Planta baja:',
            items: [
              'Oficina de la Division de Arquitectura',
              'Oficina de la Coordinacion de Talleres y Laboratorio',
              'Oficina de Talleres de Computo',
              'Cubiculos asignados a docentes sindicalizados',
            ],
          },
          {
            title: 'Planta alta:',
            items: [
              'Aulas de la carrera de Arquitectura',
              'Aula de Ciencias Basicas',
            ],
          },
        ],
        featuredServices: [
          'Salas de computo',
          'SIDE',
          'Bano para damas',
          'Bano para caballeros',
        ],
      },
      {
        id: 'TALLER-ING-CIVIL',
        code: 'TC',
        shortLabel: 'T.C.',
        title: 'Taller de Ingenieria Civil',
        stripLabel: 'TALLER DE INGENIERIA CIVIL',
        zone: 'Costado poniente del Edificio P',
        summary:
          'Taller especializado para practicas y actividades de la carrera de Ingenieria Civil.',
        badges: ['Taller', 'Ingenieria Civil'],
        color: '#1f9d55',
        textColor: '#ffffff',
        hotspot: { x: 24.7, y: 36.3 },
        cards: [
          {
            title: 'Espacio identificado:',
            items: ['Taller de Ingenieria Civil'],
          },
        ],
        featuredServices: [],
      },
    ]);

    const byId = Object.freeze(
      buildings.reduce(function (acc, building) {
        acc[building.id] = building;
        return acc;
      }, {}),
    );

    return Object.freeze({
      image: image,
      buildings: buildings,
      byId: byId,
      defaultBuildingId: 'D',
    });
  })();
}
