const fs = require('fs');

const path = 'public/data/evaluatec-2026-content.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const newExamples = {
  "matematicas": {
    "aritmetica": [
      {
        "level": "básico",
        "problem": "Un granjero tiene 120 manzanas y vende 3/4 partes. ¿Cuántas manzanas le quedan?",
        "steps": [
          "Calcula 3/4 de 120: (120 / 4) * 3 = 90 manzanas vendidas.",
          "Resta las vendidas al total: 120 - 90 = 30.",
          "Comprueba: 90 + 30 = 120."
        ],
        "answer": "30 manzanas",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "Resuelve la siguiente operación respetando la jerarquía: 5 + 3 * (8 - 2) / 2",
        "steps": [
          "Primero resuelve el paréntesis: (8 - 2) = 6.",
          "Luego multiplica y divide de izquierda a derecha: 3 * 6 = 18, y 18 / 2 = 9.",
          "Por último suma: 5 + 9 = 14."
        ],
        "answer": "14",
        "source": "didactico-sia"
      }
    ],
    "algebra": [
      {
        "level": "básico",
        "problem": "Simplifica la expresión: 3x + 4y - x + 2y",
        "steps": [
          "Agrupa términos semejantes: (3x - x) y (4y + 2y).",
          "Resuelve las operaciones: 2x y 6y.",
          "Une los términos: 2x + 6y."
        ],
        "answer": "2x + 6y",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "Factoriza el siguiente trinomio cuadrado perfecto: x² + 10x + 25",
        "steps": [
          "Verifica si los extremos tienen raíz exacta: raíz de x² es x, raíz de 25 es 5.",
          "Verifica si el doble producto coincide con el término central: 2 * x * 5 = 10x.",
          "Escribe el binomio al cuadrado con el signo del término central: (x + 5)²."
        ],
        "answer": "(x + 5)²",
        "source": "didactico-sia"
      }
    ],
    "geometria-analitica": [
      {
        "level": "básico",
        "problem": "Encuentra la distancia entre los puntos A(0, 0) y B(3, 4).",
        "steps": [
          "Aplica la fórmula de distancia: d = √( (x2 - x1)² + (y2 - y1)² ).",
          "Sustituye los valores: d = √( (3 - 0)² + (4 - 0)² ) = √( 9 + 16 ).",
          "Calcula la raíz cuadrada de 25, que es 5."
        ],
        "answer": "5",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "¿Cuál es la pendiente de la recta que pasa por (1, 2) y (3, 8)?",
        "steps": [
          "Usa la fórmula de pendiente: m = (y2 - y1) / (x2 - x1).",
          "Sustituye los valores: m = (8 - 2) / (3 - 1).",
          "Realiza las operaciones: m = 6 / 2 = 3."
        ],
        "answer": "3",
        "source": "didactico-sia"
      }
    ],
    "trigonometria": [
      {
        "level": "básico",
        "problem": "En un triángulo rectángulo, si el cateto opuesto mide 3 y la hipotenusa 5, ¿cuánto vale el seno del ángulo?",
        "steps": [
          "Recuerda que Seno = Cateto Opuesto / Hipotenusa.",
          "Identifica los valores dados: Opuesto = 3, Hipotenusa = 5.",
          "Sustituye: Seno = 3 / 5."
        ],
        "answer": "3/5",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "Convierte 90 grados a radianes.",
        "steps": [
          "Recuerda la equivalencia: 180 grados = π radianes.",
          "Aplica una regla de tres: (90 * π) / 180.",
          "Simplifica la fracción: 90/180 es igual a 1/2.",
          "El resultado es π/2 radianes."
        ],
        "answer": "π/2 radianes",
        "source": "didactico-sia"
      }
    ],
    "geometria": [
      {
        "level": "básico",
        "problem": "¿Cuál es el área de un círculo cuyo radio es 4 cm?",
        "steps": [
          "Usa la fórmula del área del círculo: A = π * r².",
          "Sustituye el valor del radio: A = π * (4)².",
          "Calcula el cuadrado: 16π cm²."
        ],
        "answer": "16π cm²",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "Si los dos ángulos interiores de un triángulo miden 40° y 60°, ¿cuánto mide el tercer ángulo?",
        "steps": [
          "Recuerda que la suma de ángulos internos de un triángulo es siempre 180°.",
          "Suma los ángulos conocidos: 40 + 60 = 100°.",
          "Resta a 180 para obtener el tercero: 180 - 100 = 80°."
        ],
        "answer": "80°",
        "source": "didactico-sia"
      }
    ],
    "patrones": [
      {
        "level": "básico",
        "problem": "¿Qué número sigue en la serie: 2, 4, 8, 16, ...?",
        "steps": [
          "Observa la diferencia o razón entre cada número.",
          "Nota que cada número es el doble del anterior (2*2=4, 4*2=8...).",
          "Multiplica 16 por 2 para hallar el siguiente: 32."
        ],
        "answer": "32",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "Si A = 1, B = 2, C = 3, ¿qué valor tiene la palabra 'CAMA'?",
        "steps": [
          "Asigna a cada letra su valor numérico en el abecedario (A=1, M=13, C=3).",
          "La secuencia de valores es: 3, 1, 13, 1.",
          "Suma los valores: 3 + 1 + 13 + 1 = 18."
        ],
        "answer": "18",
        "source": "didactico-sia"
      }
    ],
    "calculo": [
      {
        "level": "básico",
        "problem": "Encuentra la derivada de f(x) = 3x².",
        "steps": [
          "Aplica la regla de la potencia: d/dx [x^n] = n * x^(n-1).",
          "Multiplica el coeficiente por el exponente: 3 * 2 = 6.",
          "Resta 1 al exponente: x^(2-1) = x.",
          "La derivada es 6x."
        ],
        "answer": "6x",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "Calcula la integral indefinida de f(x) = 2x.",
        "steps": [
          "Aplica la regla de la potencia para integrales: ∫ x^n dx = (x^(n+1))/(n+1).",
          "Aumenta el exponente en 1: x².",
          "Divide entre el nuevo exponente: (2x²) / 2 = x².",
          "Agrega la constante de integración C."
        ],
        "answer": "x² + C",
        "source": "didactico-sia"
      }
    ]
  },
  "comprension-lectora": {
    "categorias-gramaticales": [
      {
        "level": "básico",
        "problem": "Identifica el adjetivo en: 'El perro negro corre rápido'.",
        "steps": [
          "Busca la palabra que describe o califica al sustantivo ('perro').",
          "La palabra 'negro' indica una característica del perro.",
          "Por lo tanto, 'negro' es el adjetivo."
        ],
        "answer": "negro",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "¿Cuál es la función de 'rápidamente' en la oración 'Ella corrió rápidamente'?",
        "steps": [
          "Analiza qué palabra está siendo modificada: está modificando al verbo 'corrió'.",
          "Las palabras que modifican a verbos, adjetivos u otros adverbios son adverbios.",
          "Indica el modo en que ocurrió la acción."
        ],
        "answer": "Es un adverbio de modo",
        "source": "didactico-sia"
      }
    ],
    "ortografia": [
      {
        "level": "básico",
        "problem": "¿Por qué la palabra 'canción' lleva tilde?",
        "steps": [
          "Divide en sílabas: can-ción. La sílaba tónica es la última.",
          "Es una palabra aguda.",
          "Las agudas llevan tilde cuando terminan en 'n', 's' o vocal."
        ],
        "answer": "Porque es aguda terminada en 'n'",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "Elige la opción correcta: 'El joven tomó el (baso/vaso) de agua'.",
        "steps": [
          "Recuerda que 'baso' con B proviene del verbo basar o del órgano bazo (si es con Z).",
          "La palabra 'vaso' con V se refiere al recipiente para líquidos.",
          "Por contexto, se refiere al recipiente."
        ],
        "answer": "vaso",
        "source": "didactico-sia"
      }
    ],
    "relaciones-semanticas": [
      {
        "level": "básico",
        "problem": "¿Cuál es un sinónimo de 'efímero'?",
        "steps": [
          "Define efímero: que dura muy poco tiempo.",
          "Piensa en palabras con significado similar.",
          "Fugaz, pasajero, breve son buenas opciones."
        ],
        "answer": "Fugaz",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "¿Qué relación existe entre 'caliente' y 'frío'?",
        "steps": [
          "Analiza el significado de ambas palabras: representan extremos opuestos de temperatura.",
          "Las palabras con significados opuestos se llaman antónimos."
        ],
        "answer": "Son antónimos",
        "source": "didactico-sia"
      }
    ],
    "logica-textual": [
      {
        "level": "básico",
        "problem": "Si 'Todos los perros ladran' y 'Max es un perro', ¿qué podemos deducir?",
        "steps": [
          "Establece la premisa mayor: Todo perro ladra.",
          "Establece la premisa menor: Max pertenece a la categoría perro.",
          "Conclusión lógica: Max tiene las propiedades de su categoría."
        ],
        "answer": "Max ladra",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "Identifica el conector lógico en: 'Quería salir, sin embargo, llovía'.",
        "steps": [
          "Busca la palabra o frase que une las dos ideas.",
          "La primera idea expresa un deseo, la segunda un obstáculo.",
          "El término 'sin embargo' funciona como conector de oposición o contraste."
        ],
        "answer": "sin embargo",
        "source": "didactico-sia"
      }
    ],
    "mensaje-texto": [
      {
        "level": "básico",
        "problem": "Lee el siguiente fragmento: 'El reciclaje no es una opción, es una necesidad para salvar nuestro hogar'. ¿Cuál es el mensaje principal?",
        "steps": [
          "Identifica el tema: el reciclaje.",
          "Analiza la intención: enfatizar que es obligatorio (necesidad) para el planeta (hogar).",
          "Sintetiza la idea: el reciclaje es indispensable para el planeta."
        ],
        "answer": "El reciclaje es indispensable para salvar el planeta",
        "source": "didactico-sia"
      },
      {
        "level": "medio",
        "problem": "¿Qué tono utiliza el autor en la frase: '¡Claro, qué brillante idea tuviste al dejar las llaves dentro del auto!'?",
        "steps": [
          "Observa los signos de exclamación y la expresión 'brillante idea'.",
          "Contextualiza: dejar las llaves dentro del auto es un error.",
          "Alabar un error es una figura retórica llamada ironía."
        ],
        "answer": "Irónico / Sarcástico",
        "source": "didactico-sia"
      }
    ]
  }
};

let addedCount = 0;

data.areas.forEach(area => {
  if (newExamples[area.id]) {
    area.topics.forEach(topic => {
      if (newExamples[area.id][topic.id]) {
        if (!topic.solvedExamples) {
          topic.solvedExamples = topic.solvedExample ? [topic.solvedExample] : [];
        }
        topic.solvedExamples = [...topic.solvedExamples, ...newExamples[area.id][topic.id]];
        addedCount += newExamples[area.id][topic.id].length;
      }
    });
  }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
