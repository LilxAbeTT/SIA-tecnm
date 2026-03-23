(function (root) {
  "use strict";

  function slugify(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const rawCareers = [
    {
      name: "Ingeniería en Sistemas Computacionales",
      semesters: [
        {
          number: 1,
          label: "1er semestre",
          subjects: [
            "Cálculo Diferencial",
            "Fundamentos de Programación",
            "Taller de Ética",
            "Matemáticas Discretas",
            "Taller de Administración",
            "Fundamentos de Investigación",
          ],
        },
        {
          number: 2,
          label: "2do semestre",
          subjects: [
            "Cálculo Integral",
            "Programación Orientada a Objetos",
            "Contabilidad Financiera",
            "Química",
            "Álgebra Lineal",
            "Probabilidad y Estadística",
          ],
        },
        {
          number: 3,
          label: "3er semestre",
          subjects: [
            "Cálculo Vectorial",
            "Estructura de Datos",
            "Cultura Empresarial",
            "Investigación de Operaciones",
            "Sistemas Operativos",
            "Física General",
          ],
        },
        {
          number: 4,
          label: "4to semestre",
          subjects: [
            "Ecuaciones Diferenciales",
            "Métodos Numéricos",
            "Tópicos Avanzados de Programación",
            "Fundamentos de Base de Datos",
            "Taller de Sistemas Operativos",
            "Principios Eléctricos y Aplicaciones Digitales",
          ],
        },
        {
          number: 5,
          label: "5to semestre",
          subjects: [
            "Desarrollo Sustentable",
            "Fundamentos de Telecomunicaciones",
            "Simulación",
            "Taller de Base de Datos",
            "Fundamentos de Ingeniería de Software",
            "Arquitectura de Computadoras",
          ],
        },
        {
          number: 6,
          label: "6to semestre",
          subjects: [
            "Redes de Computadoras",
            "Lenguajes y Autómatas I",
            "Administración de Base de Datos",
            "Lenguajes de Interfaz",
            "Ingeniería de Software",
            "Taller de Investigación I",
          ],
        },
        {
          number: 7,
          label: "7mo semestre",
          subjects: [
            "Conmutación y Enrutamiento de Redes de Datos",
            "Lenguajes y Autómatas II",
            "Graficación",
            "Programación Web",
            "Inteligencia Artificial",
            "Taller de Investigación II",
            "Programación Lógica y Funcional",
            "Sistemas Programables",
          ],
        },
        {
          number: 8,
          label: "8vo semestre",
          subjects: [
            "Administración de Redes",
            "Gestión de Proyectos de Software",
          ],
        },
      ],
    },
    {
      name: "Arquitectura",
      semesters: [
        {
          number: 1,
          label: "1er semestre",
          subjects: [
            "Fundamentos Teóricos del Diseño I",
            "Fundamentos de Investigación",
            "Análisis Proyectual",
            "Geometría Descriptiva I",
            "Análisis Crítico de la Arquitectura y el Arte I",
            "Taller de Expresión Plástica",
          ],
        },
        {
          number: 2,
          label: "2do semestre",
          subjects: [
            "Fundamentos Teóricos del Diseño II",
            "Metodología para el Diseño",
            "Matemáticas Aplicadas a la Arquitectura",
            "Geometría Descriptiva II",
            "Análisis Crítico de la Arquitectura y el Arte II",
            "Taller de Lenguaje Arquitectónico I",
          ],
        },
        {
          number: 3,
          label: "3er semestre",
          subjects: [
            "Taller de Diseño I",
            "Propiedades y Comportamiento de los Materiales",
            "Estructuras I",
            "Topografía",
            "Análisis Crítico de la Arquitectura y el Arte III",
            "Taller de Lenguaje Arquitectónico II",
          ],
        },
        {
          number: 4,
          label: "4to semestre",
          subjects: [
            "Taller de Diseño II",
            "Taller de Construcción I",
            "Estructuras II",
            "Pensamiento Arquitectónico Contemporáneo",
            "Análisis Crítico de la Arquitectura y el Arte IV",
            "Instalaciones I",
          ],
        },
        {
          number: 5,
          label: "5to semestre",
          subjects: [
            "Taller de Diseño III",
            "Taller de Construcción II",
            "Estructuras de Concreto",
            "Desarrollo Sustentable",
            "Estética",
            "Instalaciones II",
          ],
        },
        {
          number: 6,
          label: "6to semestre",
          subjects: [
            "Taller de Diseño IV",
            "Taller de Ética",
            "Estructuras de Acero",
            "Taller de Investigación I",
            "Urbanismo I",
          ],
        },
        {
          number: 7,
          label: "7mo semestre",
          subjects: [
            "Taller de Diseño V",
            "Administración de la Construcción I",
            "Taller de Investigación II",
            "Urbanismo II",
            "Administración de Empresas Constructoras I",
          ],
        },
        {
          number: 8,
          label: "8vo semestre",
          subjects: [
            "Taller de Diseño VI",
            "Administración de la Construcción II",
            "Gestión Urbanística",
            "Administración de Empresas Constructoras II",
          ],
        },
      ],
    },
    {
      name: "Contador Público",
      semesters: [
        {
          number: 1,
          label: "1er semestre",
          subjects: [
            "Introducción a la Contabilidad Financiera",
            "Administración",
            "Álgebra Lineal",
            "Fundamentos de Derecho",
            "Desarrollo Humano",
            "Fundamentos de Investigación",
          ],
        },
        {
          number: 2,
          label: "2do semestre",
          subjects: [
            "Contabilidad Financiera I",
            "Taller de Ética",
            "Cálculo Diferencial e Integral",
            "Derecho Mercantil",
            "Dinámica Social",
            "Estadística Administrativa I",
          ],
        },
        {
          number: 3,
          label: "3er semestre",
          subjects: [
            "Comunicación Humana",
            "Contabilidad Financiera II",
            "Mercadotecnia",
            "Matemáticas Financieras",
            "Derecho Laboral y Seguridad Social",
            "Estadística Administrativa II",
          ],
        },
        {
          number: 4,
          label: "4to semestre",
          subjects: [
            "Desarrollo Sustentable",
            "Fundamentos de Auditoría",
            "Derecho Tributario",
            "Sistemas de Costos Históricos",
            "Gestión del Talento Humano",
            "Contabilidad de Sociedades",
            "Microeconomía",
          ],
        },
        {
          number: 5,
          label: "5to semestre",
          subjects: [
            "Impuestos Personas Morales",
            "Auditoría para Efectos Financieros",
            "Taller de Informática I",
            "Sistemas de Costos Predeterminados",
            "Contabilidad Avanzada",
            "Taller de Investigación I",
            "Macroeconomía",
          ],
        },
        {
          number: 6,
          label: "6to semestre",
          subjects: [
            "Análisis e Interpretación de Estados Financieros",
            "Economía Internacional",
            "Taller de Informática II",
            "Contabilidad Internacional",
            "Impuestos Personas Físicas",
            "Taller de Investigación II",
            "Otros Impuestos y Contribuciones",
          ],
        },
        {
          number: 7,
          label: "7mo semestre",
          subjects: [
            "Elaboración y Evaluación de Proyectos de Inversión",
            "Gestión y Toma de Decisiones",
            "Planeación Financiera",
            "Administración de la Producción y las Operaciones",
            "Auditoría para Efectos Fiscales",
            "Administración Estratégica",
            "Seminario de Contaduría",
            "Alternativas de Inversión y Financiamiento",
          ],
        },
      ],
    },
    {
      name: "Gastronomía",
      semesters: [
        {
          number: 1,
          label: "1er semestre",
          subjects: [
            "Microbiología de los Alimentos",
            "Física en Gastronomía",
            "Introducción a la Gastronomía",
            "Fundamentos de Investigación",
            "Matemáticas para Gastronomía",
            "Software de Aplicación Ejecutivo",
          ],
        },
        {
          number: 2,
          label: "2do semestre",
          subjects: [
            "Higiene en el Manejo de Alimentos y Bebidas",
            "Cultura y Patrimonio Gastronómico Nacional e Internacional",
            "Bases Culinarias",
            "Mercadotecnia",
            "Fundamentos de Gestión Empresarial",
            "Taller de Ética",
          ],
        },
        {
          number: 3,
          label: "3er semestre",
          subjects: [
            "Química y Conservación de los Alimentos",
            "Costos y Manejo de Almacenes",
            "Cocina Mexicana",
            "Probabilidad y Estadística",
            "Gestión del Capital Humano",
            "Fundamentos de Turismo",
          ],
        },
        {
          number: 4,
          label: "4to semestre",
          subjects: [
            "Tecnología de Frutas, Hortalizas y Confitería",
            "Enología y Vitivinicultura",
            "Panadería",
            "Economía Empresarial",
            "Finanzas de las Organizaciones",
            "El Emprendedor y la Innovación",
          ],
        },
        {
          number: 5,
          label: "5to semestre",
          subjects: [
            "Marco Legal de las Organizaciones",
            "Coctelería",
            "Introducción a la Repostería",
            "Investigación de Operaciones",
            "Calidad Aplicada a la Gestión Empresarial",
            "Protocolo de Seguridad",
          ],
        },
        {
          number: 6,
          label: "6to semestre",
          subjects: [
            "Taller de Investigación I",
            "Nutrición y Dietética",
            "Cocina Internacional I",
            "Gestión Estratégica",
            "Banquetes",
            "Estancia Técnica Nacional",
          ],
        },
        {
          number: 7,
          label: "7mo semestre",
          subjects: [
            "Taller de Investigación II",
            "Dirección de Establecimiento de Alimentos y Bebidas",
            "Cocina Internacional II",
            "Escultura en Hielo y Mukimono",
            "Desarrollo Sustentable",
            "Estancia Técnica Internacional",
          ],
        },
        {
          number: 8,
          label: "8vo semestre",
          subjects: [
            "Formulación y Evaluación de Proyectos",
            "Cocina Experimental",
          ],
        },
      ],
    },
    {
      name: "Ingeniería Civil",
      semesters: [
        {
          number: 1,
          label: "1er semestre",
          subjects: [
            "Fundamentos de Investigación",
            "Cálculo Diferencial",
            "Taller de Ética",
            "Química",
            "Software en Ingeniería Civil",
            "Dibujo en Ingeniería Civil",
          ],
        },
        {
          number: 2,
          label: "2do semestre",
          subjects: [
            "Cálculo Vectorial",
            "Cálculo Integral",
            "Geología",
            "Topografía",
            "Materiales y Procesos Constructivos",
            "Probabilidad y Estadística",
          ],
        },
        {
          number: 3,
          label: "3er semestre",
          subjects: [
            "Estática",
            "Ecuaciones Diferenciales",
            "Álgebra Lineal",
            "Carreteras",
            "Tecnología del Concreto",
            "Sistemas de Transporte",
          ],
        },
        {
          number: 4,
          label: "4to semestre",
          subjects: [
            "Dinámica",
            "Métodos Numéricos",
            "Mecánica de Suelos",
            "Maquinaria Pesada y Movimiento de Tierra",
            "Fundamentos de la Mecánica de los Medios Continuos",
            "Modelos de Optimización de Recursos",
          ],
        },
        {
          number: 5,
          label: "5to semestre",
          subjects: [
            "Mecánica de Materiales",
            "Taller de Investigación I",
            "Mecánica de Suelos Aplicada",
            "Costos y Presupuestos",
            "Desarrollo Sustentable",
            "Hidráulica Básica",
          ],
        },
        {
          number: 6,
          label: "6to semestre",
          subjects: [
            "Análisis Estructural",
            "Instalaciones en Edificios",
            "Diseño y Construcción de Pavimentos",
            "Administración de la Construcción",
            "Hidrología Superficial",
            "Hidráulica de Canales",
          ],
        },
        {
          number: 7,
          label: "7mo semestre",
          subjects: [
            "Análisis Estructural Avanzado",
            "Diseño de Elementos de Concreto Reforzado",
            "Taller de Investigación II",
            "Abastecimiento de Agua",
          ],
        },
        {
          number: 8,
          label: "8vo semestre",
          subjects: [
            "Diseño Estructural de Cimentaciones",
            "Diseño de Elementos de Acero",
            "Formulación y Evaluación de Proyectos",
            "Alcantarillado",
          ],
        },
      ],
    },
    {
      name: "Ingeniería Electromecánica",
      semesters: [
        {
          number: 1,
          label: "1er semestre",
          subjects: [
            "Taller de Ética",
            "Cálculo Diferencial",
            "Introducción a la Programación",
            "Desarrollo Sustentable",
            "Química",
            "Fundamentos de Investigación",
          ],
        },
        {
          number: 2,
          label: "2do semestre",
          subjects: [
            "Estática",
            "Cálculo Integral",
            "Álgebra Lineal",
            "Metrología y Normalización",
            "Tecnología de los Materiales",
            "Dibujo Electromecánico",
          ],
        },
        {
          number: 3,
          label: "3er semestre",
          subjects: [
            "Dinámica",
            "Cálculo Vectorial",
            "Procesos de Manufactura",
            "Electricidad y Magnetismo",
            "Mecánica de Materiales",
            "Probabilidad y Estadística",
          ],
        },
        {
          number: 4,
          label: "4to semestre",
          subjects: [
            "Análisis y Síntesis de Mecanismos",
            "Ecuaciones Diferenciales",
            "Termodinámica",
            "Análisis de Circuitos Eléctricos de CD",
            "Mecánica de Fluidos",
            "Electrónica Analógica",
          ],
        },
        {
          number: 5,
          label: "5to semestre",
          subjects: [
            "Diseño de Elementos de Máquina",
            "Diseño e Ingeniería Asistidos por Computadora",
            "Transferencia de Calor",
            "Análisis de Circuitos Eléctricos de CA",
            "Sistemas y Máquinas de Fluidos",
            "Electrónica Digital",
          ],
        },
        {
          number: 6,
          label: "6to semestre",
          subjects: [
            "Máquinas y Equipos Térmicos I",
            "Taller de Investigación I",
            "Ahorro de Energía",
            "Instalaciones Eléctricas",
            "Máquinas Eléctricas",
            "Administración y Técnicas de Mantenimiento",
          ],
        },
        {
          number: 7,
          label: "7mo semestre",
          subjects: [
            "Máquinas y Equipos Térmicos II",
            "Sistemas Eléctricos de Potencia",
            "Controles Eléctricos",
            "Subestaciones Eléctricas",
            "Sistemas Hidráulicos y Neumáticos de Potencia",
            "Ingeniería de Control Clásico",
            "Taller de Investigación II",
          ],
        },
        {
          number: 8,
          label: "8vo semestre",
          subjects: [
            "Refrigeración y Aire Acondicionado",
            "Formulación y Evaluación de Proyectos",
          ],
        },
      ],
    },
    {
      name: "Ingeniería en Administración",
      semesters: [
        {
          number: 1,
          label: "1er semestre",
          subjects: [
            "Diseño Organizacional",
            "Fundamentos de Investigación",
            "Álgebra Lineal",
            "Tecnologías de la Información",
            "Dinámica Social",
            "Entorno a la Innovación",
          ],
        },
        {
          number: 2,
          label: "2do semestre",
          subjects: [
            "Taller de Administración I",
            "Taller de Ética",
            "Cálculo Diferencial",
            "Inglés I",
            "Comportamiento Organizacional",
            "Contabilidad Aplicada a la Ingeniería",
          ],
        },
        {
          number: 3,
          label: "3er semestre",
          subjects: [
            "Taller de Administración II",
            "Estadística I",
            "Cálculo Integral",
            "Inglés II",
            "Gestión Financiera para Proyectos de Innovación",
            "Contabilidad Administrativa",
          ],
        },
        {
          number: 4,
          label: "4to semestre",
          subjects: [
            "Innovación Tecnológica I",
            "Estadística II",
            "Mercadotecnia",
            "Inglés III",
            "Administración Financiera I",
            "Matemáticas Financieras",
          ],
        },
        {
          number: 5,
          label: "5to semestre",
          subjects: [
            "Administración de la Calidad",
            "Administración Financiera II",
            "Mezcla de Mercadotecnia",
            "Inglés IV",
            "Derecho Laboral",
            "Economía",
          ],
        },
        {
          number: 6,
          label: "6to semestre",
          subjects: [
            "Gestión Estratégica",
            "Auditoría Administrativa",
            "Investigación de Operaciones",
            "Inglés V",
            "Capital Humano I",
            "Macroeconomía",
          ],
        },
        {
          number: 7,
          label: "7mo semestre",
          subjects: [
            "Innovación Tecnológica II",
            "Economía Internacional",
            "Administración de la Producción",
            "Inglés VI",
            "Capital Humano II",
            "Análisis de la Problemática Nacional",
          ],
        },
        {
          number: 8,
          label: "8vo semestre",
          subjects: [
            "Mercadotecnia Electrónica",
            "Análisis Estratégico de la Tecnología",
            "Plan de Negocios",
            "Consultoría",
            "TIC's Aplicadas a la Administración",
            "Derecho Fiscal",
          ],
        },
        {
          number: 9,
          label: "9no semestre",
          subjects: [
            "Propiedad Intelectual",
            "Investigación de Mercados",
            "Desarrollo Sustentable",
            "Transferencia y Comercialización de Tecnología",
            "Servicio Social",
          ],
        },
      ],
    },
    {
      name: "Licenciatura en Turismo",
      semesters: [
        {
          number: 1,
          label: "1er semestre",
          subjects: [
            "Fundamentos del Turismo",
            "Administración de Empresas Turísticas",
            "Flora",
            "Matemáticas Aplicadas al Turismo",
            "Fundamentos de Investigación",
            "Taller de Ética",
          ],
        },
        {
          number: 2,
          label: "2do semestre",
          subjects: [
            "Historia del Arte Mexicano",
            "Contabilidad Financiera",
            "Cartografía",
            "Fundamentos de Derecho",
            "Fauna",
            "Seguridad y Supervivencia",
          ],
        },
        {
          number: 3,
          label: "3er semestre",
          subjects: [
            "Socioantropología Turística",
            "Estadística Aplicada al Turismo",
            "Ecología",
            "Meteorología y Climatología",
            "Herramientas Informáticas Administrativas",
            "Turismo de Aventura I",
          ],
        },
        {
          number: 4,
          label: "4to semestre",
          subjects: [
            "Patrimonio Turístico Cultural",
            "Fundamentos de Mercadotecnia Turística",
            "Geomorfología",
            "Turismo de Aventura II",
            "Comunicación y Relaciones Humanas",
            "Manejo de Recursos Naturales e Impacto Ambiental",
          ],
        },
        {
          number: 5,
          label: "5to semestre",
          subjects: [
            "Desarrollo Sustentable",
            "Geografía Turística de México",
            "Ecoturismo I",
            "Economía",
            "Turismo Rural I",
            "Diagnóstico y Evaluación del Sistema Turístico",
          ],
        },
        {
          number: 6,
          label: "6to semestre",
          subjects: [
            "Taller de Investigación I",
            "Marco Legal del Turismo y Protección al Ambiente",
            "Ecoturismo II",
            "Cosmovisión de los Pueblos Originarios",
            "Turismo Rural II",
            "Gestión del Desarrollo Turístico",
          ],
        },
        {
          number: 7,
          label: "7mo semestre",
          subjects: [
            "Taller de Investigación II",
            "Elaboración y Evaluación de Proyectos Turísticos",
            "Mercadotecnia de Servicios Turísticos",
          ],
        },
        {
          number: 8,
          label: "8vo semestre",
          subjects: [
            "Calidad del Servicio al Cliente",
            "Operación de Servicios Turísticos",
          ],
        },
      ],
    },
  ];

  const careerMetaBySlug = {
    "ingenieria-en-sistemas-computacionales": {
      storedName: "Ingeniería en Sistemas Computacionales",
      shortName: "ISC",
      aliases: ["Ing. en Sistemas Computacionales", "Sistemas Computacionales", "ISC"],
    },
    arquitectura: {
      storedName: "Arquitectura",
      shortName: "ARQ",
      aliases: ["ARQ"],
    },
    "contador-publico": {
      storedName: "Contador Público",
      shortName: "CP",
      aliases: ["Contaduria Publica", "Contaduría Pública", "CP"],
    },
    gastronomia: {
      storedName: "Gastronomía",
      shortName: "GASTRO",
      aliases: ["Gastro", "Licenciatura en Gastronomía", "Lic. en Gastronomía"],
    },
    "ingenieria-civil": {
      storedName: "Ingeniería Civil",
      shortName: "IC",
      aliases: ["Ing. Civil", "Civil", "IC"],
    },
    "ingenieria-electromecanica": {
      storedName: "Ingeniería Electromecánica",
      shortName: "IEM",
      aliases: ["Ing. Electromecánica", "Electromecánica", "IEM", "ELEC"],
    },
    "ingenieria-en-administracion": {
      storedName: "Ingeniería en Administración",
      shortName: "IA",
      aliases: ["Ing. en Administración", "Ingeniería Administración", "Administración", "ADM"],
    },
    "licenciatura-en-turismo": {
      storedName: "Turismo",
      shortName: "TUR",
      aliases: ["Licenciatura en Turismo", "Lic. en Turismo", "Turismo"],
    },
  };

  function normalizeText(value) {
    return slugify(value || "").replace(/-/g, " ");
  }

  function uniqueStrings(values) {
    const seen = new Set();
    return values.filter(function (value) {
      const normalized = normalizeText(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function buildSemesterAliases(number, label) {
    return uniqueStrings([
      String(number),
      label,
      number + " semestre",
      number + "o semestre",
      number + "ro semestre",
      number + "do semestre",
      number + "to semestre",
      number + "mo semestre",
    ]);
  }

  const careers = rawCareers.map(function (career, careerIndex) {
    const careerId = slugify(career.name);
    const meta = careerMetaBySlug[careerId] || {};

    return {
      id: careerId,
      slug: careerId,
      name: career.name,
      storedName: meta.storedName || career.name,
      shortName: meta.shortName || "",
      aliases: uniqueStrings([career.name, meta.storedName, meta.shortName].concat(meta.aliases || [])),
      order: careerIndex + 1,
      semesters: career.semesters.map(function (semester) {
        return {
          id: careerId + "-" + semester.number + "-semestre",
          slug: careerId + "-" + semester.number + "-semestre",
          number: semester.number,
          label: semester.label,
          shortLabel: semester.number + "°",
          aliases: buildSemesterAliases(semester.number, semester.label),
          subjects: semester.subjects.map(function (subject) {
            return {
              id: slugify(subject),
              slug: slugify(subject),
              name: subject,
              aliases: uniqueStrings([subject]),
            };
          }),
        };
      }),
    };
  });

  function getCareerById(careerId) {
    return careers.find(function (career) {
      return career.id === careerId || career.slug === careerId;
    }) || null;
  }

  function findCareerByValue(value) {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    return careers.find(function (career) {
      return career.aliases.some(function (alias) {
        return normalizeText(alias) === normalized;
      });
    }) || null;
  }

  function getSemesterByNumber(careerId, semesterNumber) {
    const career = getCareerById(careerId);
    if (!career) {
      return null;
    }

    return career.semesters.find(function (semester) {
      return semester.number === Number(semesterNumber);
    }) || null;
  }

  function findSemester(careerValue, semesterValue) {
    const career = typeof careerValue === "object" && careerValue
      ? careerValue
      : getCareerById(careerValue) || findCareerByValue(careerValue);

    if (!career) return null;

    const numeric = Number(semesterValue);
    if (Number.isFinite(numeric) && numeric > 0) {
      return getSemesterByNumber(career.id, numeric);
    }

    const normalized = normalizeText(semesterValue);
    return career.semesters.find(function (semester) {
      return semester.aliases.some(function (alias) {
        return normalizeText(alias) === normalized;
      });
    }) || null;
  }

  function getSubjectsBySemester(careerId, semesterNumber) {
    const semester = getSemesterByNumber(careerId, semesterNumber);
    return semester ? semester.subjects.slice() : [];
  }

  function findSubject(careerValue, semesterValue, subjectValue) {
    const semester = findSemester(careerValue, semesterValue);
    if (!semester) return null;

    const normalized = normalizeText(subjectValue);
    if (!normalized) return null;

    return semester.subjects.find(function (subject) {
      return subject.aliases.some(function (alias) {
        return normalizeText(alias) === normalized;
      });
    }) || null;
  }

  function getCareerOptions() {
    return careers.map(function (career) {
      return {
        id: career.id,
        slug: career.slug,
        name: career.name,
        storedName: career.storedName,
        shortName: career.shortName,
      };
    });
  }

  const catalog = Object.freeze({
    version: "2026-03-22",
    source: "materias_ITES_Los_Cabos.md",
    institution: "ITES Los Cabos",
    careers: careers,
    normalizeText: normalizeText,
    getCareerById: getCareerById,
    findCareerByValue: findCareerByValue,
    getSemesterByNumber: getSemesterByNumber,
    findSemester: findSemester,
    getSubjectsBySemester: getSubjectsBySemester,
    findSubject: findSubject,
    getCareerOptions: getCareerOptions,
  });

  root.AulaSubjectCatalog = catalog;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = catalog;
  }
})(typeof window !== "undefined" ? window : globalThis);
