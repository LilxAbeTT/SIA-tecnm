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
          'Bloque académico y administrativo con oficinas directivas, divisiones académicas y aulas.',
        badges: ['Dirección', 'Aulas', 'Centro de Lenguas'],
        color: '#d73a3a',
        textColor: '#ffffff',
        hotspot: { x: 54.4, y: 60.0 },
        cards: [
          {
            title: 'Planta alta, oficinas de:',
            items: [
              'Dirección General',
              'Dirección Académica',
              'Subdirección Académica',
              'Subdirección de Investigación',
              'Departamento de Difusión y Concertación',
              'Departamento de Desarrollo Académico',
              'Departamento de Calidad',
              'Unidad de Transparencia',
              'Oficina de la División de Contador Público',
              'Aulas de la carrera de Contador Público',
            ],
          },
          {
            title: 'Planta baja:',
            items: [
              'Oficina de la División de Ingeniería en Administración',
              'Aulas de la carrera de Ingeniería en Administración',
            ],
          },
        ],
        featuredServices: [
          'Centro de Lenguas',
          'Centro de Información (Biblioteca)',
          'Baño de mujeres con cambiador de pañales y baño de caballeros',
          'Baños para estudiantes',
          'Baños para usuarios de oficinas',
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
          'Bloque académico de dos niveles donde conviven la División de Sistemas y la División de Turismo.',
        badges: ['Sistemas', 'Turismo', '2 niveles'],
        color: '#2f6fd0',
        textColor: '#ffffff',
        hotspot: { x: 46.6, y: 50.1 },
        cards: [
          {
            title: 'Planta alta:',
            items: [
              'División de Ingeniería en Sistemas Computacionales',
              'Aulas de la carrera de Ingeniería en Sistemas Computacionales',
            ],
          },
          {
            title: 'Planta baja:',
            items: [
              'Oficina de la División de Licenciatura en Turismo',
              'Aulas de la carrera de Licenciatura en Turismo',
            ],
          },
        ],
        featuredServices: ['Baños para damas y caballeros'],
      },
      {
        id: 'V',
        code: 'V',
        shortLabel: 'V',
        title: 'Edificio V',
        stripLabel: 'EDIFICIO "V"',
        zone: 'Sector norte-oriente',
        summary:
          'Concentra servicios administrativos, ventanillas y varios espacios de atención institucional.',
        badges: ['Administración', 'Vinculación', 'Servicios'],
        color: '#a137a9',
        textColor: '#ffffff',
        hotspot: { x: 55.1, y: 47.0 },
        cards: [
          {
            title: 'Edificio de una planta, oficinas de:',
            items: [
              'Subdirección de Servicios Administrativos',
              'Departamento de Servicios Generales',
              'Compras',
              'Departamento de Recursos Financieros',
              'Departamento de Personal',
              'Oficina de Nóminas',
              'Oficina de Prestaciones',
              'Subdirección de Vinculación',
              'Departamento de Vinculación',
              'Departamento de Residencias Profesionales y Servicio Social',
            ],
          },
          {
            title: 'Una planta:',
            items: [
              'Subdirección de Planeación',
              'Departamento de Control Escolar',
              'Departamento de Planeación',
              'Departamento de Estadística',
              'Aula Octaviano Ojeda Villalobos',
              'Aula Centro de Desarrollo de Software',
              'Cubículo: Sindicato (SUPDAITES)',
              'Aula: Centro de Desarrollo de Software',
              'Aula: Ramón Ojeda Mestre',
              'Aula: Rafael Verdugo',
            ],
          },
        ],
        featuredServices: [
          'Ventanilla de Ingresos (Caja)',
          'Ventanilla de Servicios Estudiantiles y de Control Escolar',
          'Oficina de Soporte Técnico',
          'Atención Psicopedagógica',
          'Sala de Lactancia',
          'Atención Médica',
          'Baños: uno para damas con cambiador y uno para caballeros',
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
        summary: 'Espacio destinado a cafetería y servicio de alimentos dentro del campus.',
        badges: ['Cafetería', 'Servicios'],
        color: '#d7d437',
        textColor: '#1f2937',
        hotspot: { x: 56.7, y: 38.7 },
        cards: [
          {
            title: 'Una planta:',
            items: ['Cafetería'],
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
        summary: 'Bloque de talleres especializado para la operación académica de Gastronomía.',
        badges: ['Gastronomía', 'Talleres'],
        color: '#23854a',
        textColor: '#ffffff',
        hotspot: { x: 44.7, y: 27.8 },
        cards: [
          {
            title: 'Una planta:',
            items: ['Talleres de Gastronomía'],
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
          'Agrupa talleres de ingeniería y la División de Electromecánica, además de espacios institucionales anexos.',
        badges: ['Ingenierías', 'Auditorio', 'Química'],
        color: '#b87333',
        textColor: '#ffffff',
        hotspot: { x: 36.7, y: 27.9 },
        cards: [
          {
            title: 'Planta baja:',
            items: ['Talleres de Ingeniería'],
          },
          {
            title: 'Planta alta:',
            items: [
              'Oficina de la División de Ingeniería Electromecánica',
              'Aulas de la carrera de Ingeniería Electromecánica',
            ],
          },
        ],
        featuredServices: [
          'Auditorio Institucional',
          'Laboratorio de Química',
          'Baño adaptado (uso preferente para personas con movilidad reducida)',
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
          'Edificio académico para Arquitectura con oficinas, aulas, talleres y servicios de cómputo.',
        badges: ['Arquitectura', 'Cómputo', 'SIDE'],
        color: '#43a9c7',
        textColor: '#ffffff',
        hotspot: { x: 29.9, y: 35.7 },
        cards: [
          {
            title: 'Planta baja:',
            items: [
              'Oficina de la División de Arquitectura',
              'Oficina de la Coordinación de Talleres y Laboratorio',
              'Oficina de Talleres de Cómputo',
              'Cubículos asignados a docentes sindicalizados',
            ],
          },
          {
            title: 'Planta alta:',
            items: [
              'Aulas de la carrera de Arquitectura',
              'Aula de Ciencias Básicas',
            ],
          },
        ],
        featuredServices: [
          'Salas de cómputo',
          'SIDE',
          'Baño para damas',
          'Baño para caballeros',
        ],
      },
      {
        id: 'TALLER-ING-CIVIL',
        code: 'TC',
        shortLabel: 'T.C.',
        title: 'Taller de Ingeniería Civil',
        stripLabel: 'TALLER DE INGENIERÍA CIVIL',
        zone: 'Costado poniente del Edificio P',
        summary:
          'Taller especializado para prácticas y actividades de la carrera de Ingeniería Civil.',
        badges: ['Taller', 'Ingeniería Civil'],
        color: '#1f9d55',
        textColor: '#ffffff',
        hotspot: { x: 24.7, y: 36.3 },
        cards: [
          {
            title: 'Espacio identificado:',
            items: ['Taller de Ingeniería Civil'],
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
