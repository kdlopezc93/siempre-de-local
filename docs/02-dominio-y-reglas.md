# 02 · Dominio y reglas de negocio

> Todo lo de este documento vive en `packages/domain` (TS puro) y se prueba sin base de datos ni red.

---

## 1. Posiciones

| Clave | Nombre | Dorsal | F11 | F8 |
|---|---|---|---|---|
| POR | Portero | 1 | ✔ | ✔ |
| LAT | Lateral | 2 | ✔ | ✔ |
| DFC | Defensa central | 4 | ✔ | ✔ |
| MCD | Pivote | 6 | ✔ | → MC |
| MC | Mediocentro | 8 | ✔ | ✔ |
| MP | Mediapunta | 10 | ✔ | → DC |
| EXT | Extremo | 7 | ✔ | ✔ |
| DC | Delantero centro | 9 | ✔ | ✔ |

Orden canónico: `POR, LAT, DFC, MCD, MC, MP, EXT, DC`.

Coordenadas de pizarra (viewBox 100×150, portería propia abajo), **fuente única** en `domain/pitch-layout.ts`:

- F11: POR 50,139 · LAT 20,113 · DFC 50,116 · MCD 50,97 · MC 64,80 · MP 36,60 · EXT 80,64 · DC 50,36
- F8: POR 50,139 · LAT 26,113 · DFC 60,115 · MC 42,86 · EXT 73,72 · DC 50,42

> En el prototipo el panel tenía su propia copia de `POSITIONS` con coordenadas distintas. Se elimina.

El jugador puede declarar en su perfil sus **posiciones preferidas** (1–3). Es un dato distinto del resultado del test y de la valoración del entrenador; los tres conviven.

---

## PARTE A · Test de orientación (heredado)

## 2. Cuestionario

- **Banco de posición:** 31 ítems (`p1`…`p31`), 4 opciones; cada opción reparte puntos enteros a 1–3 posiciones. Contexto: `Situación` o `Atributo`.
- **Versionado:** `QuestionnaireVersion` inmutable una vez publicado. Cambiar un peso = nueva versión. Publicar una versión retira la anterior; los intentos viejos siguen apuntando a la suya.
- **v1** (contenido del prototipo, histórico): 15 ítems de posición por intento + 8 de preparación de la ganadora.
- **v2** (vigente desde el 2026-10-21): **solo posición**, los mismos 31 ítems, **20 por intento**. Sin preparación (§5).
- Objetivo de contenido: ampliar el banco a ~40 ítems para que dos intentos no se parezcan tanto (Fase 8).

## 3. Flujo de un intento (v2)

1. Se eligen **20 ítems aleatorios** del banco de posición; se barajan también las opciones. Se guarda **qué ítems salieron, en qué orden y en qué orden se mostraron sus opciones**.
2. El jugador responde los 20, con o sin conexión.
3. El celular calcula un **podio provisional** con el mismo `@sdl/domain` (para mostrarlo sin conexión).
4. El envío llega al servidor, que calcula el **resultado oficial** (§4).
5. Resultado: **podio (top 3)** como resultado principal, ranking completo y la invitación a hacer el **examen de conocimiento** de cualquiera de las tres.

Total: 20 preguntas. *(Bug del prototipo: la portada decía "20" cuando eran 23. Con v2, ahora sí son 20.)*

## 4. Puntuación de posición (normalizada por exposición)

```
max_q(p)    = máximo de opt.pts[p] entre las opciones de q   (0 si ninguna da puntos a p)
earned(p)   = Σ_q  elegida_q.pts[p]
maxp(p)     = Σ_q  max_q(p)
afinidad(p) = maxp(p) > 0 ? earned(p) / maxp(p) : 0
```

**Plegado F8** (antes de rankear): `earned/maxp` de MCD → MC y de MP → DC. Solo compiten las 6 elegibles.

**Ranking:** descendente por afinidad. **Empates:** mayor `earned` absoluto; si persiste, orden canónico. Determinista para que cliente y servidor coincidan. *(El prototipo desempataba solo por orden canónico; es el único cambio frente a él y lo cubren los tests de paridad de `position-scoring.test.ts`.)*

**Podio:** las 3 primeras del ranking. La primera es la "ganadora", pero la app presenta las tres como opciones: el test orienta, no encasilla.

```ts
scorePosition(items: ServedPositionItem[], answers: OptionId[], format: 'F8' | 'F11'): RankingEntry[]
```

Versión del algoritmo: `orientation-v2` (`ORIENTATION_SCORING_VERSION`), que se guarda en `attempt_result.scoring_version`. La afinidad se calcula igual que en `orientation-v1`; cambió el test (sin preparación).

## 5. Preparación (retirada en v2)

En v1, tras las 15 de posición se servían 8 preguntas de conocimiento de la posición ganadora (`prepScore` = aciertos sobre 8, con bandas). **Se retiró el 2026-10-21:**
- **Su contenido no medía bien:** en las 64 preguntas la correcta era siempre la más larga y matizada, y las incorrectas eran absolutos ("siempre", "nunca"); quien detectara el patrón acertaba sin saber fútbol.
- **Duplicaba la certificación** (Parte B), que mide el conocimiento de una posición con un banco escrito con reglas de calidad (§6.5).

Consecuencia: hasta que exista la certificación (Fase 4) no hay medida de conocimiento; el cuerpo técnico cuenta con la tarjeta (§7) y su valoración. Los intentos v1 conservan `prep_score`/`prep_total` como histórico.

---

## PARTE B · Certificación por posición (nuevo)

## 6. Examen de conocimiento por posición

### 6.1 Propósito
Medir con más rigor el conocimiento táctico de un jugador sobre **una posición concreta** y convertirlo en un **puntaje de conocimiento** que se ve en su perfil y que el planificador usa como peso.

**Principio:** si alguien responde bien es porque conoce el puesto, y no tiene que volver a demostrarlo. **El puntaje no caduca.** Repetir el examen es opcional y sirve para quien sacó poco y quiere mejorar.

**No hay aprobado ni suspenso.** Cada examen da un valor; la app no bloquea a nadie por sacar poco, solo le da menos peso en el planificador.

**Qué mide y qué no (debe decirlo la app):** lo que el jugador respondió en un examen dentro de la app sobre los principios tácticos de la posición. No mide si los ejecuta en el campo y no es un título federativo. El examen se hace desde el móvil sin supervisión: no se puede impedir que alguien consulte; se mitiga (§6.3), no se elimina.

### 6.2 Banco de preguntas
- Banco **propio por posición**, separado del test de orientación.
- Tamaño: **mínimo 40 ítems por posición para publicar; objetivo 60.** Un jugador que repite cada mes puede ver muchas preguntas; con 20 por examen y prioridad a las no vistas, un banco de 60 aguanta tres intentos sin repetir ninguna.
- Cada ítem lleva:
  - **Área de competencia** de la posición (ej. DFC: marcaje, línea defensiva y fuera de juego, juego aéreo, salida de balón, balón parado, coberturas).
  - **Dificultad** 1–3.
  - Enunciado, 4 opciones, 1 correcta y una **explicación** (uso interno y para feedback futuro).
- Tipos de ítem: v1 texto de opción múltiple; v2 **situación sobre pizarra** (SVG con jugadores colocados), que mide mejor la lectura de juego que el texto.

### 6.3 Reglas del examen (valores iniciales, configurables por versión del banco)

| Parámetro | Valor inicial |
|---|---|
| Ítems por examen | 20 |
| Selección | **Estratificada** (todas las áreas, ~30% fácil · 50% media · 20% difícil) y **priorizando ítems que el jugador no haya visto** en sus intentos anteriores |
| Tiempo máximo | 20 min, controlado por el servidor |
| Resultado | Puntaje `pct` (aciertos / 20). Sin umbral de aprobado |
| **Frecuencia** | **1 intento por posición cada 30 días**, cuente como cuente el resultado |
| **Caducidad del puntaje** | **Ninguna** |
| Qué puntaje cuenta | El **mejor** intento válido de esa posición |
| Exámenes activos simultáneos | 1 por jugador (posiciones distintas pueden presentarse el mismo mes, de una en una) |

- **Por qué el mejor y no el último:** repetir es para mejorar, así que un mal día no debe borrar lo que ya demostró. Contar el mejor sería peligroso si se pudiera repetir sin límite (insistir hasta tener suerte); con un intento al mes ese abuso desaparece: como mucho son 12 intentos al año por posición.
- **La espera de 30 días es la única barrera**, y aplica igual a quien sacó 40% que a quien sacó 95%: a este último simplemente no le hace falta volver.
- Se puede examinar de **cualquier posición**; la app sugiere la ganadora del test y las preferidas, y cuando el mes se cumple avisa a quien tiene un puntaje bajo que ya puede volver a intentarlo.
- Al terminar se muestra el puntaje y el desglose **por área** (así sabe qué estudiar para el siguiente intento), **no** las respuestas correctas.
- Si se acaba el tiempo o abandona, lo no respondido cuenta como fallo y el intento consume el mes.

### 6.4 Bandas (solo para mostrar)

| `pct` | Banda |
|---|---|
| ≥ 0.85 | Dominio |
| 0.70–0.84 | Sólido |
| 0.50–0.69 | En desarrollo |
| < 0.50 | Insuficiente |

Las bandas no bloquean nada; son la etiqueta que ven el jugador y el entrenador. El peso en el planificador sale del valor, no de la banda (§9.1).

### 6.5 Calidad del banco
"Más certero" sale de que las preguntas sean buenas:
1. **Revisión de contenido** por al menos un entrenador antes de publicar.
2. **Reglas de redacción** comprobadas al publicar (*lint*): la correcta no puede ser sistemáticamente la más larga; nada de distractores con absolutos obvios ("siempre", "nunca"); distractores plausibles.
3. **Análisis de ítems** con ≥ 30 respuestas por ítem: retirar los que acierta casi todo el mundo (> 95%) y los que discriminan al revés. Los cambios se publican como **nueva versión** del banco.

**Consecuencia de que el puntaje no caduque:** un puntaje sacado con una versión del banco que luego resultó mala (preguntas demasiado fáciles) seguiría contando para siempre. Mitigación: al retirar una versión por problemas de calidad, el admin puede marcar sus puntajes **"a revisar"**; siguen visibles, pero el entrenador ve el aviso y el jugador puede presentar de nuevo sin esperar el mes. Es una acción excepcional y queda auditada.

### 6.6 Estado de un intento
- **Válido:** cuenta para calcular el mejor puntaje.
- **Anulado:** el entrenador lo anula con motivo obligatorio (p. ej. lo hizo otra persona). Deja de contar y pasa a valer el mejor de los restantes. Anular **no** reinicia la espera de 30 días, salvo que el entrenador lo indique.
- **A revisar:** ver §6.5.
- **Sustituido:** intentos anteriores a una re-evaluación completada (§6.7). Quedan en el historial, pero ya no cuentan para el mejor puntaje. Tampoco marcan la espera del mes: la marca la re-evaluación que los sustituyó.
- **Anular el examen de una re-evaluación** es como si no se hubiera presentado: los intentos que había sustituido vuelven a contar y la re-evaluación se reabre (pendiente, o vencida si ya pasó su plazo), salvo que ya se haya pedido otra de esa posición.

Cada intento guarda la versión del banco con la que se hizo.

### 6.7 Re-evaluación solicitada por el entrenador
El entrenador puede pedirle a un jugador que vuelva a presentar el examen de una posición cuando cree que el puntaje ya no refleja lo que sabe (por ejemplo, tácticamente no está aplicando lo que el examen dice que conoce, o sospecha que no lo hizo él).

**Reglas:**
1. **Motivo obligatorio**, visible para el jugador y registrado en auditoría. Evita usarlo como castigo sin explicación.
2. **Salta la espera de 30 días:** el jugador puede presentar de inmediato.
3. **Plazo para presentar:** 14 días por defecto (el entrenador puede ajustarlo).
4. **Mientras está pendiente**, el puntaje anterior sigue contando en el planificador, pero marcado "en re-evaluación" para que el entrenador lo vea.
5. **El resultado de la re-evaluación reemplaza al anterior, aunque sea más bajo.** Es la diferencia clave con un intento normal: si siguiera contando el mejor, re-evaluar no serviría de nada, porque nunca podría bajar. Los intentos previos pasan a "sustituidos"; desde ahí el mejor puntaje se calcula solo con la re-evaluación y los intentos posteriores.
6. **Si vence el plazo sin presentar**, el puntaje de esa posición cuenta como **0** en el planificador hasta que presente. El entrenador puede cancelar la solicitud antes del plazo.
7. Tras la re-evaluación vuelve la regla normal: un intento cada 30 días para mejorar.
8. Una solicitud pendiente por jugador y posición a la vez.

**Límite de lo que arregla:** el examen mide conocimiento. Si el problema es que el jugador sabe pero no rinde en el campo, la re-evaluación probablemente confirme el mismo puntaje; eso se refleja mejor en la **tarjeta 0–99** y en la **valoración del entrenador**, que también pesan en el planificador.

La re-evaluación aplica **solo al examen de conocimiento**. El test de orientación es independiente y no se ve afectado.

Implementado en `@sdl/domain` (`knowledge.ts`, `bank-lint.ts`):

```ts
DEFAULT_EXAM_CONFIG          // 20 ítems · 30/50/20 · 30 días · 20 min · 40 para publicar
selectExamItems(bank, seenItemIds, cfg, rng)   // no vistos primero, todas las áreas, mezcla de dificultad
scoreExam(items, answers)    // { score, total, pct (3 decimales), band, byArea }; sin responder = fallo
bandFor(pct)                 // §6.4
bestKnowledge(exams, position)                 // mejor válido; ignora anulados, vencidos y sustituidos
canStartExam(exams, position, now, { pendingReview })  // un activo a la vez; 30 días desde el inicio
                             // del último; sin espera si "a revisar", anulado con reinicio o re-evaluación
lintBank(draft, cfg)         // errores (tamaño, 4 opciones, 1 correcta, áreas, cupo por dificultad)
                             // y avisos (correcta casi siempre la más larga, absolutos en distractores)
```

---

## PARTE C · Perfil y tarjeta del jugador (nuevo)

## 7. Tarjeta de atributos (0–99)

Inspirada en las cartas de los videojuegos de fútbol, sin usar su marca ni su diseño.

**Atributos de campo:** Ritmo (RIT), Tiro (TIR), Pase (PAS), Regate (REG), Defensa (DEF), Físico (FIS).
**Atributos de portero** (opcionales, solo si el jugador juega o podría jugar de portero): Estirada, Manejo, Saque, Reflejos, Velocidad de reacción, Colocación.

### 7.1 Escala con anclas
Sin anclas, el "75" de un entrenador no es el "75" de otro. Referencia: **el nivel de la categoría o liga en la que juega el equipo**, no el fútbol profesional.

| Rango | Significado |
|---|---|
| 85–99 | Referencia en la categoría en este aspecto |
| 70–84 | Destaca claramente en el equipo |
| 55–69 | Nivel medio del equipo |
| 40–54 | Por debajo del nivel del equipo |
| < 40 | Carencia importante |

La UI muestra estas anclas al puntuar.

### 7.2 Reglas
- Puntúan **coach** y **assistant**. Cada puntuación es una **foto** con fecha, autor y origen (`manual` o `field_test`). Se conserva el histórico: la tarjeta muestra la última y la evolución.
- Si hay varios evaluadores, la tarjeta muestra la última foto; el promedio entre evaluadores queda para más adelante.
- **Visibilidad para el jugador:** ajuste por equipo (D8, decidido: por defecto visible; lo cambian el coach o el admin del club). El jugador ve la última foto con sus medias, nunca las notas ni quién puntuó.
- **Atributos de portero:** los 6 o ninguno; los agrega el cuerpo técnico cuando el jugador juega o podría jugar de portero.

### 7.3 Media por posición (MP)
`MP(p) = Σ peso(p, atributo) · valor(atributo)`. Pesos iniciales, a calibrar con el uso:

| Pos. | RIT | TIR | PAS | REG | DEF | FIS |
|---|---|---|---|---|---|---|
| LAT | .25 | – | .20 | .10 | .30 | .15 |
| DFC | .10 | – | .15 | – | .45 | .30 |
| MCD | – | – | .35 | .10 | .35 | .20 |
| MC | – | .15 | .35 | .15 | .15 | .20 |
| MP | .10 | .25 | .35 | .30 | – | – |
| EXT | .35 | .15 | .15 | .35 | – | – |
| DC | .20 | .45 | – | .15 | – | .20 |

POR (atributos de portero): Estirada .20 · Manejo .20 · Reflejos .25 · Colocación .20 · Saque .10 · Velocidad de reacción .05. Si el jugador no tiene atributos de portero, `MP(POR)` no existe.

En F8 se usan MC y DC como en F11 (el plegado solo afecta al test).

Los pesos viven en código versionado (`rating-formula-v1`), no en la BD, igual que el algoritmo del test.

## 8. Pruebas de campo (futuro — diseño preliminar, no implementar aún)

Objetivo: sustituir o complementar la puntuación manual con **mediciones**.

| Prueba candidata | Unidad | Mejor si | Alimenta |
|---|---|---|---|
| Sprint 30 m / 50 m | segundos | menor | RIT |
| Circuito de conos con cambios de dirección (slalom o test de agilidad tipo Illinois) | segundos | menor | REG (agilidad) |
| Precisión de tiro (x/10 a zonas marcadas) | aciertos | mayor | TIR |
| Precisión de pase a objetivo (x/20) | aciertos | mayor | PAS |
| Prueba de resistencia intermitente (tipo Yo-Yo) | metros / nivel | mayor | FIS |

Cosas a resolver antes de implementarlo:
- **Protocolo estándar** (superficie, calentamiento, 2–3 intentos y se toma el mejor, método de cronometraje). Fotocélulas y cronómetro manual dan tiempos distintos; hay que registrar el método.
- **Conversión a 0–99:** interpolación lineal entre marcas de referencia (valor que equivale a 40 y a 99), definidas por categoría y sexo, o percentiles dentro del propio equipo. La primera opción es más estable; la segunda no necesita referencias externas.
- **Mezcla con lo manual:** si hay prueba reciente (p. ej. < 90 días) manda la prueba; si no, la puntuación manual.

---

## PARTE D · Planificador de alineaciones

## 9. Encaje jugador–posición y asignación

### 9.1 Fuentes por (jugador, posición)

| Señal | Valor 0–1 | Si falta |
|---|---|---|
| **A** · Afinidad del test (último intento oficial; en F8, plegada) | afinidad | se excluye y se renormaliza |
| **V** · Valoración del entrenador | principal 1.0 · secundaria 0.6 · otra 0 | se excluye y se renormaliza |
| **C** · Conocimiento en esa posición (mejor intento no sustituido) | `K = max(0, (pct − 0.25) / 0.75)` | **0** (no haber presentado es información). También 0 si tiene una re-evaluación vencida sin presentar |
| **R** · Media por posición de la tarjeta | `MP / 99` | se excluye y se renormaliza |

```
encaje(j, p) = Σ wᵢ · sᵢ / Σ wᵢ      (solo sobre las señales disponibles)
coste(j, p)  = 1 − encaje(j, p)
```

**Por qué `K` y no `pct` directo:** con 4 opciones, responder al azar da un 25% de media. Sin corregir, un jugador que no sabe nada aportaría 0.25 de conocimiento. Con la corrección, el azar vale 0 y el 100% vale 1. Ejemplos: 50% → 0.33 · 70% → 0.60 · 85% → 0.80.

Así el peso en el planificador **crece con lo que sacó**: no es "certificado sí/no", es cuánto sabe según su mejor examen en esa posición.

Si a un jugador le faltan A, V y R a la vez, se marca "sin datos" y se coloca al final.

### 9.2 Modos de prioridad (pesos iniciales)

| Modo | A | V | C | R | Para qué |
|---|---|---|---|---|---|
| Equilibrado (defecto) | .15 | .30 | .20 | .35 | Uso normal |
| Rendimiento | .05 | .30 | .15 | .50 | Partido importante: manda lo demostrado |
| Desarrollo | .35 | .20 | .25 | .20 | Probar a jugadores donde se ven y se han formado |

Restricción opcional **"conocimiento mínimo"** (apagada por defecto): el entrenador fija un umbral de `pct` (p. ej. 0.70) y una posición en la que el jugador no tenga un puntaje por encima de él cuesta infinito. Si así no hay solución completa, el planificador lo dice y propone la mejor solución sin la restricción.

### 9.3 Asignación
- **Algoritmo húngaro** sobre la matriz jugadores × huecos de la formación (rellenando con huecos ficticios si hay más jugadores que huecos: esos son los suplentes).
- El entrenador puede **fijar** a un jugador en un hueco antes de resolver.
- Cada asignación devuelve su **desglose** (A, V, C, R y modo) para que el entrenador entienda por qué.

### 9.4 Nota crítica sobre mezclar escalas
El húngaro compara costes **entre jugadores**. R, C y V sí son comparables entre jugadores; A no lo es (es ipsativa, §10). Por eso A tiene poco peso salvo en modo Desarrollo. Si con datos reales A distorsiona las alineaciones, se baja su peso.

### 9.5 Reconciliación con el prototipo (D6, 2026-10-22)
El prototipo `planificador-partido.jsx` (solo F8) puntuaba en tres niveles (posición exacta → podio del test → estimación por perfil físico y posiciones afines) y tenía los modos Equilibrado / Priorizar defensa / Priorizar ataque / Manual. Se conserva su **mecánica** y se cambia su **puntaje** por el encaje v2:
- **Se conserva:** el húngaro (portado tal cual y verificado contra fuerza bruta), las 4 formaciones de F8 con sus coordenadas, la **prioridad por línea** (esa línea se resuelve primero con toda la plantilla), la convocatoria, el armado a mano (ubicar e intercambiar) y la banca.
- **Se reemplaza:** los tres niveles por el encaje A/V/C/R. La estimación física desaparece (no guardamos altura ni peso); las posiciones afines quedan cubiertas por la valoración secundaria, la afinidad del test en todas las posiciones y las medias de la tarjeta.
- **Modos:** dos controles independientes: los pesos (Equilibrado / Rendimiento / Desarrollo) y la línea que se arma primero (ninguna / defensa / ataque). Manual es siempre posible tocando la pizarra.
- **F11:** 1-4-3-3 (por defecto), 1-4-4-2, 1-4-2-3-1 y 1-3-5-2. **F8:** 1-3-3-1 (por defecto), 1-2-4-1, 1-3-4 y 1-2-3-2 (D12).
- **A ciegas:** para quien todavía no valoró a un jugador, su test (A) no se usa: se excluye y se renormaliza.
- **Dónde se calcula:** en el celular (el dominio es compartido), así funciona sin señal en la cancha; el servidor guarda las alineaciones.
- **Formato por partido** (2026-10-22): un equipo puede jugar la liga en F11 y un torneo en F8. El planificador deja elegir el formato del partido (por defecto, el del equipo) y la alineación guardada es del formato de su formación. Para F8, `adaptSignals` pliega las señales: pivote → mediocentro y mediapunta → delantero en test, valoración y conocimiento (vale el mejor de los dos; con solo el % por posición no se puede rehacer el plegado exacto del test), y la tarjeta usa sus medias de mediocentro y delantero tal cual (§7.3).

Implementado en `@sdl/domain/lineup` (`fit-v1`):

```ts
FORMATIONS, DEFAULT_FORMATION, formationsFor(format), LINE_OF
MODE_WEIGHTS, knowledgeSignal(pct), signalsFor(player, position), fit(player, position, weights)
assign(cost)                 // húngaro para matrices de cualquier forma
solveLineup({ formation, players, weights, pins?, minKnowledgePct?, priority? })
  // → { assignments: [{ slotId, playerId, fit, breakdown, pinned }], bench, warnings }
lineRatings(formation, assignments)   // encaje medio por línea, 0–100
```

Avisos: `NOT_ENOUGH_PLAYERS`, `PLAYER_WITHOUT_DATA` (va al final), `MIN_KNOWLEDGE_INFEASIBLE` (se arma igual con el mejor) y `KNOWLEDGE_REVIEW_EXPIRED`.

---

## PARTE E · Límites y validación

## 10. Limitaciones (condicionan la UI)

1. **Afinidad ipsativa:** compara posiciones *dentro* de un jugador. En el panel no se ordenan ni promedian afinidades entre jugadores.
2. **Ítems transparentes y sesgo de prestigio** en el test (muchos quieren ser 9 o 10). Se mitiga con la valoración del entrenador y la tarjeta.
3. **Muestreo aleatorio** reduce la fiabilidad entre intentos; se mide gracias a los ítems guardados. Con 20 de 31 (v2) pesa menos que con 15, pero dos intentos comparten muchas preguntas.
4. **Tarjeta subjetiva:** depende del criterio del entrenador; las anclas (§7.1) y en el futuro las pruebas de campo la objetivan.
5. **Examen sin supervisión:** mide conocimiento en un examen abierto; ver §6.1. Como el puntaje no caduca, no refleja si el jugador ha olvidado algo con el tiempo.
6. Ni el test ni la certificación miden rendimiento en partido.

| Escala | ¿Comparable entre jugadores? |
|---|---|
| Afinidad del test | No |
| Preparación x/8 (solo intentos v1) | Con cautela (preguntas débiles) |
| Puntaje de conocimiento | Sí, dentro de la misma posición y versión del banco |
| Tarjeta 0–99 y MP | Sí, dentro del mismo equipo y evaluador |

## 11. Validación interna

- Por jugador: posición del test vs. valoración del entrenador (solo valoraciones `blind`). **A ciegas lo impone la app:** quien valora (coach o assistant) no ve el test de un jugador hasta registrar su primera valoración de él; esa queda `blind = true`. El admin del club no valora y ve los resultados.
- Métricas: % de coincidencia exacta, % dentro del podio, matriz de confusión por posición.
- Nuevo: relación entre **puntaje de conocimiento** y **MP** de la posición (¿quien más sabe de una posición tiene mejor tarjeta ahí?).
- Implementación (`packages/domain/src/validation.ts`, Fase 5):
  - Test vs. cuerpo técnico: por cada valoración `blind` de un jugador activo con test, la principal del cuerpo técnico frente al podio vigente. Exacta = primera del podio; dentro del podio = cualquiera de las tres. La matriz se muestra como lista de pares (cuerpo técnico → test) de más a menos frecuente.
  - Conocimiento vs. tarjeta: por posición, mejor puntaje vigente de cada jugador frente a su media de la tarjeta en esa posición. Correlación de **Spearman** (rangos, empates promediados), solo con **≥ 5 jugadores**; en palabras: |ρ| ≥ 0,6 fuerte, ≥ 0,4 moderada, ≥ 0,2 débil, si no, sin relación clara.
  - Para quien valora (coach o assistant), el informe solo cuenta a los jugadores que ya valoró, así no destapa tests por el costado. El admin del club ve todo.
  - La pantalla avisa que con menos de 10 valoraciones a ciegas es temprano para concluir.

## 12. Importación de CSV heredados — descartada

**Decidido el 2026-10-22: no se importan los resultados del prototipo.** El test cambió (v2: 20 preguntas, podio y sin preparación), así que esos resultados no son comparables con los nuevos; los jugadores vuelven a hacer el test en la app. Se implementó y se retiró antes de fusionar (PR #37); si algún día hiciera falta, está en el historial de esa rama.

## 13. Partidos (Fase 7)

- **Convocatoria:** el cuerpo técnico (coach y assistant, `team.matches.write`) crea un partido con formato (uno de los que juega el equipo, D14), fecha y hora con zona horaria, lugar y rival (texto libre, 1 a 80 caracteres). Tiene que ser en el futuro.
- **Abierto hasta la hora del partido** (`isMatchOpen`, D17): mientras está programado y no empezó, cada jugador responde **voy / no voy** y puede cambiar; el cuerpo técnico lo edita, lo cancela y publica o republica la alineación. Cancelado o empezado, queda fijo (409 `MATCH_CLOSED`).
- **Respuestas:** las cuenta `replySummary` entre los **jugadores activos** (quien salió del equipo no cuenta). El equipo ve cuántos van, no van y faltan; **quién respondió qué** lo ven el cuerpo técnico y el admin del club, no los compañeros.
- **Alineación del partido** (PR 3): el planificador abre con su formato y, convocados, los que dijeron **voy**; la alineación queda ligada al partido (`lineup.match_id`, del mismo formato: 422 `LINEUP_FORMAT_MISMATCH`). **Publicarla** la deja como la del partido; se **republica** (otra o la misma con cambios) hasta la hora del partido (409 `MATCH_CLOSED`). Solo se publica una ligada a un partido (422 `LINEUP_WITHOUT_MATCH`).
- **Alineación publicada** (PR 4): la ve todo el equipo en el partido, con la cancha, titulares y suplentes, y cada jugador ve dónde juega ("Eres titular: Lateral por la izquierda", "Vas al banco", "Esta vez no estás en la lista"). **Sin encaje, desglose ni pesos** (D17). En el inicio: "Ya está la alineación" hasta la hora del partido.
- **Avisos** (D16): siempre en "lo que toca" del inicio; además, **notificaciones push** si el jugador las activa en Tu cuenta (en iPhone, con la app agregada al inicio). Avisan la convocatoria ("Te convocaron: Los Pibes") y la alineación publicada ("Ya está la alineación"); la hora la formatea el celular. Llevan solo rival, hora y a dónde ir.
- **Después del partido** (D18, PR 6): desde la hora del partido (`hasMatchStarted`; cancelado, nunca), el cuerpo técnico carga el **resultado** (goles a favor y en contra) y, si quiere, la **figura del partido** (un jugador activo); lo ve todo el equipo. Se puede corregir después: no hay plazo.
  - **Evaluación** de cada jugador que jugó: **1 Flojo · 2 Regular · 3 Bien · 4 Muy bien · 5 Figura** (`MATCH_RATING_LABELS`), con nota opcional (≤ 280). Una por jugador y partido: quien la corrige la reemplaza y queda como autor. Se quita si al final no jugó. La figura del partido es aparte: varios pueden jugar "de figura", uno es **la figura del partido**.
  - **Quién ve qué:** el cuerpo técnico y el admin del club, todas con notas y autor; cada jugador, **la suya sin nota ni autor, si el equipo lo permite** (`team.match_ratings_visible_to_players`, por defecto sí, igual que la tarjeta en D8; lo cambian el coach o el admin del club). Los compañeros no ven las evaluaciones de los demás.
  - **Todavía no alimenta** el planificador ni la validación: eso cambia la puntuación y espera datos reales (Fase 8). Mientras, el cuerpo técnico ve la evaluación partido a partido en la ficha del jugador.

## Afirmaciones de la app (principio 8 de `07`)

Revisadas el 2026-10-22 (Fase 6, PR 11). La app no promete lo que no mide:
- **"En qué se basa el test"** (`features/science`):
  - cada afirmación sale de una referencia verificada (leída en PubMed Central o confirmada por DOI en Crossref);
  - lo que es criterio del test se dice como criterio (p. ej., que "fuerza y juego aéreo" sume a central y delantero);
  - se corrigió que los estudios de la MLS usan seguimiento óptico, no GPS, y que solo los porteros son de forma consistente los más altos y pesados.
- **Sin tiempos no medidos:** se quitó "toma unos 5 minutos" hasta medirlo con datos reales (`quiz_attempt.started_at` / `submitted_at`).
- **Sin envío en segundo plano:** la cola sin conexión envía con la app abierta (`use-outbox`), así que se dice "cuando tengas señal y abras la app".
- **La afinidad compara las respuestas** con lo que pide cada posición, no "tu forma de jugar".
