import { useState, useMemo, useEffect } from "react";

/* ============================================================
   DETECTOR DE POSICIÓN — Fútbol 8 / 11
   - 15 preguntas de posición (pool aleatorio, puntos ponderados
     y normalizados por exposición)
   - 8 preguntas de preparación específicas de la posición ganadora
   - Podio (top 3) + índice de preparación + export CSV
   ============================================================ */

const POSITIONS = {
  POR: { name: "Portero", num: 1, x: 50, y: 138,
    tagline: "El último recurso",
    desc: "Vives de la concentración, la colocación y la seguridad bajo palos. En el fútbol moderno también mandas la salida de balón con los pies." },
  LAT: { name: "Lateral", num: 2, x: 20, y: 108,
    tagline: "El motor de la banda",
    desc: "Defiendes y atacas. Das amplitud arriba y cierras la espalda atrás. Tu moneda es el fondo físico y el criterio para subir y bajar." },
  DFC: { name: "Defensa central", num: 4, x: 50, y: 112,
    tagline: "El muro",
    desc: "Anticipas, ganas duelos y ordenas la última línea. Tu seguridad da equilibrio a todo el equipo, con balón y sin él." },
  MCD: { name: "Pivote", num: 6, x: 50, y: 88,
    tagline: "El equilibrio",
    desc: "Proteges a la defensa, recuperas y ordenas el juego desde atrás. Sin ruido, pero imprescindible: eres la brújula del equipo." },
  MC: { name: "Mediocentro", num: 8, x: 38, y: 72,
    tagline: "El pulmón",
    desc: "Llegas a todo: defiendes, distribuyes y apareces en ataque desde segunda línea. El campo entero es tu zona de trabajo." },
  MP: { name: "Mediapunta", num: 10, x: 50, y: 50,
    tagline: "El cerebro creativo",
    desc: "Juegas entre líneas y ves el pase que otros no ven. Eres la chispa: asociación, último pase y desmarque para generar ocasiones." },
  EXT: { name: "Extremo", num: 7, x: 22, y: 52,
    tagline: "El desequilibrio",
    desc: "Vives del uno contra uno, la velocidad y el desborde. Rompes defensas por fuera y por dentro, y llegas al remate en el área." },
  DC: { name: "Delantero centro", num: 9, x: 50, y: 28,
    tagline: "El finalizador",
    desc: "Vives del gol: desmarque, colocación y sangre fría en el área. Tu trabajo se mide en la red, y arrastras defensas para el equipo." },
};

const ORDER = ["POR", "LAT", "DFC", "MCD", "MC", "MP", "EXT", "DC"];

// Fútbol 8: posiciones elegibles y "plegado" de las excluidas
const F8_ELIGIBLE = ["POR", "LAT", "DFC", "MC", "EXT", "DC"];
const F8_FOLD = { MCD: "MC", MP: "DC" };

// Coordenadas del campo por formato (viewBox 100x150, tu portería abajo).
// Balanceadas: lateral a la izquierda, extremo a la derecha.
const PITCH_COORDS = {
  "11": { POR: [50, 139], LAT: [20, 113], DFC: [50, 116], MCD: [50, 97], MC: [64, 80], MP: [36, 60], EXT: [80, 64], DC: [50, 36] },
  "8":  { POR: [50, 139], LAT: [26, 113], DFC: [60, 115], MC: [42, 86], EXT: [73, 72], DC: [50, 42] },
};

/* ---------- POOL DE PREGUNTAS DE POSICIÓN (se sortean 15) ---------- */
const POSITION_QUESTIONS = [
  { id: "p1", ctx: "Situación", text: "Tu equipo saca de puerta y el rival presiona arriba. ¿Qué haces?", options: [
    { label: "Pido el balón entre los centrales para iniciar el juego", pts: { MCD: 3, MC: 2, DFC: 1 } },
    { label: "Bajo como central a recibir y saco jugado", pts: { DFC: 3, MCD: 1 } },
    { label: "Me abro a la banda para ofrecer una línea de pase", pts: { LAT: 3, EXT: 2 } },
    { label: "Ataco el espacio a la espalda para un balón largo", pts: { DC: 3, EXT: 2 } },
  ] },
  { id: "p2", ctx: "Situación", text: "Recuperas el balón dentro de tu propia área. Primera reacción:", options: [
    { label: "Despejo con seguridad sin arriesgar", pts: { DFC: 3, POR: 1 } },
    { label: "Conduzco unos metros y busco al lateral", pts: { DFC: 2, MCD: 2 } },
    { label: "Toco corto al pivote para empezar a jugar", pts: { MCD: 3, MC: 1 } },
    { label: "Abro rápido a la banda para salir del área", pts: { LAT: 3 } },
  ] },
  { id: "p3", ctx: "Situación", text: "Contraataque a favor y corres al espacio. ¿Dónde te sientes mejor?", options: [
    { label: "Rematando en el punto de penalti", pts: { DC: 4 } },
    { label: "Desbordando por fuera para el centro", pts: { EXT: 4 } },
    { label: "Llegando desde segunda línea para rematar", pts: { MP: 3, MC: 2 } },
    { label: "Ordenando el ataque y dando el último pase", pts: { MP: 4 } },
  ] },
  { id: "p4", ctx: "Atributo", text: "Tu mayor virtud física es:", options: [
    { label: "Reflejos y juego con las manos", pts: { POR: 5 } },
    { label: "Fuerza y juego aéreo", pts: { DFC: 3, DC: 2 } },
    { label: "Velocidad punta", pts: { EXT: 3, LAT: 2 } },
    { label: "Resistencia para cubrir todo el campo", pts: { MC: 3, MCD: 1 } },
  ] },
  { id: "p5", ctx: "Situación", text: "Un extremo rapidísimo te encara en el uno contra uno. Tú:", options: [
    { label: "Aguanto la posición y no me tiro al suelo", pts: { DFC: 2, LAT: 3 } },
    { label: "Le meto intensidad y robo antes de que arranque", pts: { LAT: 3, MCD: 1 } },
    { label: "Cierro el interior y le mando hacia la línea", pts: { DFC: 3 } },
    { label: "Espero cobertura y no me lanzo solo", pts: { LAT: 2, DFC: 2 } },
  ] },
  { id: "p6", ctx: "Situación", text: "El partido se complica y el equipo se desordena. Tu reacción natural es:", options: [
    { label: "Reorganizo a la defensa y doy órdenes desde atrás", pts: { DFC: 2, POR: 3 } },
    { label: "Pido el balón y bajo el ritmo para calmar el juego", pts: { MCD: 3, MC: 2 } },
    { label: "Busco una jugada individual que cambie el partido", pts: { DC: 2, MP: 2, EXT: 1 } },
    { label: "Presiono arriba para forzar un error y reactivar al equipo", pts: { EXT: 2, DC: 1, MC: 1 } },
  ] },
  { id: "p7", ctx: "Situación", text: "Tu equipo domina pero no encuentra el gol. Tu aporte ideal:", options: [
    { label: "Un pase filtrado que rompe líneas", pts: { MP: 4, MC: 1 } },
    { label: "Un desborde y centro por banda", pts: { EXT: 4 } },
    { label: "Una llegada al área para rematar", pts: { DC: 3, MP: 1 } },
    { label: "Recuperar rápido arriba para insistir", pts: { EXT: 2, MC: 2 } },
  ] },
  { id: "p8", ctx: "Atributo", text: "¿Qué disfrutas más dentro del campo?", options: [
    { label: "Evitar goles", pts: { POR: 3, DFC: 3 } },
    { label: "Repartir juego", pts: { MCD: 2, MC: 3 } },
    { label: "Crear ocasiones", pts: { MP: 4 } },
    { label: "Marcar goles", pts: { DC: 4, EXT: 1 } },
  ] },
  { id: "p9", ctx: "Situación", text: "Falta lateral a favor cerca del área. Tú normalmente…", options: [
    { label: "Voy al primer palo a rematar de cabeza", pts: { DFC: 2, DC: 3 } },
    { label: "La lanzo yo con precisión", pts: { MP: 2, MCD: 2, LAT: 1 } },
    { label: "Espero el rechace fuera del área", pts: { MC: 2, MCD: 2 } },
    { label: "Ataco el segundo palo", pts: { DC: 2, EXT: 2 } },
  ] },
  { id: "p10", ctx: "Atributo", text: "Tu punto fuerte con el balón en los pies es:", options: [
    { label: "Salida limpia y saque en largo", pts: { POR: 3, DFC: 1 } },
    { label: "Pase largo cambiando la orientación", pts: { MCD: 3, MC: 1 } },
    { label: "Regate en espacios cortos", pts: { EXT: 3, MP: 2 } },
    { label: "Definición de cara a puerta", pts: { DC: 4 } },
  ] },
  { id: "p11", ctx: "Situación", text: "Pierdes el balón en campo rival. Tu primera acción:", options: [
    { label: "Presiono de inmediato para recuperar", pts: { EXT: 2, DC: 2, MC: 1 } },
    { label: "Vuelvo a mi posición de forma ordenada", pts: { MCD: 2, DFC: 1, LAT: 1 } },
    { label: "Cierro el pase interior más peligroso", pts: { MCD: 3, MC: 1 } },
    { label: "Aviso y coloco a mis compañeros", pts: { DFC: 2, POR: 2 } },
  ] },
  { id: "p12", ctx: "Atributo", text: "¿Cómo defines tu carácter en el campo?", options: [
    { label: "Sereno y seguro bajo presión", pts: { POR: 4, DFC: 1 } },
    { label: "Sólido y contundente", pts: { DFC: 4 } },
    { label: "Inteligente y con visión", pts: { MP: 3, MCD: 2 } },
    { label: "Atrevido y desequilibrante", pts: { EXT: 3, DC: 1 } },
  ] },
  { id: "p13", ctx: "Situación", text: "El equipo defiende un 1-0 en el minuto 90. Tú estás:", options: [
    { label: "Despejando todo lo que entra en mi área", pts: { DFC: 3, POR: 2 } },
    { label: "Sujetando el balón en la esquina para gastar tiempo", pts: { EXT: 2, DC: 2 } },
    { label: "Cortando cada avance en el centro del campo", pts: { MCD: 3, MC: 1 } },
    { label: "Bajando a ayudar aunque juegue arriba", pts: { MC: 2, MP: 1, LAT: 1 } },
  ] },
  { id: "p14", ctx: "Atributo", text: "Prefieres un partido en el que…", options: [
    { label: "No te llegue casi nada pero mantengas la portería a cero", pts: { POR: 4 } },
    { label: "Tengas que ganar muchos duelos", pts: { DFC: 3, MCD: 1 } },
    { label: "Toques mucho el balón y dirijas", pts: { MCD: 2, MC: 3 } },
    { label: "Tengas libertad para inventar", pts: { MP: 4, EXT: 1 } },
  ] },
  { id: "p15", ctx: "Situación", text: "Tu lateral sube al ataque y deja un hueco a su espalda. Tú:", options: [
    { label: "Me cierro para tapar su espalda", pts: { DFC: 3, MCD: 2 } },
    { label: "Cubro yo la banda temporalmente", pts: { LAT: 3, MC: 1 } },
    { label: "Sigo mi posición, no es mi tarea", pts: { DC: 2, MP: 2 } },
    { label: "Bajo desde el medio a equilibrar", pts: { MCD: 2, MC: 2 } },
  ] },
  { id: "p16", ctx: "Atributo", text: "Tu relación con el gol es:", options: [
    { label: "Casi nunca marco, no es mi función", pts: { POR: 3, DFC: 2 } },
    { label: "Marco de vez en cuando, sobre todo de cabeza", pts: { DFC: 2, DC: 1 } },
    { label: "Doy más asistencias que goles", pts: { MP: 3, EXT: 2 } },
    { label: "Vivo para marcar", pts: { DC: 4 } },
  ] },
  { id: "p17", ctx: "Situación", text: "Tienes ventaja en un dos contra uno. Prefieres:", options: [
    { label: "Ser quien da el pase decisivo", pts: { MP: 3, MC: 1 } },
    { label: "Ser quien recibe y define", pts: { DC: 3, EXT: 1 } },
    { label: "Arrastrar al defensa para liberar a un compañero", pts: { EXT: 2, DC: 1 } },
    { label: "No forzar y asegurar la posesión", pts: { MCD: 2, MC: 2 } },
  ] },
  { id: "p18", ctx: "Atributo", text: "Tu zona natural del campo es:", options: [
    { label: "Bajo palos", pts: { POR: 5 } },
    { label: "La última línea defensiva", pts: { DFC: 3, LAT: 2 } },
    { label: "El corazón del mediocampo", pts: { MCD: 3, MC: 3 } },
    { label: "El último tercio ofensivo", pts: { DC: 3, MP: 2, EXT: 2 } },
  ] },
  { id: "p19", ctx: "Situación", text: "El rival presiona tu salida de balón. La solución que ves primero:", options: [
    { label: "Jugar en corto y con paciencia aunque haya riesgo", pts: { MCD: 3, DFC: 1 } },
    { label: "Un balón largo directo al delantero", pts: { POR: 2, DC: 2 } },
    { label: "Buscar al lateral libre para progresar", pts: { LAT: 3, MC: 1 } },
    { label: "Un pase entre líneas al mediapunta", pts: { MP: 3, MC: 1 } },
  ] },
  { id: "p20", ctx: "Atributo", text: "Lo que más entrenas por tu cuenta es:", options: [
    { label: "Paradas y colocación", pts: { POR: 5 } },
    { label: "Marcaje, anticipación y despeje", pts: { DFC: 3 } },
    { label: "Pase, control y visión de juego", pts: { MC: 3, MCD: 2 } },
    { label: "Regate, velocidad y centro", pts: { EXT: 3 } },
  ] },
  { id: "p21", ctx: "Situación", text: "Córner a favor, ¿dónde apareces?", options: [
    { label: "Me quedo atrás por si hay contraataque", pts: { MCD: 2, DFC: 2, LAT: 1 } },
    { label: "Salto al área a rematar de cabeza", pts: { DFC: 2, DC: 3 } },
    { label: "Al borde del área para cazar el rechace", pts: { MC: 2, MP: 2 } },
    { label: "Lo saco yo con precisión", pts: { MP: 2, EXT: 2 } },
  ] },
  { id: "p22", ctx: "Atributo", text: "Si describieras tu juego en una palabra sería:", options: [
    { label: "Seguridad", pts: { POR: 3, DFC: 2 } },
    { label: "Equilibrio", pts: { MCD: 3, MC: 2 } },
    { label: "Creatividad", pts: { MP: 4 } },
    { label: "Definición", pts: { DC: 4 } },
  ] },
  { id: "p23", ctx: "Situación", text: "El rival juega en largo y el balón cae en tierra de nadie entre tú y un delantero. Tú:", options: [
    { label: "Salto y gano el duelo aéreo para despejar", pts: { DFC: 3, POR: 1 } },
    { label: "Bajo el balón de pecho y saco jugado", pts: { DFC: 2, MCD: 2 } },
    { label: "Corro a disputarlo y tapo la caída", pts: { MCD: 2, MC: 2 } },
    { label: "Me anticipo saliendo desde la portería", pts: { POR: 4 } },
  ] },
  { id: "p24", ctx: "Situación", text: "Tienes el balón en la banda con espacio por delante. Tu primer pensamiento:", options: [
    { label: "Conduzco a toda velocidad para desbordar", pts: { EXT: 4 } },
    { label: "Levanto la cabeza y busco un centro al área", pts: { EXT: 2, LAT: 2 } },
    { label: "La aguanto y espero que suba mi lateral", pts: { EXT: 2, MP: 1 } },
    { label: "Me la llevo hacia dentro para asociarme", pts: { MP: 2, MC: 2 } },
  ] },
  { id: "p25", ctx: "Situación", text: "Tu equipo recupera y arranca un ataque rápido. Tu primer movimiento:", options: [
    { label: "Ataco la espalda de la defensa buscando el pase", pts: { DC: 3, EXT: 1 } },
    { label: "Abro la banda para dar amplitud", pts: { EXT: 3, LAT: 1 } },
    { label: "Me ofrezco entre líneas para recibir de cara", pts: { MP: 3, MC: 1 } },
    { label: "Acompaño la jugada por si hay que reciclar el balón", pts: { MCD: 2, MC: 2 } },
  ] },
  { id: "p26", ctx: "Atributo", text: "Tu mejor cualidad mental en el campo es:", options: [
    { label: "La concentración para no fallar en un despiste", pts: { POR: 3, DFC: 2 } },
    { label: "La lectura del juego para anticiparte", pts: { DFC: 2, MCD: 2 } },
    { label: "La visión para encontrar el pase", pts: { MP: 3, MC: 1 } },
    { label: "El instinto para aparecer donde cae el balón", pts: { DC: 3, EXT: 1 } },
  ] },
  { id: "p27", ctx: "Situación", text: "Sacas un córner a favor. Prefieres ser quien…", options: [
    { label: "Lo lanza con precisión al área", pts: { MP: 2, EXT: 2, LAT: 1 } },
    { label: "Ataca el primer palo para el remate", pts: { DC: 3, DFC: 1 } },
    { label: "Se queda de vigilancia por si hay contra", pts: { MCD: 3, DFC: 1 } },
    { label: "Espera al borde del área para el rechace", pts: { MC: 2, MP: 2 } },
  ] },
  { id: "p28", ctx: "Situación", text: "Vas ganando y el rival vuelca su ataque sobre vosotros. Tú:", options: [
    { label: "Me meto en el bloque bajo a defender mi área", pts: { DFC: 3, LAT: 1 } },
    { label: "Ordeno y tapo el espacio delante de la defensa", pts: { MCD: 3, MC: 1 } },
    { label: "Me quedo arriba como referencia para el contragolpe", pts: { DC: 3, EXT: 1 } },
    { label: "Ayudo a mi lateral a cerrar la banda", pts: { LAT: 2, MC: 1, EXT: 1 } },
  ] },
  { id: "p29", ctx: "Atributo", text: "En un centro al área, tu papel favorito es:", options: [
    { label: "Despejarlo antes de que llegue el delantero", pts: { DFC: 3, POR: 1 } },
    { label: "Colgarlo yo desde la banda", pts: { LAT: 2, EXT: 2 } },
    { label: "Rematarlo a portería", pts: { DC: 4 } },
    { label: "Cazar el rechace desde fuera del área", pts: { MC: 2, MP: 2 } },
  ] },
  { id: "p30", ctx: "Situación", text: "Recibes de espaldas a la portería rival, con un defensa encima. Tú:", options: [
    { label: "Protejo el balón y descargo a un compañero", pts: { DC: 2, MP: 1 } },
    { label: "Intento girarme para encarar", pts: { EXT: 2, MP: 2 } },
    { label: "La devuelvo de primeras y me ofrezco de nuevo", pts: { MC: 2, MCD: 2 } },
    { label: "Aguanto hasta que llegue apoyo", pts: { DC: 2, DFC: 1 } },
  ] },
  { id: "p31", ctx: "Situación", text: "Tu equipo domina la posesión y el rival se cierra atrás. Tu aporte:", options: [
    { label: "Muevo el balón rápido de lado a lado para abrir huecos", pts: { MCD: 3, MC: 2 } },
    { label: "Busco el pase filtrado entre la defensa", pts: { MP: 4 } },
    { label: "Me desmarco a la espalda para romper la línea", pts: { DC: 3, EXT: 1 } },
    { label: "Encaro en el uno contra uno para desequilibrar", pts: { EXT: 3, MP: 1 } },
  ] },
];

/* ---------- PREGUNTAS DE PREPARACIÓN (8 por posición) ---------- */
const PREP = {
  POR: [
    { q: "En el mano a mano contra un delantero, lo más recomendable es:", opts: ["Salir achicando el ángulo y aguantar de pie el máximo posible", "Tirarte al suelo cuanto antes", "Quedarte fijo en la línea de gol", "Salir siempre con los pies por delante"], c: 0 },
    { q: "En un saque de puerta con salida jugada, tu primer objetivo es:", opts: ["Ofrecer una línea de pase segura abriendo a los centrales", "Chutar lo más lejos posible siempre", "Buscar directo al delantero de cabeza", "Dársela al rival más cercano"], c: 0 },
    { q: "Para blocar un balón raso y potente, la técnica correcta es:", opts: ["Colocar el cuerpo detrás del balón y recogerlo con las manos por delante", "Pararlo solo con un pie", "Desviarlo siempre a córner", "Saltar por encima de él"], c: 0 },
    { q: "Cuando el rival prepara un córner, tu posición de partida ideal es:", opts: ["Ligeramente adelantado hacia el centro, protegiendo el segundo palo", "Pegado al primer palo", "En la línea de gol sin moverte", "Fuera del área"], c: 0 },
    { q: "En una salida a por un centro, la decisión clave es:", opts: ["Salir solo si llegas con seguridad, y comunicarlo con la voz", "Salir siempre", "No salir nunca", "Esperar a que despeje un defensa"], c: 0 },
    { q: "Tu comunicación con la defensa debe ser:", opts: ["Constante, indicando marcajes y ajustando la línea", "Solo cuando hay peligro claro", "Inexistente para no distraer", "Únicamente en los córners"], c: 0 },
    { q: "Ante un penalti, lo más eficaz suele ser:", opts: ["Leer el cuerpo del lanzador y reaccionar sin anticiparte demasiado", "Tirarte siempre al mismo lado", "Quedarte quieto en el centro siempre", "Adelantarte de la línea antes del disparo"], c: 0 },
    { q: "Con el balón controlado y tu equipo replegado, conviene:", opts: ["Cambiar el ritmo buscando una salida limpia o un cambio de orientación", "Chutar largo sin mirar", "Retrasar hasta que te presionen", "Sacar siempre rápido al delantero"], c: 0 },
  ],
  DFC: [
    { q: "Al marcar a un delantero, tu orientación corporal ideal es:", opts: ["De semiperfil, viendo balón y rival a la vez", "De espaldas al balón", "Totalmente frontal al delantero", "Mirando solo al balón"], c: 0 },
    { q: "Ante un balón dividido por alto, lo prioritario es:", opts: ["Ganar la posición y despejar con seguridad, lejos del área", "Dejarlo botar", "Controlarlo de pecho siempre", "Cederlo al portero de cabeza"], c: 0 },
    { q: "Cuando tu pareja de central sale a presionar, tú debes:", opts: ["Dar cobertura y cerrar el espacio a su espalda", "Salir tú también a presionar", "Seguir marcando a tu hombre sin moverte", "Subir la línea sin mirar"], c: 0 },
    { q: "La regla básica del fuera de juego para la defensa es:", opts: ["Subir la línea de forma coordinada en el momento del pase", "Que cada uno suba cuando quiera", "No usar nunca el fuera de juego", "Bajar siempre hasta la línea de gol"], c: 0 },
    { q: "En un uno contra uno defensivo, lo correcto es:", opts: ["Frenar, orientar al rival hacia fuera y no lanzarte al suelo", "Tirarte a robar de inmediato", "Retroceder hasta el área sin más", "Meter la pierna a ciegas"], c: 0 },
    { q: "En la salida de balón, tu primera opción segura suele ser:", opts: ["El pivote o el lateral libre, jugando en corto", "Siempre un balón largo", "Devolver al portero bajo presión", "Conducir hasta el medio campo siempre"], c: 0 },
    { q: "Defendiendo un córner en zona, tu responsabilidad es:", opts: ["Proteger tu zona asignada y atacar el balón que entre en ella", "Seguir a un rival por todo el área", "Quedarte fijo en el punto de penalti", "Salir del área"], c: 0 },
    { q: "Si el delantero recibe de espaldas cerca de ti, debes:", opts: ["Estar cerca para no dejarle girar, sin cometer falta", "Dejarle espacio para girar", "Saltar por delante siempre", "Bajar hasta la línea de gol"], c: 0 },
  ],
  LAT: [
    { q: "Cuando tu equipo ataca por tu banda, tu movimiento típico es:", opts: ["Ofrecer amplitud subiendo la línea para dar anchura", "Cerrarte al centro", "Quedarte en tu área", "Subir solo si pierdes el balón"], c: 0 },
    { q: "Defendiendo a un extremo rápido, lo correcto es:", opts: ["Orientarle hacia la línea y no cruzar las piernas", "Lanzarte al suelo de inmediato", "Dejarle el interior libre", "Retroceder sin oponer resistencia"], c: 0 },
    { q: "Tras un ataque en el que subiste, al perder el balón tu prioridad es:", opts: ["Recuperar tu posición rápido para evitar el contra por tu espalda", "Seguir arriba presionando siempre", "Esperar en el medio campo", "Pedir el cambio"], c: 0 },
    { q: "En un centro desde la banda contraria, el lateral debe:", opts: ["Cerrarse para cubrir el segundo palo y posibles llegadas", "Quedarse abierto en su banda", "Subir al ataque", "Marcar al portero"], c: 0 },
    { q: "La coordinación con tu extremo consiste en:", opts: ["Alternar desmarques: si él viene al pie, tú vas por fuera", "Pisar los dos la misma zona", "Quedarte siempre parado", "No comunicaros"], c: 0 },
    { q: "Tu línea de referencia al defender es:", opts: ["Mantenerte alineado con los centrales para no dar mal el fuera de juego", "Ir siempre por libre", "Adelantarte en solitario", "Bajar más que los centrales siempre"], c: 0 },
    { q: "Un buen centro de lateral suele buscar:", opts: ["El espacio entre el portero y la defensa, con criterio según el rematador", "Siempre el balón fuerte al primer palo", "El córner", "Al portero rival"], c: 0 },
    { q: "Si defiendes con línea de tres y eres carrilero, debes:", opts: ["Cubrir toda la banda, ayudando en defensa y en ataque", "Quedarte solo arriba", "Jugar como central puro", "No cruzar el medio campo"], c: 0 },
  ],
  MCD: [
    { q: "La función principal del pivote al defender es:", opts: ["Cubrir el espacio entre líneas y proteger a la defensa", "Marcar al delantero centro", "Subir a rematar", "Presionar al portero rival"], c: 0 },
    { q: "Al recibir de la defensa presionado, tu mejor recurso suele ser:", opts: ["Orientar el control al espacio libre y jugar a un toque", "Encarar hacia tu propia portería", "Devolver siempre al central", "Aguantar el balón sin mirar"], c: 0 },
    { q: "Tu orientación corporal al recibir debe ser:", opts: ["Perfilado, para ver la mayor parte del campo antes de recibir", "De espaldas siempre", "Mirando solo al que te la da", "Frontal a tu portería"], c: 0 },
    { q: "Cuando el rival contraataca, tu prioridad es:", opts: ["Frenar el ataque y retrasar para que llegue tu equipo", "Salir a robar en plancha", "Subir a atacar", "Marcar al extremo"], c: 0 },
    { q: "En la fase de posesión, el pivote ayuda a:", opts: ["Circular el balón y cambiar el ritmo y la orientación", "Chutar desde lejos siempre", "Quedarse fijo sin ofrecerse", "Jugar pegado al delantero"], c: 0 },
    { q: "Ante dos rivales presionándote, un buen pivote debe:", opts: ["Haber mirado antes para saber dónde soltar rápido", "Regatear a los dos", "Devolver siempre atrás", "Echar el balón fuera"], c: 0 },
    { q: "Al defender un córner en contra, el pivote suele:", opts: ["Vigilar el borde del área para cortar rechaces y contras", "Marcar dentro del área siempre", "Subir arriba", "Quedarse con el portero"], c: 0 },
    { q: "La diferencia entre el pivote y el mediocentro llegador es:", opts: ["El pivote prioriza el equilibrio y la protección defensiva", "El pivote ataca más", "No hay diferencia", "El pivote juega de extremo"], c: 0 },
  ],
  MC: [
    { q: "La virtud clave de un mediocentro box-to-box es:", opts: ["Aportar en defensa y ataque recorriendo todo el campo", "Quedarse siempre atrás", "No defender nunca", "Jugar pegado a la banda"], c: 0 },
    { q: "Al llegar desde segunda línea al área, el timing correcto es:", opts: ["Entrar en el momento del centro o pase, sin adelantarte", "Entrar siempre el primero", "Quedarse fuera del área", "No llegar nunca"], c: 0 },
    { q: "En la recuperación tras pérdida, el mediocentro debe:", opts: ["Presionar o replegar según la orden del equipo, con criterio", "Subir siempre", "Quedarse quieto siempre", "Marcar al portero"], c: 0 },
    { q: "Para recibir entre líneas, lo fundamental es:", opts: ["Encontrar el espacio entre defensas y medios rivales y perfilarse", "Pedirla siempre al pie en corto", "Quedarse detrás del balón", "Jugar siempre de espaldas"], c: 0 },
    { q: "En la circulación, un buen mediocentro busca:", opts: ["Dar continuidad con pases seguros y algún cambio de ritmo", "Chutar de lejos siempre", "Regatear a todos", "Jugar en largo siempre"], c: 0 },
    { q: "Cuando tu equipo defiende, tu posición ideal es:", opts: ["Ordenado en tu zona, ayudando al pivote y cerrando líneas de pase", "Pegado al delantero rival", "En el área rival", "En la banda"], c: 0 },
    { q: "La comunicación con el pivote consiste en:", opts: ["Turnaros las coberturas para no dejar el centro descubierto", "Subir los dos a la vez siempre", "No hablaros", "Marcar al mismo rival"], c: 0 },
    { q: "En un partido de mucho desgaste, el mediocentro debe:", opts: ["Dosificar y elegir bien cuándo llegar y cuándo cubrir", "Correr sin criterio siempre", "No moverse", "Jugar solo a la contra"], c: 0 },
  ],
  MP: [
    { q: "La zona natural del mediapunta es:", opts: ["Entre la defensa y el mediocampo rival, buscando el espacio libre", "Pegado a su propia portería", "En la banda fija", "Dentro del área rival siempre"], c: 0 },
    { q: "Al recibir entre líneas de espaldas, tu recurso ideal es:", opts: ["Girar hacia el espacio libre o dejarla a un compañero de cara", "Devolverla siempre atrás", "Aguantar sin mirar", "Chutar de primeras siempre"], c: 0 },
    { q: "La virtud más valiosa de un mediapunta es:", opts: ["La visión y el último pase para generar ocasiones", "El juego aéreo defensivo", "El despeje", "La marca al hombre"], c: 0 },
    { q: "Cuando tu equipo pierde el balón, el mediapunta moderno debe:", opts: ["Presionar la primera salida rival o cerrar al pivote contrario", "Desentenderse de defender", "Bajar hasta su área siempre", "Marcar al portero"], c: 0 },
    { q: "Para asociarte cerca del área, lo mejor suele ser:", opts: ["Jugar a uno o dos toques y buscar la pared", "Regatear siempre a todos", "Chutar de lejos siempre", "Quedarte parado"], c: 0 },
    { q: "Ante una defensa muy junta, el mediapunta debe:", opts: ["Buscar el pase filtrado o el desmarque de ruptura de un compañero", "Chutar desde muy lejos siempre", "Dejar de moverse", "Irse a la banda"], c: 0 },
    { q: "El desmarque de apoyo del mediapunta sirve para:", opts: ["Recibir de cara y encarar o filtrar el balón", "Alejarse del juego", "Marcar a un rival", "Quedarse fijo"], c: 0 },
    { q: "La diferencia entre mediapunta y delantero centro es:", opts: ["El mediapunta crea y asocia; el delantero finaliza", "Son lo mismo", "El mediapunta defiende su área", "El mediapunta juega de portero"], c: 0 },
  ],
  EXT: [
    { q: "En el uno contra uno, el recurso básico del extremo es:", opts: ["Encarar con velocidad y desbordar por fuera o por dentro con criterio", "Devolver siempre atrás", "Chutar de lejos siempre", "Esperar sin encarar"], c: 0 },
    { q: "Cuando tu lateral sube por fuera, tú debes:", opts: ["Pisar por dentro para dar otra opción y liberar la banda", "Quedarte en la misma zona que él", "Bajar a defender siempre", "Irte al centro del ataque"], c: 0 },
    { q: "El momento ideal para centrar es:", opts: ["Cuando ganas la línea de fondo o tienes ángulo claro al área", "Siempre desde tu propio campo", "Nunca centrar", "Solo de espaldas"], c: 0 },
    { q: "Al perder el balón en ataque, el extremo moderno debe:", opts: ["Presionar al lateral rival o replegar a su banda", "No defender nunca", "Marcar al portero", "Irse al centro"], c: 0 },
    { q: "Para recibir cómodo abierto en banda, conviene:", opts: ["Ofrecerte en el momento justo, con el cuerpo perfilado hacia dentro", "Pedirla siempre al pie parado", "Quedarte de espaldas a la línea", "No moverte"], c: 0 },
    { q: "Un buen extremo alterna:", opts: ["Desmarques al pie y de ruptura a la espalda del lateral", "Siempre el mismo movimiento", "No desmarcarse nunca", "Jugar solo por dentro"], c: 0 },
    { q: "Cuando el juego va por la banda contraria, el extremo debe:", opts: ["Cerrarse al área para rematar posibles centros", "Quedarse abierto en su banda", "Bajar a defender su área", "Irse al córner"], c: 0 },
    { q: "La decisión clave del extremo con balón en velocidad es:", opts: ["Leer si desbordar, centrar o asociarse según la defensa", "Chutar siempre", "Regatear siempre a todos", "Devolver siempre atrás"], c: 0 },
  ],
  DC: [
    { q: "En el desmarque de ruptura, el momento correcto de arrancar es:", opts: ["Justo antes del pase, atacando el espacio a la espalda del defensa", "Después de que salga el pase", "Sin mirar al pasador", "Siempre desde el fuera de juego"], c: 0 },
    { q: "Para no caer en fuera de juego, el delantero debe:", opts: ["Temporizar el arranque y salir en línea con el último defensa", "Adelantarse siempre", "Quedarse detrás del balón", "No moverse nunca"], c: 0 },
    { q: "Recibiendo de espaldas con un central encima, lo ideal es:", opts: ["Proteger el balón y descargar a un compañero de apoyo", "Girar siempre para encarar", "Devolver al portero", "Aguantar sin mirar"], c: 0 },
    { q: "En la definición dentro del área, la regla básica es:", opts: ["Priorizar la colocación y el primer toque orientado sobre la potencia", "Chutar siempre lo más fuerte posible", "Buscar siempre el palo largo", "Regatear al portero siempre"], c: 0 },
    { q: "En la presión tras pérdida, el delantero debe:", opts: ["Orientar la presión para condicionar la salida rival", "No presionar nunca", "Bajar a su área", "Marcar a su central"], c: 0 },
    { q: "Para rematar un centro de cabeza, lo correcto es:", opts: ["Atacar el balón saltando hacia él y dirigirlo abajo", "Esperarlo quieto", "Rematar siempre hacia arriba", "Dejarlo pasar siempre"], c: 0 },
    { q: "Cuando el juego se estanca, el delantero puede:", opts: ["Bajar a recibir para asociarse y arrastrar a su marcador", "Quedarse siempre fijo en punta", "Irse a la banda a defender", "Dejar de moverse"], c: 0 },
    { q: "El movimiento de atacar el primer palo busca:", opts: ["Ganar la posición al defensa y desviar el centro a portería", "Alejarse del balón", "Quedarse en el segundo palo siempre", "Esperar el rechace"], c: 0 },
  ],
};

/* ---------- utilidades ---------- */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function shuffleOptions(q) {
  const idx = shuffle(q.opts.map((_, i) => i));
  return { ...q, opts: idx.map((i) => q.opts[i]), c: idx.indexOf(q.c) };
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function App() {
  const [stage, setStage] = useState("intro"); // intro | position | prep | result
  const [format, setFormat] = useState("11");
  const [playerName, setPlayerName] = useState("");

  const [posQuestions, setPosQuestions] = useState([]);
  const [posIndex, setPosIndex] = useState(0);
  const [posAnswers, setPosAnswers] = useState([]); // opción elegida por pregunta

  const [winner, setWinner] = useState(null);
  const [ranking, setRanking] = useState([]); // [{pos, pct}]
  const [prepQuestions, setPrepQuestions] = useState([]);
  const [prepIndex, setPrepIndex] = useState(0);
  const [prepAnswers, setPrepAnswers] = useState([]);

  const [history, setHistory] = useState([]);
  const [viewing, setViewing] = useState(null);

  const eligible = format === "8" ? F8_ELIGIBLE : ORDER;

  // cargar historial guardado al abrir
  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !window.storage) return;
      try {
        const r = await window.storage.get("quiz:history");
        if (r && r.value) setHistory(JSON.parse(r.value));
      } catch (e) { /* sin historial previo */ }
    })();
  }, []);

  async function persist(record) {
    if (typeof window === "undefined" || !window.storage) return;
    try {
      let hist = [];
      try {
        const r = await window.storage.get("quiz:history");
        if (r && r.value) hist = JSON.parse(r.value);
      } catch (e) { /* primera vez */ }
      hist.push(record);
      if (hist.length > 100) hist = hist.slice(-100);
      await window.storage.set("quiz:history", JSON.stringify(hist));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function clearHistory() {
    setHistory([]);
    if (typeof window !== "undefined" && window.storage) {
      try { window.storage.delete("quiz:history"); } catch (e) {}
    }
    setStage("intro");
  }

  function start() {
    const picked = shuffle(POSITION_QUESTIONS).slice(0, 15).map((q) => ({
      ...q,
      options: shuffle(q.options),
    }));
    setPosQuestions(picked);
    setPosIndex(0);
    setPosAnswers([]);
    setStage("position");
  }

  function answerPosition(option) {
    const next = [...posAnswers, option];
    setPosAnswers(next);
    if (posIndex + 1 < posQuestions.length) {
      setPosIndex(posIndex + 1);
    } else {
      computeWinner(next);
    }
  }

  function computeWinner(answers) {
    const earned = {}, maxp = {};
    ORDER.forEach((p) => { earned[p] = 0; maxp[p] = 0; });
    posQuestions.forEach((q, i) => {
      // máximo posible por posición en ESTA pregunta (normaliza exposición)
      ORDER.forEach((p) => {
        let best = 0;
        q.options.forEach((o) => { if ((o.pts[p] || 0) > best) best = o.pts[p] || 0; });
        maxp[p] += best;
      });
      const chosen = answers[i];
      if (chosen) ORDER.forEach((p) => { earned[p] += chosen.pts[p] || 0; });
    });

    // plegado para fútbol 8
    if (format === "8") {
      Object.entries(F8_FOLD).forEach(([from, to]) => {
        earned[to] += earned[from]; maxp[to] += maxp[from];
      });
    }

    const scored = eligible
      .map((p) => ({ pos: p, pct: maxp[p] > 0 ? earned[p] / maxp[p] : 0 }))
      .sort((a, b) => b.pct - a.pct);

    setRanking(scored);
    const win = scored[0].pos;
    setWinner(win);

    const prep = shuffle(PREP[win]).map(shuffleOptions);
    setPrepQuestions(prep);
    setPrepIndex(0);
    setPrepAnswers([]);
    setStage("prep");
  }

  function answerPrep(choiceIdx) {
    const correct = choiceIdx === prepQuestions[prepIndex].c;
    const next = [...prepAnswers, correct];
    setPrepAnswers(next);
    if (prepIndex + 1 < prepQuestions.length) {
      setPrepIndex(prepIndex + 1);
    } else {
      const record = {
        id: Date.now(),
        date: new Date().toISOString(),
        name: playerName.trim() || "Anónimo",
        format,
        winner,
        ranking,
        prepScore: next.filter(Boolean).length,
        prepTotal: prepQuestions.length,
      };
      setHistory((h) => [...h, record]);
      persist(record);
      setStage("result");
    }
  }

  function reset() {
    setStage("intro");
    setPosAnswers([]); setPrepAnswers([]); setWinner(null); setRanking([]);
  }

  const prepScore = prepAnswers.filter(Boolean).length;

  return (
    <div className="dp-root">
      <style>{CSS}</style>
      {stage === "intro" && (
        <Intro
          format={format} setFormat={setFormat}
          playerName={playerName} setPlayerName={setPlayerName}
          onStart={start}
          historyCount={history.length}
          onHistory={() => setStage("history")}
          onAbout={() => setStage("about")}
        />
      )}
      {stage === "about" && (
        <About onBack={() => setStage("intro")} />
      )}
      {stage === "history" && (
        <History
          items={history}
          onOpen={(rec) => { setViewing(rec); setStage("historyResult"); }}
          onBack={() => setStage("intro")}
          onClear={clearHistory}
        />
      )}
      {stage === "historyResult" && viewing && (
        <Result
          winner={viewing.winner} ranking={viewing.ranking}
          eligible={viewing.format === "8" ? F8_ELIGIBLE : ORDER}
          format={viewing.format} prepScore={viewing.prepScore} prepTotal={viewing.prepTotal}
          playerName={viewing.name === "Anónimo" ? "" : viewing.name}
          onReset={() => setStage("history")} backLabel="Volver al historial"
        />
      )}
      {stage === "position" && (
        <QuestionView
          phase="Posición"
          index={posIndex} total={posQuestions.length}
          ctx={posQuestions[posIndex].ctx}
          text={posQuestions[posIndex].text}
          options={posQuestions[posIndex].options.map((o) => o.label)}
          onAnswer={(i) => answerPosition(posQuestions[posIndex].options[i])}
        />
      )}
      {stage === "prep" && (
        <QuestionView
          phase={`Preparación · ${POSITIONS[winner].name}`}
          index={prepIndex} total={prepQuestions.length}
          ctx="Conocimiento táctico"
          text={prepQuestions[prepIndex].q}
          options={prepQuestions[prepIndex].opts}
          onAnswer={answerPrep}
        />
      )}
      {stage === "result" && (
        <Result
          winner={winner} ranking={ranking} eligible={eligible}
          format={format} prepScore={prepScore} prepTotal={prepQuestions.length}
          playerName={playerName} onReset={reset}
        />
      )}
    </div>
  );
}

/* ---------------- INTRO ---------------- */
function Intro({ format, setFormat, playerName, setPlayerName, onStart, historyCount, onHistory, onAbout }) {
  return (
    <div className="dp-screen dp-intro">
      <div className="dp-eyebrow">Análisis posicional</div>
      <h1 className="dp-title">¿En qué posición<br />deberías jugar?</h1>
      <p className="dp-lead">
        20 preguntas entre situaciones de juego, atributos y conocimiento táctico.
        Al terminar sabrás tu posición ideal, tu podio de alternativas y si estás
        preparado para ella.
      </p>

      <div className="dp-field">
        <label className="dp-label">Formato</label>
        <div className="dp-toggle">
          <button className={format === "8" ? "on" : ""} onClick={() => setFormat("8")}>Fútbol 8</button>
          <button className={format === "11" ? "on" : ""} onClick={() => setFormat("11")}>Fútbol 11</button>
        </div>
        <p className="dp-hint">
          {format === "8"
            ? "6 posiciones. En fútbol 8 los roles son más híbridos: sin pivote ni mediapunta puros."
            : "8 posiciones, de portero a delantero centro."}
        </p>
      </div>

      <div className="dp-field">
        <label className="dp-label" htmlFor="nm">Nombre <span className="dp-opt">(opcional, para el registro)</span></label>
        <input id="nm" className="dp-input" value={playerName}
          onChange={(e) => setPlayerName(e.target.value)} placeholder="Escribe tu nombre" maxLength={40} />
      </div>

      <button className="dp-cta" onClick={onStart}>Empezar el análisis</button>
      {historyCount > 0 && (
        <button className="dp-ghost" onClick={onHistory}>
          Ver mis resultados anteriores ({historyCount})
        </button>
      )}
      <p className="dp-foot">15 preguntas de posición · 8 de preparación</p>
      <button className="dp-link" onClick={onAbout}>Bases científicas y referencias</button>
    </div>
  );
}

/* ---------------- HISTORIAL ---------------- */
function History({ items, onOpen, onBack, onClear }) {
  const sorted = [...items].sort((a, b) => b.id - a.id);
  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleString("es-ES", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      });
    } catch (e) { return ""; }
  };
  return (
    <div className="dp-screen dp-history">
      <div className="dp-eyebrow">Historial</div>
      <h1 className="dp-title dp-title-sm">Mis resultados</h1>
      {sorted.length === 0 ? (
        <p className="dp-lead">Aún no tienes resultados guardados. Completa el test y aparecerán aquí.</p>
      ) : (
        <div className="dp-hlist">
          {sorted.map((rec) => (
            <button className="dp-hitem" key={rec.id} onClick={() => onOpen(rec)}>
              <span className="dp-hnum">{POSITIONS[rec.winner].num}</span>
              <span className="dp-hmeta">
                <span className="dp-hpos">{POSITIONS[rec.winner].name}</span>
                <span className="dp-hsub">{rec.name} · Fútbol {rec.format} · {fmtDate(rec.date)}</span>
              </span>
              <span className="dp-hprep">{rec.prepScore}/{rec.prepTotal}</span>
              <span className="dp-harrow">›</span>
            </button>
          ))}
        </div>
      )}
      <button className="dp-ghost" onClick={onBack}>Volver</button>
      {sorted.length > 0 && <button className="dp-clear" onClick={onClear}>Borrar historial</button>}
    </div>
  );
}

/* ---------------- BASES CIENTÍFICAS ---------------- */
function About({ onBack }) {
  const refs = [
    { t: "Di Salvo et al. — Performance characteristics according to playing position in elite soccer", j: "Int J Sports Med", url: "https://www.researchgate.net/publication/6769686_Performance_Characteristics_According_to_Playing_Position_in_Elite_Soccer" },
    { t: "Demandas físicas por posición en la MLS (GPS)", j: "PMC, 2024", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12551844/" },
    { t: "Demandas físicas por posición en transiciones (Ekstraklasa)", j: "PMC, 2023", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10955741/" },
    { t: "Perfil de carrera en juveniles U19 (4-3-3)", j: "PMC, 2025", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12473318/" },
    { t: "Perfil antropométrico según la posición (618 jugadores)", j: "Int J Environ Res Public Health, 2019", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6651378/" },
    { t: "Composición corporal por posición: revisión sistemática y metaanálisis", j: "Applied Sciences, 2023", url: "https://www.mdpi.com/2076-3417/13/8/4782" },
    { t: "Rendimiento y proceso de selección en juveniles", j: "PMC", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4096087/" },
    { t: "GoldFit / Gold Score Soccer: modelo multidimensional de identificación de talento", j: "Res Q Exerc Sport, 2024", url: "https://www.tandfonline.com/doi/full/10.1080/02701367.2024.2347983" },
    { t: "Modelo de predicción de posición con atributos físicos, técnicos, tácticos y psicológicos (machine learning)", j: "Springer, 2023", url: "https://link.springer.com/chapter/10.1007/978-981-99-3656-4_29" },
  ];
  return (
    <div className="dp-screen dp-about">
      <div className="dp-eyebrow">Metodología</div>
      <h1 className="dp-title dp-title-sm">Bases científicas</h1>
      <p className="dp-lead">
        El test es una herramienta de <b>orientación</b> construida a partir de la literatura de ciencia del rendimiento,
        no un instrumento clínico validado con tu plantilla. Estas son las bases en las que se apoya cada bloque de preguntas.
      </p>

      <div className="dp-abox">
        <div className="dp-atitle">Enfoque multidimensional</div>
        <p>Perfilar a un jugador combina varias dimensiones —física, antropométrica, técnica, táctica y psicológica—. Los modelos que asignan posición usan justo esa mezcla de atributos, por eso el test cruza situaciones de juego, atributos y conocimiento táctico.</p>
      </div>

      <div className="dp-abox">
        <div className="dp-atitle">Demandas físicas por posición</div>
        <p>Los estudios con GPS coinciden: los <b>mediocentros</b> cubren la mayor distancia total; los <b>laterales y extremos</b> y los <b>delanteros</b> acumulan más carreras a alta velocidad y sprints; los <b>centrales</b>, los que menos. De ahí que "resistencia para cubrir el campo" sume a mediocentro y "velocidad punta" a extremo y lateral.</p>
      </div>

      <div className="dp-abox">
        <div className="dp-atitle">Perfil antropométrico</div>
        <p>Los <b>porteros</b> son los más altos y pesados, seguidos de los <b>defensas</b>; los <b>mediocampistas</b> tienden a ser los más ligeros. Centrales y delanteros destacan en el juego aéreo. Esto respalda que "fuerza y juego aéreo" sume a central y delantero.</p>
      </div>

      <div className="dp-abox">
        <div className="dp-atitle">Táctica y rol</div>
        <p>Las responsabilidades de cada rol —el central que organiza y despeja, el lateral que da amplitud y cierra, el pivote que protege a la defensa, el extremo que desborda, el delantero que finaliza— son consenso en el análisis de rendimiento. Las preguntas de situación reflejan esas funciones.</p>
      </div>

      <div className="dp-abox dp-adisc">
        <div className="dp-atitle">Qué NO es</div>
        <p>No sustituye la evaluación de un entrenador ni predice tu rendimiento real. Para "validarlo" habría que contrastar sus resultados con evaluaciones reales de jugadores a lo largo del tiempo. Úsalo como punto de partida para la conversación, no como veredicto.</p>
      </div>

      <div className="dp-atitle" style={{ marginTop: 22 }}>Referencias</div>
      <ol className="dp-reflist">
        {refs.map((r, i) => (
          <li key={i}>
            <a href={r.url} target="_blank" rel="noopener noreferrer">{r.t}</a>
            <span className="dp-refj">{r.j}</span>
          </li>
        ))}
      </ol>

      <button className="dp-ghost" onClick={onBack}>Volver</button>
    </div>
  );
}

/* ---------------- PREGUNTA ---------------- */
function QuestionView({ phase, index, total, ctx, text, options, onAnswer }) {
  const [sel, setSel] = useState(null);
  useEffect(() => { setSel(null); }, [text]);
  const pct = ((index) / total) * 100;

  return (
    <div className="dp-screen dp-question" key={text}>
      <div className="dp-qhead">
        <span className="dp-phase">{phase}</span>
        <span className="dp-count">{index + 1} / {total}</span>
      </div>
      <div className="dp-progress"><span style={{ width: `${pct}%` }} /></div>

      <div className="dp-ctx">{ctx}</div>
      <h2 className="dp-qtext">{text}</h2>

      <div className="dp-options">
        {options.map((o, i) => (
          <button
            key={i}
            className={`dp-option ${sel === i ? "sel" : ""}`}
            onClick={() => { if (sel !== null) return; setSel(i); setTimeout(() => onAnswer(i), 220); }}
          >
            <span className="dp-optmark" />
            <span>{o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- RESULTADO ---------------- */
function Result({ winner, ranking, eligible, format, prepScore, prepTotal, playerName, onReset, backLabel = "Repetir el test" }) {
  const w = POSITIONS[winner];
  const top3 = ranking.slice(0, 3);

  const prepMsg = (() => {
    const r = prepScore / prepTotal;
    if (r >= 0.85) return "Dominas los fundamentos de la posición. Estás muy preparado.";
    if (r >= 0.6) return "Buena base. Tienes los conceptos clave, solo te falta pulir detalles.";
    if (r >= 0.375) return "Vas por buen camino, pero conviene reforzar los fundamentos tácticos de la posición.";
    return "Tu perfil encaja, pero aún te falta afianzar los conceptos de la posición. Terreno para crecer.";
  })();

  function downloadCSV() {
    const rows = [];
    rows.push(["Nombre", "Fecha", "Formato", "Posicion", "Afinidad_%", "Podio", "Preparacion", "Preparacion_%"]);
    const podio = top3.map((r) => `${POSITIONS[r.pos].name} (${Math.round(r.pct * 100)}%)`).join(" | ");
    rows.push([
      playerName || "Anónimo",
      new Date().toISOString().slice(0, 16).replace("T", " "),
      `Fútbol ${format}`,
      w.name,
      String(Math.round(ranking[0].pct * 100)),
      podio,
      `${prepScore}/${prepTotal}`,
      String(Math.round((prepScore / prepTotal) * 100)),
    ]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (playerName || "resultado").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    a.href = url; a.download = `posicion_${safe}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dp-screen dp-result">
      <div className="dp-eyebrow">Tu posición ideal</div>
      <div className="dp-resulthead">
        <div className="dp-num">{w.num}</div>
        <div>
          <h1 className="dp-posname">{w.name}</h1>
          <div className="dp-tagline">{w.tagline}</div>
        </div>
      </div>
      <p className="dp-desc">{w.desc}</p>

      <Pitch winner={winner} eligible={eligible} format={format} />

      <div className="dp-block">
        <div className="dp-blocktitle">Tu podio</div>
        {top3.map((r, i) => (
          <div className="dp-podrow" key={r.pos}>
            <span className="dp-podrank">{i + 1}</span>
            <span className="dp-podname">{POSITIONS[r.pos].name}</span>
            <span className="dp-bar"><span style={{ width: `${Math.round(r.pct * 100)}%` }} /></span>
            <span className="dp-podpct">{Math.round(r.pct * 100)}%</span>
          </div>
        ))}
        <p className="dp-note">La afinidad compara tu perfil con cada posición. Un valor alto en la 2ª y 3ª significa que también encajarías bien ahí.</p>
      </div>

      <div className="dp-block">
        <div className="dp-blocktitle">Índice de preparación</div>
        <div className="dp-prep">
          <div className="dp-prepnum">{prepScore}<span>/{prepTotal}</span></div>
          <div className="dp-prepbar"><span style={{ width: `${(prepScore / prepTotal) * 100}%` }} /></div>
        </div>
        <p className="dp-note">{prepMsg}</p>
      </div>

      <div className="dp-actions">
        <button className="dp-cta" onClick={downloadCSV}>Descargar resultado (CSV)</button>
        <button className="dp-ghost" onClick={onReset}>{backLabel}</button>
      </div>
    </div>
  );
}

/* ---------------- PIZARRA / CAMPO ---------------- */
function Pitch({ winner, eligible, format }) {
  const coords = PITCH_COORDS[format] || PITCH_COORDS["11"];
  return (
    <div className="dp-pitchwrap">
      <svg viewBox="0 0 100 150" className="dp-pitch" role="img" aria-label="Campo con tu posición">
        <rect x="3" y="3" width="94" height="144" className="pl" />
        <line x1="3" y1="75" x2="97" y2="75" className="pl" />
        <circle cx="50" cy="75" r="11" className="pl" />
        <circle cx="50" cy="75" r="1.2" className="plf" />
        {/* área inferior (tu portería) */}
        <rect x="26" y="126" width="48" height="21" className="pl" />
        <rect x="38" y="140" width="24" height="7" className="pl" />
        {/* área superior */}
        <rect x="26" y="3" width="48" height="21" className="pl" />
        <rect x="38" y="3" width="24" height="7" className="pl" />

        {ORDER.filter((p) => eligible.includes(p) && coords[p]).map((p) => {
          const [cx, cy] = coords[p];
          const on = p === winner;
          return (
            <g key={p} className={on ? "mk on" : "mk"}>
              {on && <circle cx={cx} cy={cy} r="8.5" className="mk-halo" />}
              <circle cx={cx} cy={cy} r="5.4" className="mk-dot" />
              <text x={cx} y={cy + 2.1} className="mk-num">{POSITIONS[p].num}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================ CSS */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

.dp-root{
  --bg:#0b140f; --panel:#111e17; --line:#2c4f3d; --chalk:#eef1ea;
  --dim:#8ba192; --accent:#e8b84b; --green:#4cc38a; --danger:#d46a6a;
  min-height:100vh; background:
    radial-gradient(120% 80% at 50% -10%, #12241a 0%, var(--bg) 60%);
  color:var(--chalk); font-family:'Inter',system-ui,sans-serif;
  display:flex; justify-content:center; padding:28px 18px 56px;
  -webkit-font-smoothing:antialiased;
}
.dp-screen{ width:100%; max-width:560px; }
@keyframes dpfade{ from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:none} }
.dp-intro,.dp-question,.dp-result{ animation:dpfade .45s ease both; }

.dp-eyebrow{ font-family:'Oswald'; letter-spacing:.22em; text-transform:uppercase;
  font-size:12px; color:var(--accent); font-weight:600; margin-bottom:14px; }
.dp-title{ font-family:'Oswald'; font-weight:700; font-size:clamp(34px,9vw,52px);
  line-height:.98; text-transform:uppercase; margin:0 0 18px; letter-spacing:.01em; }
.dp-lead{ color:var(--dim); font-size:15.5px; line-height:1.6; margin:0 0 30px; }

.dp-field{ margin-bottom:24px; }
.dp-label{ display:block; font-family:'Oswald'; text-transform:uppercase;
  letter-spacing:.14em; font-size:12.5px; color:var(--chalk); margin-bottom:10px; }
.dp-opt{ color:var(--dim); text-transform:none; letter-spacing:0; font-family:'Inter'; }
.dp-toggle{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.dp-toggle button{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.08em;
  font-size:16px; padding:14px; border-radius:11px; cursor:pointer;
  background:var(--panel); color:var(--dim); border:1.5px solid var(--line); transition:.18s; }
.dp-toggle button.on{ color:#0b140f; background:var(--accent); border-color:var(--accent); font-weight:600; }
.dp-hint{ color:var(--dim); font-size:13px; margin:10px 2px 0; line-height:1.5; }
.dp-input{ width:100%; box-sizing:border-box; background:var(--panel); border:1.5px solid var(--line);
  color:var(--chalk); border-radius:11px; padding:14px 15px; font-size:15px; font-family:'Inter'; outline:none; }
.dp-input:focus{ border-color:var(--accent); }

.dp-cta{ width:100%; font-family:'Oswald'; text-transform:uppercase; letter-spacing:.1em;
  font-size:17px; font-weight:600; padding:16px; border:none; border-radius:12px; cursor:pointer;
  background:var(--accent); color:#0b140f; transition:.18s; }
.dp-cta:hover{ filter:brightness(1.06); transform:translateY(-1px); }
.dp-ghost{ width:100%; font-family:'Oswald'; text-transform:uppercase; letter-spacing:.1em;
  font-size:15px; padding:14px; border:1.5px solid var(--line); border-radius:12px; cursor:pointer;
  background:transparent; color:var(--chalk); margin-top:10px; transition:.18s; }
.dp-ghost:hover{ border-color:var(--dim); }
.dp-foot{ text-align:center; color:var(--dim); font-size:12.5px; margin-top:16px; }

/* pregunta */
.dp-qhead{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px; }
.dp-phase{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.14em; font-size:12.5px; color:var(--accent); }
.dp-count{ font-family:'Oswald'; font-size:13px; color:var(--dim); letter-spacing:.1em; }
.dp-progress{ height:4px; background:var(--line); border-radius:99px; overflow:hidden; margin-bottom:34px; }
.dp-progress span{ display:block; height:100%; background:var(--accent); border-radius:99px; transition:width .35s ease; }
.dp-ctx{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.16em; font-size:11.5px; color:var(--green); margin-bottom:12px; }
.dp-qtext{ font-family:'Oswald'; font-weight:600; font-size:clamp(22px,5.5vw,28px); line-height:1.2; margin:0 0 26px; }
.dp-options{ display:flex; flex-direction:column; gap:11px; }
.dp-option{ display:flex; align-items:center; gap:14px; text-align:left; width:100%;
  background:var(--panel); border:1.5px solid var(--line); color:var(--chalk);
  border-radius:13px; padding:16px 16px; font-size:15px; line-height:1.4; cursor:pointer;
  font-family:'Inter'; transition:.16s; }
.dp-option:hover{ border-color:var(--dim); background:#14241b; }
.dp-optmark{ flex:none; width:17px; height:17px; border-radius:50%; border:2px solid var(--dim); transition:.16s; }
.dp-option.sel{ border-color:var(--accent); background:#1a2b1f; }
.dp-option.sel .dp-optmark{ border-color:var(--accent); background:var(--accent); box-shadow:inset 0 0 0 3px var(--panel); }

/* resultado */
.dp-resulthead{ display:flex; align-items:center; gap:18px; margin:4px 0 18px; }
.dp-num{ font-family:'Oswald'; font-weight:700; font-size:60px; line-height:1;
  width:78px; height:78px; flex:none; display:flex; align-items:center; justify-content:center;
  color:var(--accent); border:2.5px solid var(--accent); border-radius:16px; }
.dp-posname{ font-family:'Oswald'; font-weight:700; text-transform:uppercase; font-size:clamp(28px,7vw,38px); line-height:1; margin:0; }
.dp-tagline{ color:var(--green); font-family:'Oswald'; letter-spacing:.1em; text-transform:uppercase; font-size:13px; margin-top:6px; }
.dp-desc{ color:var(--dim); font-size:15px; line-height:1.6; margin:0 0 24px; }

.dp-pitchwrap{ background:var(--panel); border:1.5px solid var(--line); border-radius:16px; padding:16px; margin-bottom:22px; }
.dp-pitch{ width:100%; max-width:280px; display:block; margin:0 auto; }
.dp-pitch .pl{ fill:none; stroke:#3a6b52; stroke-width:.8; }
.dp-pitch .plf{ fill:#3a6b52; stroke:none; }
.dp-pitch .mk-dot{ fill:#1c3527; stroke:#3a6b52; stroke-width:1; }
.dp-pitch .mk-num{ fill:var(--dim); font-family:'Oswald'; font-size:6px; text-anchor:middle; font-weight:600; }
.dp-pitch .mk.on .mk-dot{ fill:var(--accent); stroke:var(--accent); }
.dp-pitch .mk.on .mk-num{ fill:#0b140f; }
.dp-pitch .mk-halo{ fill:none; stroke:var(--accent); stroke-width:1; opacity:.5; animation:dppulse 1.8s ease-in-out infinite; }
@keyframes dppulse{ 0%,100%{ opacity:.55 } 50%{ opacity:.12 } }

.dp-block{ background:var(--panel); border:1.5px solid var(--line); border-radius:16px; padding:20px; margin-bottom:16px; }
.dp-blocktitle{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.14em; font-size:12.5px; color:var(--accent); margin-bottom:16px; }
.dp-podrow{ display:flex; align-items:center; gap:12px; margin-bottom:14px; }
.dp-podrank{ font-family:'Oswald'; font-weight:700; font-size:15px; color:var(--dim); width:16px; }
.dp-podname{ font-size:14px; width:118px; flex:none; }
.dp-bar{ flex:1; height:7px; background:#0d1913; border-radius:99px; overflow:hidden; }
.dp-bar span{ display:block; height:100%; background:var(--green); border-radius:99px; }
.dp-podpct{ font-family:'Oswald'; font-size:14px; width:38px; text-align:right; color:var(--chalk); }
.dp-note{ color:var(--dim); font-size:12.5px; line-height:1.55; margin:8px 0 0; }

.dp-prep{ display:flex; align-items:center; gap:16px; margin-bottom:4px; }
.dp-prepnum{ font-family:'Oswald'; font-weight:700; font-size:40px; line-height:1; color:var(--accent); }
.dp-prepnum span{ font-size:20px; color:var(--dim); }
.dp-prepbar{ flex:1; height:9px; background:#0d1913; border-radius:99px; overflow:hidden; }
.dp-prepbar span{ display:block; height:100%; background:var(--accent); border-radius:99px; }

.dp-actions{ margin-top:8px; }

@media (prefers-reduced-motion: reduce){
  .dp-intro,.dp-question,.dp-result{ animation:none; }
  .dp-pitch .mk-halo{ animation:none; }
}

/* historial */
.dp-title-sm{ font-size:clamp(28px,7vw,40px); margin-bottom:22px; }
.dp-hlist{ display:flex; flex-direction:column; gap:10px; margin-bottom:20px; }
.dp-hitem{ display:flex; align-items:center; gap:13px; width:100%; text-align:left;
  background:var(--panel); border:1.5px solid var(--line); color:var(--chalk);
  border-radius:13px; padding:13px 15px; cursor:pointer; font-family:'Inter'; transition:.16s; }
.dp-hitem:hover{ border-color:var(--dim); background:#14241b; }
.dp-hnum{ flex:none; width:34px; height:34px; display:flex; align-items:center; justify-content:center;
  font-family:'Oswald'; font-weight:700; font-size:17px; color:var(--accent);
  border:1.8px solid var(--accent); border-radius:9px; }
.dp-hmeta{ flex:1; display:flex; flex-direction:column; gap:3px; min-width:0; }
.dp-hpos{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.04em; font-size:15px; }
.dp-hsub{ color:var(--dim); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dp-hprep{ font-family:'Oswald'; font-size:15px; color:var(--green); flex:none; }
.dp-harrow{ color:var(--dim); font-size:20px; flex:none; }
.dp-clear{ width:100%; background:transparent; border:none; color:var(--dim); font-size:13px;
  padding:12px; cursor:pointer; margin-top:2px; text-decoration:underline; }
.dp-clear:hover{ color:var(--danger); }

/* bases científicas */
.dp-link{ display:block; width:100%; background:transparent; border:none; color:var(--dim);
  font-size:12.5px; padding:10px; margin-top:4px; cursor:pointer; text-decoration:underline; }
.dp-link:hover{ color:var(--accent); }
.dp-abox{ background:var(--panel); border:1.5px solid var(--line); border-radius:14px; padding:16px 18px; margin-bottom:12px; }
.dp-abox p{ color:var(--dim); font-size:13.5px; line-height:1.6; margin:0; }
.dp-abox b{ color:var(--chalk); font-weight:600; }
.dp-atitle{ font-family:'Oswald'; text-transform:uppercase; letter-spacing:.12em; font-size:12px; color:var(--accent); margin-bottom:9px; }
.dp-adisc{ border-color:#4a3c18; background:#1c1810; }
.dp-reflist{ margin:12px 0 22px; padding-left:20px; }
.dp-reflist li{ margin-bottom:12px; font-size:13px; line-height:1.5; }
.dp-reflist a{ color:var(--green); text-decoration:none; }
.dp-reflist a:hover{ text-decoration:underline; }
.dp-refj{ display:block; color:var(--dim); font-size:11.5px; margin-top:2px; }
`;
