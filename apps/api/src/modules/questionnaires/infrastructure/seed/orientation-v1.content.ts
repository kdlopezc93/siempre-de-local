// GENERADO por apps/api/scripts/extract-prototype-content.mjs desde docs/prototipo/detector-posicion.jsx.
// No editar a mano: el contenido publicado es inmutable; los cambios van en una versión nueva.
import type { OrientationContent } from '../../application/orientation-content.js';

export const ORIENTATION_V1: OrientationContent = {
  "label": "v1",
  "positionItemsPerAttempt": 15,
  "positionItems": [
    {
      "code": "p1",
      "context": "situation",
      "text": "Tu equipo saca de puerta y el rival presiona arriba. ¿Qué haces?",
      "options": [
        {
          "label": "Pido el balón entre los centrales para iniciar el juego",
          "points": {
            "MCD": 3,
            "MC": 2,
            "DFC": 1
          }
        },
        {
          "label": "Bajo como central a recibir y saco jugado",
          "points": {
            "DFC": 3,
            "MCD": 1
          }
        },
        {
          "label": "Me abro a la banda para ofrecer una línea de pase",
          "points": {
            "LAT": 3,
            "EXT": 2
          }
        },
        {
          "label": "Ataco el espacio a la espalda para un balón largo",
          "points": {
            "DC": 3,
            "EXT": 2
          }
        }
      ]
    },
    {
      "code": "p2",
      "context": "situation",
      "text": "Recuperas el balón dentro de tu propia área. Primera reacción:",
      "options": [
        {
          "label": "Despejo con seguridad sin arriesgar",
          "points": {
            "DFC": 3,
            "POR": 1
          }
        },
        {
          "label": "Conduzco unos metros y busco al lateral",
          "points": {
            "DFC": 2,
            "MCD": 2
          }
        },
        {
          "label": "Toco corto al pivote para empezar a jugar",
          "points": {
            "MCD": 3,
            "MC": 1
          }
        },
        {
          "label": "Abro rápido a la banda para salir del área",
          "points": {
            "LAT": 3
          }
        }
      ]
    },
    {
      "code": "p3",
      "context": "situation",
      "text": "Contraataque a favor y corres al espacio. ¿Dónde te sientes mejor?",
      "options": [
        {
          "label": "Rematando en el punto de penalti",
          "points": {
            "DC": 4
          }
        },
        {
          "label": "Desbordando por fuera para el centro",
          "points": {
            "EXT": 4
          }
        },
        {
          "label": "Llegando desde segunda línea para rematar",
          "points": {
            "MP": 3,
            "MC": 2
          }
        },
        {
          "label": "Ordenando el ataque y dando el último pase",
          "points": {
            "MP": 4
          }
        }
      ]
    },
    {
      "code": "p4",
      "context": "attribute",
      "text": "Tu mayor virtud física es:",
      "options": [
        {
          "label": "Reflejos y juego con las manos",
          "points": {
            "POR": 5
          }
        },
        {
          "label": "Fuerza y juego aéreo",
          "points": {
            "DFC": 3,
            "DC": 2
          }
        },
        {
          "label": "Velocidad punta",
          "points": {
            "EXT": 3,
            "LAT": 2
          }
        },
        {
          "label": "Resistencia para cubrir todo el campo",
          "points": {
            "MC": 3,
            "MCD": 1
          }
        }
      ]
    },
    {
      "code": "p5",
      "context": "situation",
      "text": "Un extremo rapidísimo te encara en el uno contra uno. Tú:",
      "options": [
        {
          "label": "Aguanto la posición y no me tiro al suelo",
          "points": {
            "DFC": 2,
            "LAT": 3
          }
        },
        {
          "label": "Le meto intensidad y robo antes de que arranque",
          "points": {
            "LAT": 3,
            "MCD": 1
          }
        },
        {
          "label": "Cierro el interior y le mando hacia la línea",
          "points": {
            "DFC": 3
          }
        },
        {
          "label": "Espero cobertura y no me lanzo solo",
          "points": {
            "LAT": 2,
            "DFC": 2
          }
        }
      ]
    },
    {
      "code": "p6",
      "context": "situation",
      "text": "El partido se complica y el equipo se desordena. Tu reacción natural es:",
      "options": [
        {
          "label": "Reorganizo a la defensa y doy órdenes desde atrás",
          "points": {
            "DFC": 2,
            "POR": 3
          }
        },
        {
          "label": "Pido el balón y bajo el ritmo para calmar el juego",
          "points": {
            "MCD": 3,
            "MC": 2
          }
        },
        {
          "label": "Busco una jugada individual que cambie el partido",
          "points": {
            "DC": 2,
            "MP": 2,
            "EXT": 1
          }
        },
        {
          "label": "Presiono arriba para forzar un error y reactivar al equipo",
          "points": {
            "EXT": 2,
            "DC": 1,
            "MC": 1
          }
        }
      ]
    },
    {
      "code": "p7",
      "context": "situation",
      "text": "Tu equipo domina pero no encuentra el gol. Tu aporte ideal:",
      "options": [
        {
          "label": "Un pase filtrado que rompe líneas",
          "points": {
            "MP": 4,
            "MC": 1
          }
        },
        {
          "label": "Un desborde y centro por banda",
          "points": {
            "EXT": 4
          }
        },
        {
          "label": "Una llegada al área para rematar",
          "points": {
            "DC": 3,
            "MP": 1
          }
        },
        {
          "label": "Recuperar rápido arriba para insistir",
          "points": {
            "EXT": 2,
            "MC": 2
          }
        }
      ]
    },
    {
      "code": "p8",
      "context": "attribute",
      "text": "¿Qué disfrutas más dentro del campo?",
      "options": [
        {
          "label": "Evitar goles",
          "points": {
            "POR": 3,
            "DFC": 3
          }
        },
        {
          "label": "Repartir juego",
          "points": {
            "MCD": 2,
            "MC": 3
          }
        },
        {
          "label": "Crear ocasiones",
          "points": {
            "MP": 4
          }
        },
        {
          "label": "Marcar goles",
          "points": {
            "DC": 4,
            "EXT": 1
          }
        }
      ]
    },
    {
      "code": "p9",
      "context": "situation",
      "text": "Falta lateral a favor cerca del área. Tú normalmente…",
      "options": [
        {
          "label": "Voy al primer palo a rematar de cabeza",
          "points": {
            "DFC": 2,
            "DC": 3
          }
        },
        {
          "label": "La lanzo yo con precisión",
          "points": {
            "MP": 2,
            "MCD": 2,
            "LAT": 1
          }
        },
        {
          "label": "Espero el rechace fuera del área",
          "points": {
            "MC": 2,
            "MCD": 2
          }
        },
        {
          "label": "Ataco el segundo palo",
          "points": {
            "DC": 2,
            "EXT": 2
          }
        }
      ]
    },
    {
      "code": "p10",
      "context": "attribute",
      "text": "Tu punto fuerte con el balón en los pies es:",
      "options": [
        {
          "label": "Salida limpia y saque en largo",
          "points": {
            "POR": 3,
            "DFC": 1
          }
        },
        {
          "label": "Pase largo cambiando la orientación",
          "points": {
            "MCD": 3,
            "MC": 1
          }
        },
        {
          "label": "Regate en espacios cortos",
          "points": {
            "EXT": 3,
            "MP": 2
          }
        },
        {
          "label": "Definición de cara a puerta",
          "points": {
            "DC": 4
          }
        }
      ]
    },
    {
      "code": "p11",
      "context": "situation",
      "text": "Pierdes el balón en campo rival. Tu primera acción:",
      "options": [
        {
          "label": "Presiono de inmediato para recuperar",
          "points": {
            "EXT": 2,
            "DC": 2,
            "MC": 1
          }
        },
        {
          "label": "Vuelvo a mi posición de forma ordenada",
          "points": {
            "MCD": 2,
            "DFC": 1,
            "LAT": 1
          }
        },
        {
          "label": "Cierro el pase interior más peligroso",
          "points": {
            "MCD": 3,
            "MC": 1
          }
        },
        {
          "label": "Aviso y coloco a mis compañeros",
          "points": {
            "DFC": 2,
            "POR": 2
          }
        }
      ]
    },
    {
      "code": "p12",
      "context": "attribute",
      "text": "¿Cómo defines tu carácter en el campo?",
      "options": [
        {
          "label": "Sereno y seguro bajo presión",
          "points": {
            "POR": 4,
            "DFC": 1
          }
        },
        {
          "label": "Sólido y contundente",
          "points": {
            "DFC": 4
          }
        },
        {
          "label": "Inteligente y con visión",
          "points": {
            "MP": 3,
            "MCD": 2
          }
        },
        {
          "label": "Atrevido y desequilibrante",
          "points": {
            "EXT": 3,
            "DC": 1
          }
        }
      ]
    },
    {
      "code": "p13",
      "context": "situation",
      "text": "El equipo defiende un 1-0 en el minuto 90. Tú estás:",
      "options": [
        {
          "label": "Despejando todo lo que entra en mi área",
          "points": {
            "DFC": 3,
            "POR": 2
          }
        },
        {
          "label": "Sujetando el balón en la esquina para gastar tiempo",
          "points": {
            "EXT": 2,
            "DC": 2
          }
        },
        {
          "label": "Cortando cada avance en el centro del campo",
          "points": {
            "MCD": 3,
            "MC": 1
          }
        },
        {
          "label": "Bajando a ayudar aunque juegue arriba",
          "points": {
            "MC": 2,
            "MP": 1,
            "LAT": 1
          }
        }
      ]
    },
    {
      "code": "p14",
      "context": "attribute",
      "text": "Prefieres un partido en el que…",
      "options": [
        {
          "label": "No te llegue casi nada pero mantengas la portería a cero",
          "points": {
            "POR": 4
          }
        },
        {
          "label": "Tengas que ganar muchos duelos",
          "points": {
            "DFC": 3,
            "MCD": 1
          }
        },
        {
          "label": "Toques mucho el balón y dirijas",
          "points": {
            "MCD": 2,
            "MC": 3
          }
        },
        {
          "label": "Tengas libertad para inventar",
          "points": {
            "MP": 4,
            "EXT": 1
          }
        }
      ]
    },
    {
      "code": "p15",
      "context": "situation",
      "text": "Tu lateral sube al ataque y deja un hueco a su espalda. Tú:",
      "options": [
        {
          "label": "Me cierro para tapar su espalda",
          "points": {
            "DFC": 3,
            "MCD": 2
          }
        },
        {
          "label": "Cubro yo la banda temporalmente",
          "points": {
            "LAT": 3,
            "MC": 1
          }
        },
        {
          "label": "Sigo mi posición, no es mi tarea",
          "points": {
            "DC": 2,
            "MP": 2
          }
        },
        {
          "label": "Bajo desde el medio a equilibrar",
          "points": {
            "MCD": 2,
            "MC": 2
          }
        }
      ]
    },
    {
      "code": "p16",
      "context": "attribute",
      "text": "Tu relación con el gol es:",
      "options": [
        {
          "label": "Casi nunca marco, no es mi función",
          "points": {
            "POR": 3,
            "DFC": 2
          }
        },
        {
          "label": "Marco de vez en cuando, sobre todo de cabeza",
          "points": {
            "DFC": 2,
            "DC": 1
          }
        },
        {
          "label": "Doy más asistencias que goles",
          "points": {
            "MP": 3,
            "EXT": 2
          }
        },
        {
          "label": "Vivo para marcar",
          "points": {
            "DC": 4
          }
        }
      ]
    },
    {
      "code": "p17",
      "context": "situation",
      "text": "Tienes ventaja en un dos contra uno. Prefieres:",
      "options": [
        {
          "label": "Ser quien da el pase decisivo",
          "points": {
            "MP": 3,
            "MC": 1
          }
        },
        {
          "label": "Ser quien recibe y define",
          "points": {
            "DC": 3,
            "EXT": 1
          }
        },
        {
          "label": "Arrastrar al defensa para liberar a un compañero",
          "points": {
            "EXT": 2,
            "DC": 1
          }
        },
        {
          "label": "No forzar y asegurar la posesión",
          "points": {
            "MCD": 2,
            "MC": 2
          }
        }
      ]
    },
    {
      "code": "p18",
      "context": "attribute",
      "text": "Tu zona natural del campo es:",
      "options": [
        {
          "label": "Bajo palos",
          "points": {
            "POR": 5
          }
        },
        {
          "label": "La última línea defensiva",
          "points": {
            "DFC": 3,
            "LAT": 2
          }
        },
        {
          "label": "El corazón del mediocampo",
          "points": {
            "MCD": 3,
            "MC": 3
          }
        },
        {
          "label": "El último tercio ofensivo",
          "points": {
            "DC": 3,
            "MP": 2,
            "EXT": 2
          }
        }
      ]
    },
    {
      "code": "p19",
      "context": "situation",
      "text": "El rival presiona tu salida de balón. La solución que ves primero:",
      "options": [
        {
          "label": "Jugar en corto y con paciencia aunque haya riesgo",
          "points": {
            "MCD": 3,
            "DFC": 1
          }
        },
        {
          "label": "Un balón largo directo al delantero",
          "points": {
            "POR": 2,
            "DC": 2
          }
        },
        {
          "label": "Buscar al lateral libre para progresar",
          "points": {
            "LAT": 3,
            "MC": 1
          }
        },
        {
          "label": "Un pase entre líneas al mediapunta",
          "points": {
            "MP": 3,
            "MC": 1
          }
        }
      ]
    },
    {
      "code": "p20",
      "context": "attribute",
      "text": "Lo que más entrenas por tu cuenta es:",
      "options": [
        {
          "label": "Paradas y colocación",
          "points": {
            "POR": 5
          }
        },
        {
          "label": "Marcaje, anticipación y despeje",
          "points": {
            "DFC": 3
          }
        },
        {
          "label": "Pase, control y visión de juego",
          "points": {
            "MC": 3,
            "MCD": 2
          }
        },
        {
          "label": "Regate, velocidad y centro",
          "points": {
            "EXT": 3
          }
        }
      ]
    },
    {
      "code": "p21",
      "context": "situation",
      "text": "Córner a favor, ¿dónde apareces?",
      "options": [
        {
          "label": "Me quedo atrás por si hay contraataque",
          "points": {
            "MCD": 2,
            "DFC": 2,
            "LAT": 1
          }
        },
        {
          "label": "Salto al área a rematar de cabeza",
          "points": {
            "DFC": 2,
            "DC": 3
          }
        },
        {
          "label": "Al borde del área para cazar el rechace",
          "points": {
            "MC": 2,
            "MP": 2
          }
        },
        {
          "label": "Lo saco yo con precisión",
          "points": {
            "MP": 2,
            "EXT": 2
          }
        }
      ]
    },
    {
      "code": "p22",
      "context": "attribute",
      "text": "Si describieras tu juego en una palabra sería:",
      "options": [
        {
          "label": "Seguridad",
          "points": {
            "POR": 3,
            "DFC": 2
          }
        },
        {
          "label": "Equilibrio",
          "points": {
            "MCD": 3,
            "MC": 2
          }
        },
        {
          "label": "Creatividad",
          "points": {
            "MP": 4
          }
        },
        {
          "label": "Definición",
          "points": {
            "DC": 4
          }
        }
      ]
    },
    {
      "code": "p23",
      "context": "situation",
      "text": "El rival juega en largo y el balón cae en tierra de nadie entre tú y un delantero. Tú:",
      "options": [
        {
          "label": "Salto y gano el duelo aéreo para despejar",
          "points": {
            "DFC": 3,
            "POR": 1
          }
        },
        {
          "label": "Bajo el balón de pecho y saco jugado",
          "points": {
            "DFC": 2,
            "MCD": 2
          }
        },
        {
          "label": "Corro a disputarlo y tapo la caída",
          "points": {
            "MCD": 2,
            "MC": 2
          }
        },
        {
          "label": "Me anticipo saliendo desde la portería",
          "points": {
            "POR": 4
          }
        }
      ]
    },
    {
      "code": "p24",
      "context": "situation",
      "text": "Tienes el balón en la banda con espacio por delante. Tu primer pensamiento:",
      "options": [
        {
          "label": "Conduzco a toda velocidad para desbordar",
          "points": {
            "EXT": 4
          }
        },
        {
          "label": "Levanto la cabeza y busco un centro al área",
          "points": {
            "EXT": 2,
            "LAT": 2
          }
        },
        {
          "label": "La aguanto y espero que suba mi lateral",
          "points": {
            "EXT": 2,
            "MP": 1
          }
        },
        {
          "label": "Me la llevo hacia dentro para asociarme",
          "points": {
            "MP": 2,
            "MC": 2
          }
        }
      ]
    },
    {
      "code": "p25",
      "context": "situation",
      "text": "Tu equipo recupera y arranca un ataque rápido. Tu primer movimiento:",
      "options": [
        {
          "label": "Ataco la espalda de la defensa buscando el pase",
          "points": {
            "DC": 3,
            "EXT": 1
          }
        },
        {
          "label": "Abro la banda para dar amplitud",
          "points": {
            "EXT": 3,
            "LAT": 1
          }
        },
        {
          "label": "Me ofrezco entre líneas para recibir de cara",
          "points": {
            "MP": 3,
            "MC": 1
          }
        },
        {
          "label": "Acompaño la jugada por si hay que reciclar el balón",
          "points": {
            "MCD": 2,
            "MC": 2
          }
        }
      ]
    },
    {
      "code": "p26",
      "context": "attribute",
      "text": "Tu mejor cualidad mental en el campo es:",
      "options": [
        {
          "label": "La concentración para no fallar en un despiste",
          "points": {
            "POR": 3,
            "DFC": 2
          }
        },
        {
          "label": "La lectura del juego para anticiparte",
          "points": {
            "DFC": 2,
            "MCD": 2
          }
        },
        {
          "label": "La visión para encontrar el pase",
          "points": {
            "MP": 3,
            "MC": 1
          }
        },
        {
          "label": "El instinto para aparecer donde cae el balón",
          "points": {
            "DC": 3,
            "EXT": 1
          }
        }
      ]
    },
    {
      "code": "p27",
      "context": "situation",
      "text": "Sacas un córner a favor. Prefieres ser quien…",
      "options": [
        {
          "label": "Lo lanza con precisión al área",
          "points": {
            "MP": 2,
            "EXT": 2,
            "LAT": 1
          }
        },
        {
          "label": "Ataca el primer palo para el remate",
          "points": {
            "DC": 3,
            "DFC": 1
          }
        },
        {
          "label": "Se queda de vigilancia por si hay contra",
          "points": {
            "MCD": 3,
            "DFC": 1
          }
        },
        {
          "label": "Espera al borde del área para el rechace",
          "points": {
            "MC": 2,
            "MP": 2
          }
        }
      ]
    },
    {
      "code": "p28",
      "context": "situation",
      "text": "Vas ganando y el rival vuelca su ataque sobre vosotros. Tú:",
      "options": [
        {
          "label": "Me meto en el bloque bajo a defender mi área",
          "points": {
            "DFC": 3,
            "LAT": 1
          }
        },
        {
          "label": "Ordeno y tapo el espacio delante de la defensa",
          "points": {
            "MCD": 3,
            "MC": 1
          }
        },
        {
          "label": "Me quedo arriba como referencia para el contragolpe",
          "points": {
            "DC": 3,
            "EXT": 1
          }
        },
        {
          "label": "Ayudo a mi lateral a cerrar la banda",
          "points": {
            "LAT": 2,
            "MC": 1,
            "EXT": 1
          }
        }
      ]
    },
    {
      "code": "p29",
      "context": "attribute",
      "text": "En un centro al área, tu papel favorito es:",
      "options": [
        {
          "label": "Despejarlo antes de que llegue el delantero",
          "points": {
            "DFC": 3,
            "POR": 1
          }
        },
        {
          "label": "Colgarlo yo desde la banda",
          "points": {
            "LAT": 2,
            "EXT": 2
          }
        },
        {
          "label": "Rematarlo a portería",
          "points": {
            "DC": 4
          }
        },
        {
          "label": "Cazar el rechace desde fuera del área",
          "points": {
            "MC": 2,
            "MP": 2
          }
        }
      ]
    },
    {
      "code": "p30",
      "context": "situation",
      "text": "Recibes de espaldas a la portería rival, con un defensa encima. Tú:",
      "options": [
        {
          "label": "Protejo el balón y descargo a un compañero",
          "points": {
            "DC": 2,
            "MP": 1
          }
        },
        {
          "label": "Intento girarme para encarar",
          "points": {
            "EXT": 2,
            "MP": 2
          }
        },
        {
          "label": "La devuelvo de primeras y me ofrezco de nuevo",
          "points": {
            "MC": 2,
            "MCD": 2
          }
        },
        {
          "label": "Aguanto hasta que llegue apoyo",
          "points": {
            "DC": 2,
            "DFC": 1
          }
        }
      ]
    },
    {
      "code": "p31",
      "context": "situation",
      "text": "Tu equipo domina la posesión y el rival se cierra atrás. Tu aporte:",
      "options": [
        {
          "label": "Muevo el balón rápido de lado a lado para abrir huecos",
          "points": {
            "MCD": 3,
            "MC": 2
          }
        },
        {
          "label": "Busco el pase filtrado entre la defensa",
          "points": {
            "MP": 4
          }
        },
        {
          "label": "Me desmarco a la espalda para romper la línea",
          "points": {
            "DC": 3,
            "EXT": 1
          }
        },
        {
          "label": "Encaro en el uno contra uno para desequilibrar",
          "points": {
            "EXT": 3,
            "MP": 1
          }
        }
      ]
    }
  ],
  "prepItems": {
    "POR": [
      {
        "text": "En el mano a mano contra un delantero, lo más recomendable es:",
        "options": [
          {
            "label": "Tirarte al suelo cuanto antes",
            "isCorrect": false
          },
          {
            "label": "Salir achicando el ángulo y aguantar de pie el máximo posible",
            "isCorrect": true
          },
          {
            "label": "Salir siempre con los pies por delante",
            "isCorrect": false
          },
          {
            "label": "Quedarte fijo en la línea de gol",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "En un saque de puerta con salida jugada, tu primer objetivo es:",
        "options": [
          {
            "label": "Ofrecer una línea de pase segura abriendo a los centrales",
            "isCorrect": true
          },
          {
            "label": "Chutar lo más lejos posible siempre",
            "isCorrect": false
          },
          {
            "label": "Dársela al rival más cercano",
            "isCorrect": false
          },
          {
            "label": "Buscar directo al delantero de cabeza",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Para blocar un balón raso y potente, la técnica correcta es:",
        "options": [
          {
            "label": "Pararlo solo con un pie",
            "isCorrect": false
          },
          {
            "label": "Desviarlo siempre a córner",
            "isCorrect": false
          },
          {
            "label": "Colocar el cuerpo detrás del balón y recogerlo con las manos por delante",
            "isCorrect": true
          },
          {
            "label": "Saltar por encima de él",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Cuando el rival prepara un córner, tu posición de partida ideal es:",
        "options": [
          {
            "label": "Pegado al primer palo",
            "isCorrect": false
          },
          {
            "label": "En la línea de gol sin moverte",
            "isCorrect": false
          },
          {
            "label": "Fuera del área",
            "isCorrect": false
          },
          {
            "label": "Ligeramente adelantado hacia el centro, protegiendo el segundo palo",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "En una salida a por un centro, la decisión clave es:",
        "options": [
          {
            "label": "Salir siempre",
            "isCorrect": false
          },
          {
            "label": "Esperar a que despeje un defensa",
            "isCorrect": false
          },
          {
            "label": "Salir solo si llegas con seguridad, y comunicarlo con la voz",
            "isCorrect": true
          },
          {
            "label": "No salir nunca",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Tu comunicación con la defensa debe ser:",
        "options": [
          {
            "label": "Solo cuando hay peligro claro",
            "isCorrect": false
          },
          {
            "label": "Únicamente en los córners",
            "isCorrect": false
          },
          {
            "label": "Inexistente para no distraer",
            "isCorrect": false
          },
          {
            "label": "Constante, indicando marcajes y ajustando la línea",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "Ante un penalti, lo más eficaz suele ser:",
        "options": [
          {
            "label": "Tirarte siempre al mismo lado",
            "isCorrect": false
          },
          {
            "label": "Quedarte quieto en el centro siempre",
            "isCorrect": false
          },
          {
            "label": "Leer el cuerpo del lanzador y reaccionar sin anticiparte demasiado",
            "isCorrect": true
          },
          {
            "label": "Adelantarte de la línea antes del disparo",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Con el balón controlado y tu equipo replegado, conviene:",
        "options": [
          {
            "label": "Chutar largo sin mirar",
            "isCorrect": false
          },
          {
            "label": "Cambiar el ritmo buscando una salida limpia o un cambio de orientación",
            "isCorrect": true
          },
          {
            "label": "Retrasar hasta que te presionen",
            "isCorrect": false
          },
          {
            "label": "Sacar siempre rápido al delantero",
            "isCorrect": false
          }
        ]
      }
    ],
    "DFC": [
      {
        "text": "Al marcar a un delantero, tu orientación corporal ideal es:",
        "options": [
          {
            "label": "De semiperfil, viendo balón y rival a la vez",
            "isCorrect": true
          },
          {
            "label": "Mirando solo al balón",
            "isCorrect": false
          },
          {
            "label": "De espaldas al balón",
            "isCorrect": false
          },
          {
            "label": "Totalmente frontal al delantero",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Ante un balón dividido por alto, lo prioritario es:",
        "options": [
          {
            "label": "Ganar la posición y despejar con seguridad, lejos del área",
            "isCorrect": true
          },
          {
            "label": "Cederlo al portero de cabeza",
            "isCorrect": false
          },
          {
            "label": "Controlarlo de pecho siempre",
            "isCorrect": false
          },
          {
            "label": "Dejarlo botar",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Cuando tu pareja de central sale a presionar, tú debes:",
        "options": [
          {
            "label": "Subir la línea sin mirar",
            "isCorrect": false
          },
          {
            "label": "Salir tú también a presionar",
            "isCorrect": false
          },
          {
            "label": "Seguir marcando a tu hombre sin moverte",
            "isCorrect": false
          },
          {
            "label": "Dar cobertura y cerrar el espacio a su espalda",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "La regla básica del fuera de juego para la defensa es:",
        "options": [
          {
            "label": "No usar nunca el fuera de juego",
            "isCorrect": false
          },
          {
            "label": "Que cada uno suba cuando quiera",
            "isCorrect": false
          },
          {
            "label": "Subir la línea de forma coordinada en el momento del pase",
            "isCorrect": true
          },
          {
            "label": "Bajar siempre hasta la línea de gol",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "En un uno contra uno defensivo, lo correcto es:",
        "options": [
          {
            "label": "Tirarte a robar de inmediato",
            "isCorrect": false
          },
          {
            "label": "Meter la pierna a ciegas",
            "isCorrect": false
          },
          {
            "label": "Retroceder hasta el área sin más",
            "isCorrect": false
          },
          {
            "label": "Frenar, orientar al rival hacia fuera y no lanzarte al suelo",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "En la salida de balón, tu primera opción segura suele ser:",
        "options": [
          {
            "label": "Conducir hasta el medio campo siempre",
            "isCorrect": false
          },
          {
            "label": "Devolver al portero bajo presión",
            "isCorrect": false
          },
          {
            "label": "Siempre un balón largo",
            "isCorrect": false
          },
          {
            "label": "El pivote o el lateral libre, jugando en corto",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "Defendiendo un córner en zona, tu responsabilidad es:",
        "options": [
          {
            "label": "Proteger tu zona asignada y atacar el balón que entre en ella",
            "isCorrect": true
          },
          {
            "label": "Seguir a un rival por todo el área",
            "isCorrect": false
          },
          {
            "label": "Quedarte fijo en el punto de penalti",
            "isCorrect": false
          },
          {
            "label": "Salir del área",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Si el delantero recibe de espaldas cerca de ti, debes:",
        "options": [
          {
            "label": "Saltar por delante siempre",
            "isCorrect": false
          },
          {
            "label": "Estar cerca para no dejarle girar, sin cometer falta",
            "isCorrect": true
          },
          {
            "label": "Dejarle espacio para girar",
            "isCorrect": false
          },
          {
            "label": "Bajar hasta la línea de gol",
            "isCorrect": false
          }
        ]
      }
    ],
    "LAT": [
      {
        "text": "Cuando tu equipo ataca por tu banda, tu movimiento típico es:",
        "options": [
          {
            "label": "Subir solo si pierdes el balón",
            "isCorrect": false
          },
          {
            "label": "Ofrecer amplitud subiendo la línea para dar anchura",
            "isCorrect": true
          },
          {
            "label": "Quedarte en tu área",
            "isCorrect": false
          },
          {
            "label": "Cerrarte al centro",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Defendiendo a un extremo rápido, lo correcto es:",
        "options": [
          {
            "label": "Lanzarte al suelo de inmediato",
            "isCorrect": false
          },
          {
            "label": "Retroceder sin oponer resistencia",
            "isCorrect": false
          },
          {
            "label": "Dejarle el interior libre",
            "isCorrect": false
          },
          {
            "label": "Orientarle hacia la línea y no cruzar las piernas",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "Tras un ataque en el que subiste, al perder el balón tu prioridad es:",
        "options": [
          {
            "label": "Pedir el cambio",
            "isCorrect": false
          },
          {
            "label": "Esperar en el medio campo",
            "isCorrect": false
          },
          {
            "label": "Recuperar tu posición rápido para evitar el contra por tu espalda",
            "isCorrect": true
          },
          {
            "label": "Seguir arriba presionando siempre",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "En un centro desde la banda contraria, el lateral debe:",
        "options": [
          {
            "label": "Quedarse abierto en su banda",
            "isCorrect": false
          },
          {
            "label": "Subir al ataque",
            "isCorrect": false
          },
          {
            "label": "Marcar al portero",
            "isCorrect": false
          },
          {
            "label": "Cerrarse para cubrir el segundo palo y posibles llegadas",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "La coordinación con tu extremo consiste en:",
        "options": [
          {
            "label": "No comunicaros",
            "isCorrect": false
          },
          {
            "label": "Pisar los dos la misma zona",
            "isCorrect": false
          },
          {
            "label": "Alternar desmarques: si él viene al pie, tú vas por fuera",
            "isCorrect": true
          },
          {
            "label": "Quedarte siempre parado",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Tu línea de referencia al defender es:",
        "options": [
          {
            "label": "Ir siempre por libre",
            "isCorrect": false
          },
          {
            "label": "Adelantarte en solitario",
            "isCorrect": false
          },
          {
            "label": "Mantenerte alineado con los centrales para no dar mal el fuera de juego",
            "isCorrect": true
          },
          {
            "label": "Bajar más que los centrales siempre",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Un buen centro de lateral suele buscar:",
        "options": [
          {
            "label": "Siempre el balón fuerte al primer palo",
            "isCorrect": false
          },
          {
            "label": "El espacio entre el portero y la defensa, con criterio según el rematador",
            "isCorrect": true
          },
          {
            "label": "Al portero rival",
            "isCorrect": false
          },
          {
            "label": "El córner",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Si defiendes con línea de tres y eres carrilero, debes:",
        "options": [
          {
            "label": "Jugar como central puro",
            "isCorrect": false
          },
          {
            "label": "No cruzar el medio campo",
            "isCorrect": false
          },
          {
            "label": "Quedarte solo arriba",
            "isCorrect": false
          },
          {
            "label": "Cubrir toda la banda, ayudando en defensa y en ataque",
            "isCorrect": true
          }
        ]
      }
    ],
    "MCD": [
      {
        "text": "La función principal del pivote al defender es:",
        "options": [
          {
            "label": "Subir a rematar",
            "isCorrect": false
          },
          {
            "label": "Cubrir el espacio entre líneas y proteger a la defensa",
            "isCorrect": true
          },
          {
            "label": "Marcar al delantero centro",
            "isCorrect": false
          },
          {
            "label": "Presionar al portero rival",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Al recibir de la defensa presionado, tu mejor recurso suele ser:",
        "options": [
          {
            "label": "Aguantar el balón sin mirar",
            "isCorrect": false
          },
          {
            "label": "Devolver siempre al central",
            "isCorrect": false
          },
          {
            "label": "Orientar el control al espacio libre y jugar a un toque",
            "isCorrect": true
          },
          {
            "label": "Encarar hacia tu propia portería",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Tu orientación corporal al recibir debe ser:",
        "options": [
          {
            "label": "Mirando solo al que te la da",
            "isCorrect": false
          },
          {
            "label": "Perfilado, para ver la mayor parte del campo antes de recibir",
            "isCorrect": true
          },
          {
            "label": "Frontal a tu portería",
            "isCorrect": false
          },
          {
            "label": "De espaldas siempre",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Cuando el rival contraataca, tu prioridad es:",
        "options": [
          {
            "label": "Marcar al extremo",
            "isCorrect": false
          },
          {
            "label": "Subir a atacar",
            "isCorrect": false
          },
          {
            "label": "Salir a robar en plancha",
            "isCorrect": false
          },
          {
            "label": "Frenar el ataque y retrasar para que llegue tu equipo",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "En la fase de posesión, el pivote ayuda a:",
        "options": [
          {
            "label": "Circular el balón y cambiar el ritmo y la orientación",
            "isCorrect": true
          },
          {
            "label": "Quedarse fijo sin ofrecerse",
            "isCorrect": false
          },
          {
            "label": "Chutar desde lejos siempre",
            "isCorrect": false
          },
          {
            "label": "Jugar pegado al delantero",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Ante dos rivales presionándote, un buen pivote debe:",
        "options": [
          {
            "label": "Devolver siempre atrás",
            "isCorrect": false
          },
          {
            "label": "Echar el balón fuera",
            "isCorrect": false
          },
          {
            "label": "Regatear a los dos",
            "isCorrect": false
          },
          {
            "label": "Haber mirado antes para saber dónde soltar rápido",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "Al defender un córner en contra, el pivote suele:",
        "options": [
          {
            "label": "Quedarse con el portero",
            "isCorrect": false
          },
          {
            "label": "Vigilar el borde del área para cortar rechaces y contras",
            "isCorrect": true
          },
          {
            "label": "Marcar dentro del área siempre",
            "isCorrect": false
          },
          {
            "label": "Subir arriba",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "La diferencia entre el pivote y el mediocentro llegador es:",
        "options": [
          {
            "label": "El pivote juega de extremo",
            "isCorrect": false
          },
          {
            "label": "El pivote ataca más",
            "isCorrect": false
          },
          {
            "label": "El pivote prioriza el equilibrio y la protección defensiva",
            "isCorrect": true
          },
          {
            "label": "No hay diferencia",
            "isCorrect": false
          }
        ]
      }
    ],
    "MC": [
      {
        "text": "La virtud clave de un mediocentro box-to-box es:",
        "options": [
          {
            "label": "No defender nunca",
            "isCorrect": false
          },
          {
            "label": "Aportar en defensa y ataque recorriendo todo el campo",
            "isCorrect": true
          },
          {
            "label": "Quedarse siempre atrás",
            "isCorrect": false
          },
          {
            "label": "Jugar pegado a la banda",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Al llegar desde segunda línea al área, el timing correcto es:",
        "options": [
          {
            "label": "No llegar nunca",
            "isCorrect": false
          },
          {
            "label": "Quedarse fuera del área",
            "isCorrect": false
          },
          {
            "label": "Entrar en el momento del centro o pase, sin adelantarte",
            "isCorrect": true
          },
          {
            "label": "Entrar siempre el primero",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "En la recuperación tras pérdida, el mediocentro debe:",
        "options": [
          {
            "label": "Quedarse quieto siempre",
            "isCorrect": false
          },
          {
            "label": "Presionar o replegar según la orden del equipo, con criterio",
            "isCorrect": true
          },
          {
            "label": "Marcar al portero",
            "isCorrect": false
          },
          {
            "label": "Subir siempre",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Para recibir entre líneas, lo fundamental es:",
        "options": [
          {
            "label": "Jugar siempre de espaldas",
            "isCorrect": false
          },
          {
            "label": "Quedarse detrás del balón",
            "isCorrect": false
          },
          {
            "label": "Pedirla siempre al pie en corto",
            "isCorrect": false
          },
          {
            "label": "Encontrar el espacio entre defensas y medios rivales y perfilarse",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "En la circulación, un buen mediocentro busca:",
        "options": [
          {
            "label": "Dar continuidad con pases seguros y algún cambio de ritmo",
            "isCorrect": true
          },
          {
            "label": "Regatear a todos",
            "isCorrect": false
          },
          {
            "label": "Chutar de lejos siempre",
            "isCorrect": false
          },
          {
            "label": "Jugar en largo siempre",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Cuando tu equipo defiende, tu posición ideal es:",
        "options": [
          {
            "label": "En el área rival",
            "isCorrect": false
          },
          {
            "label": "En la banda",
            "isCorrect": false
          },
          {
            "label": "Pegado al delantero rival",
            "isCorrect": false
          },
          {
            "label": "Ordenado en tu zona, ayudando al pivote y cerrando líneas de pase",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "La comunicación con el pivote consiste en:",
        "options": [
          {
            "label": "Marcar al mismo rival",
            "isCorrect": false
          },
          {
            "label": "Turnaros las coberturas para no dejar el centro descubierto",
            "isCorrect": true
          },
          {
            "label": "Subir los dos a la vez siempre",
            "isCorrect": false
          },
          {
            "label": "No hablaros",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "En un partido de mucho desgaste, el mediocentro debe:",
        "options": [
          {
            "label": "Jugar solo a la contra",
            "isCorrect": false
          },
          {
            "label": "Correr sin criterio siempre",
            "isCorrect": false
          },
          {
            "label": "Dosificar y elegir bien cuándo llegar y cuándo cubrir",
            "isCorrect": true
          },
          {
            "label": "No moverse",
            "isCorrect": false
          }
        ]
      }
    ],
    "MP": [
      {
        "text": "La zona natural del mediapunta es:",
        "options": [
          {
            "label": "En la banda fija",
            "isCorrect": false
          },
          {
            "label": "Entre la defensa y el mediocampo rival, buscando el espacio libre",
            "isCorrect": true
          },
          {
            "label": "Pegado a su propia portería",
            "isCorrect": false
          },
          {
            "label": "Dentro del área rival siempre",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Al recibir entre líneas de espaldas, tu recurso ideal es:",
        "options": [
          {
            "label": "Chutar de primeras siempre",
            "isCorrect": false
          },
          {
            "label": "Aguantar sin mirar",
            "isCorrect": false
          },
          {
            "label": "Girar hacia el espacio libre o dejarla a un compañero de cara",
            "isCorrect": true
          },
          {
            "label": "Devolverla siempre atrás",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "La virtud más valiosa de un mediapunta es:",
        "options": [
          {
            "label": "El despeje",
            "isCorrect": false
          },
          {
            "label": "La visión y el último pase para generar ocasiones",
            "isCorrect": true
          },
          {
            "label": "La marca al hombre",
            "isCorrect": false
          },
          {
            "label": "El juego aéreo defensivo",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Cuando tu equipo pierde el balón, el mediapunta moderno debe:",
        "options": [
          {
            "label": "Marcar al portero",
            "isCorrect": false
          },
          {
            "label": "Bajar hasta su área siempre",
            "isCorrect": false
          },
          {
            "label": "Desentenderse de defender",
            "isCorrect": false
          },
          {
            "label": "Presionar la primera salida rival o cerrar al pivote contrario",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "Para asociarte cerca del área, lo mejor suele ser:",
        "options": [
          {
            "label": "Jugar a uno o dos toques y buscar la pared",
            "isCorrect": true
          },
          {
            "label": "Chutar de lejos siempre",
            "isCorrect": false
          },
          {
            "label": "Regatear siempre a todos",
            "isCorrect": false
          },
          {
            "label": "Quedarte parado",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Ante una defensa muy junta, el mediapunta debe:",
        "options": [
          {
            "label": "Dejar de moverse",
            "isCorrect": false
          },
          {
            "label": "Irse a la banda",
            "isCorrect": false
          },
          {
            "label": "Chutar desde muy lejos siempre",
            "isCorrect": false
          },
          {
            "label": "Buscar el pase filtrado o el desmarque de ruptura de un compañero",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "El desmarque de apoyo del mediapunta sirve para:",
        "options": [
          {
            "label": "Quedarse fijo",
            "isCorrect": false
          },
          {
            "label": "Recibir de cara y encarar o filtrar el balón",
            "isCorrect": true
          },
          {
            "label": "Alejarse del juego",
            "isCorrect": false
          },
          {
            "label": "Marcar a un rival",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "La diferencia entre mediapunta y delantero centro es:",
        "options": [
          {
            "label": "El mediapunta juega de portero",
            "isCorrect": false
          },
          {
            "label": "Son lo mismo",
            "isCorrect": false
          },
          {
            "label": "El mediapunta crea y asocia; el delantero finaliza",
            "isCorrect": true
          },
          {
            "label": "El mediapunta defiende su área",
            "isCorrect": false
          }
        ]
      }
    ],
    "EXT": [
      {
        "text": "En el uno contra uno, el recurso básico del extremo es:",
        "options": [
          {
            "label": "Chutar de lejos siempre",
            "isCorrect": false
          },
          {
            "label": "Encarar con velocidad y desbordar por fuera o por dentro con criterio",
            "isCorrect": true
          },
          {
            "label": "Esperar sin encarar",
            "isCorrect": false
          },
          {
            "label": "Devolver siempre atrás",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Cuando tu lateral sube por fuera, tú debes:",
        "options": [
          {
            "label": "Quedarte en la misma zona que él",
            "isCorrect": false
          },
          {
            "label": "Pisar por dentro para dar otra opción y liberar la banda",
            "isCorrect": true
          },
          {
            "label": "Bajar a defender siempre",
            "isCorrect": false
          },
          {
            "label": "Irte al centro del ataque",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "El momento ideal para centrar es:",
        "options": [
          {
            "label": "Nunca centrar",
            "isCorrect": false
          },
          {
            "label": "Cuando ganas la línea de fondo o tienes ángulo claro al área",
            "isCorrect": true
          },
          {
            "label": "Siempre desde tu propio campo",
            "isCorrect": false
          },
          {
            "label": "Solo de espaldas",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Al perder el balón en ataque, el extremo moderno debe:",
        "options": [
          {
            "label": "No defender nunca",
            "isCorrect": false
          },
          {
            "label": "Presionar al lateral rival o replegar a su banda",
            "isCorrect": true
          },
          {
            "label": "Marcar al portero",
            "isCorrect": false
          },
          {
            "label": "Irse al centro",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Para recibir cómodo abierto en banda, conviene:",
        "options": [
          {
            "label": "Quedarte de espaldas a la línea",
            "isCorrect": false
          },
          {
            "label": "No moverte",
            "isCorrect": false
          },
          {
            "label": "Ofrecerte en el momento justo, con el cuerpo perfilado hacia dentro",
            "isCorrect": true
          },
          {
            "label": "Pedirla siempre al pie parado",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Un buen extremo alterna:",
        "options": [
          {
            "label": "Siempre el mismo movimiento",
            "isCorrect": false
          },
          {
            "label": "Jugar solo por dentro",
            "isCorrect": false
          },
          {
            "label": "No desmarcarse nunca",
            "isCorrect": false
          },
          {
            "label": "Desmarques al pie y de ruptura a la espalda del lateral",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "Cuando el juego va por la banda contraria, el extremo debe:",
        "options": [
          {
            "label": "Irse al córner",
            "isCorrect": false
          },
          {
            "label": "Bajar a defender su área",
            "isCorrect": false
          },
          {
            "label": "Quedarse abierto en su banda",
            "isCorrect": false
          },
          {
            "label": "Cerrarse al área para rematar posibles centros",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "La decisión clave del extremo con balón en velocidad es:",
        "options": [
          {
            "label": "Chutar siempre",
            "isCorrect": false
          },
          {
            "label": "Leer si desbordar, centrar o asociarse según la defensa",
            "isCorrect": true
          },
          {
            "label": "Devolver siempre atrás",
            "isCorrect": false
          },
          {
            "label": "Regatear siempre a todos",
            "isCorrect": false
          }
        ]
      }
    ],
    "DC": [
      {
        "text": "En el desmarque de ruptura, el momento correcto de arrancar es:",
        "options": [
          {
            "label": "Justo antes del pase, atacando el espacio a la espalda del defensa",
            "isCorrect": true
          },
          {
            "label": "Siempre desde el fuera de juego",
            "isCorrect": false
          },
          {
            "label": "Después de que salga el pase",
            "isCorrect": false
          },
          {
            "label": "Sin mirar al pasador",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Para no caer en fuera de juego, el delantero debe:",
        "options": [
          {
            "label": "Temporizar el arranque y salir en línea con el último defensa",
            "isCorrect": true
          },
          {
            "label": "No moverse nunca",
            "isCorrect": false
          },
          {
            "label": "Quedarse detrás del balón",
            "isCorrect": false
          },
          {
            "label": "Adelantarse siempre",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "Recibiendo de espaldas con un central encima, lo ideal es:",
        "options": [
          {
            "label": "Aguantar sin mirar",
            "isCorrect": false
          },
          {
            "label": "Girar siempre para encarar",
            "isCorrect": false
          },
          {
            "label": "Devolver al portero",
            "isCorrect": false
          },
          {
            "label": "Proteger el balón y descargar a un compañero de apoyo",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "En la definición dentro del área, la regla básica es:",
        "options": [
          {
            "label": "Buscar siempre el palo largo",
            "isCorrect": false
          },
          {
            "label": "Chutar siempre lo más fuerte posible",
            "isCorrect": false
          },
          {
            "label": "Priorizar la colocación y el primer toque orientado sobre la potencia",
            "isCorrect": true
          },
          {
            "label": "Regatear al portero siempre",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "En la presión tras pérdida, el delantero debe:",
        "options": [
          {
            "label": "No presionar nunca",
            "isCorrect": false
          },
          {
            "label": "Marcar a su central",
            "isCorrect": false
          },
          {
            "label": "Bajar a su área",
            "isCorrect": false
          },
          {
            "label": "Orientar la presión para condicionar la salida rival",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "Para rematar un centro de cabeza, lo correcto es:",
        "options": [
          {
            "label": "Dejarlo pasar siempre",
            "isCorrect": false
          },
          {
            "label": "Rematar siempre hacia arriba",
            "isCorrect": false
          },
          {
            "label": "Esperarlo quieto",
            "isCorrect": false
          },
          {
            "label": "Atacar el balón saltando hacia él y dirigirlo abajo",
            "isCorrect": true
          }
        ]
      },
      {
        "text": "Cuando el juego se estanca, el delantero puede:",
        "options": [
          {
            "label": "Bajar a recibir para asociarse y arrastrar a su marcador",
            "isCorrect": true
          },
          {
            "label": "Quedarse siempre fijo en punta",
            "isCorrect": false
          },
          {
            "label": "Irse a la banda a defender",
            "isCorrect": false
          },
          {
            "label": "Dejar de moverse",
            "isCorrect": false
          }
        ]
      },
      {
        "text": "El movimiento de atacar el primer palo busca:",
        "options": [
          {
            "label": "Quedarse en el segundo palo siempre",
            "isCorrect": false
          },
          {
            "label": "Ganar la posición al defensa y desviar el centro a portería",
            "isCorrect": true
          },
          {
            "label": "Alejarse del balón",
            "isCorrect": false
          },
          {
            "label": "Esperar el rechace",
            "isCorrect": false
          }
        ]
      }
    ]
  }
};
