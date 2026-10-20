# Traspaso — Detector de posición de fútbol + Panel de resultados

> Documento del **prototipo**. Para el producto (Siempre de Local), manda `docs/00-contexto-proyecto.md`.
>
> Pega este archivo como primer mensaje en una sesión de Cowork, o guárdalo en la carpeta del proyecto junto a los dos `.jsx`. Resume todo lo decidido y lo que queda pendiente para continuar sin repetir contexto.

---

## 1. Objetivo

Un **test interactivo** que, a partir de preguntas de situación de juego, atributos y conocimiento táctico, determina la **posición ideal** de un jugador de fútbol y su **nivel de preparación** para esa posición. Va acompañado de un **panel** para que el entrenador consolide los resultados de todo el equipo.

Uso previsto: repartirlo al equipo por enlace; cada jugador lo responde y descarga su resultado; el entrenador reúne los resultados en el panel para ver la foto de la plantilla.

---

## 2. Entregables (archivos)

| Archivo | Qué es | Tipo |
|---|---|---|
| `detector-posicion.jsx` | El test completo (portada, preguntas, resultado, historial, bases científicas) | Artefacto React |
| `panel-resultados.jsx` | Panel para subir/pegar los CSV y ver el análisis consolidado | Artefacto React |
| `traspaso-proyecto.md` | Este documento | Markdown |

Ambos `.jsx` son artefactos React autónomos (un solo archivo cada uno, con su CSS embebido en un bloque `<style>`). En Cowork se pueden abrir y editar directamente.

---

## 3. Decisiones tomadas (no volver a discutir salvo que se quiera cambiar)

- **Deporte:** fútbol. **Formato seleccionable:** Fútbol 8 y Fútbol 11.
- **Tono:** serio / analítico (no test de revista).
- **8 posiciones** (F11): Portero (1), Lateral (2), Defensa central (4), Pivote (6), Mediocentro (8), Mediapunta (10), Extremo (7), Delantero centro (9).
- **En Fútbol 8** solo compiten 6 posiciones: Portero, Lateral, Defensa central, Mediocentro, Extremo, Delantero. Los puntos de Pivote se pliegan a Mediocentro y los de Mediapunta a Delantero.
- **Estructura del test:** 15 preguntas de posición + 8 de preparación = 23 en total.
  - Las **15 de posición** salen de un **pool de 31** (aleatorias, con opciones también barajadas) y usan **puntuación ponderada**.
  - Las **8 de preparación** son **específicas de la posición ganadora** (banco propio por posición), con respuesta correcta/incorrecta. Decisión de diseño: en preparación NO se aleatoriza *cuáles* salen (se quieren evaluar las 8 competencias clave de esa posición); solo se aleatoriza el orden.
- **Salida:** resultado con pizarra táctica (tu dorsal iluminado), podio (top 3 por afinidad), índice de preparación (X/8) y **descarga de CSV**.
- **Historial:** el test guarda cada resultado con persistencia y permite volver a verlos sin repetir el test.
- **Panel:** consolida CSV (subida o pegado), muestra pizarra de plantilla (con huecos), reparto por posición, tabla ordenable y export consolidado.
- **Bases científicas:** el test incluye una pantalla con la metodología y referencias reales. Es una herramienta de **orientación informada por la literatura**, NO un instrumento validado. Esto se declara explícitamente en la app.

---

## 4. Cómo funciona la lógica por dentro

### 4.1 Puntuación de posición (normalizada)
Cada opción reparte puntos a una o varias posiciones. Para que sea justo aunque cada partida saque 15 preguntas distintas, se **normaliza por exposición**:
- Para cada posición se acumula lo *ganado* y el *máximo posible* (suma, por pregunta servida, del mayor puntaje que esa posición podía obtener en esa pregunta).
- `afinidad% = ganado / máximo_posible`. Se rankea por ese porcentaje.

### 4.2 Plegado de Fútbol 8
Antes de rankear, si el formato es F8: `earned/maxp` de Pivote → Mediocentro, y de Mediapunta → Delantero. Solo se consideran las 6 posiciones elegibles.

### 4.3 Índice de preparación
8 preguntas específicas de la posición ganadora; cada acierto suma 1. El mensaje final depende del ratio (≥85%, ≥60%, ≥37.5%, resto).

### 4.4 Pizarra táctica
Coordenadas por formato (`PITCH_COORDS`), en un `viewBox` 100×150 con la portería propia abajo. Diseño balanceado: lateral a la izquierda, extremo a la derecha (esto corrigió un bug anterior en que ambos quedaban a la izquierda).

### 4.5 Persistencia (historial)
Usa la API de almacenamiento de artefactos (`window.storage`), clave `quiz:history` con un array JSON (máx. 100). Carga al abrir; guarda al terminar; permite borrar. Si el entorno no soporta `window.storage`, degrada a solo-sesión sin romper.

### 4.6 CSV
Con BOM UTF-8 (acentos correctos en Excel/Sheets). Columnas del test: Nombre, Fecha, Formato, Posicion, Afinidad_%, Podio, Preparacion (X/8), Preparacion_%. El panel lee esas columnas de forma tolerante (por nombre, ignorando mayúsculas/guiones/%).

---

## 5. Estado actual

Todo lo anterior está **implementado y funcionando**:
- Test con 31 preguntas de posición + 64 de preparación (8 por posición), F8/F11, pizarra corregida.
- Pregunta de "vestuario" reemplazada por una situación de juego.
- Historial con persistencia y revisión de resultados anteriores.
- Pantalla de bases científicas con 9 referencias enlazadas.
- Panel con subida por `<label>` nativo + opción de pegar CSV (para móvil), pizarra de plantilla, reparto, tabla ordenable y export.

---

## 6. Pendientes / ideas ya conversadas

1. **Afinar ponderaciones** pregunta por pregunta para que reflejen los valores concretos de los estudios (p. ej. distancias/sprints por posición).
2. **Estudio de validación** con el propio equipo: cada jugador hace el test, se compara con la posición donde el cuerpo técnico lo ve, y se calcula el % de acierto real del club.
3. **Panel con historial propio** (que recuerde entre sesiones los CSV ya cargados vía `window.storage`).
4. **Preparación media por posición** en el panel (ver si quienes dan "central" están de verdad preparados).
5. **Filtro por formato** y **marcar en rojo** baja preparación en la tabla del panel.
6. **Compartir con el equipo:** confirmar la vía (enlace de artefacto vs. publicar como página web en un hosting) según cómo funcione el compartir en la app.

---

## 7. Notas técnicas para continuar

- Son artefactos React de **un solo archivo**; CSS en un `<style>` embebido; fuentes Google Fonts (Oswald + Inter) por `@import`.
- **No usar** `localStorage`/`sessionStorage` en artefactos; el estado vive en React y la persistencia va por `window.storage`.
- Sin `<form>`: se usan `onClick`/`onChange`.
- El panel usa `papaparse` para leer CSV.
- Paleta (pizarra táctica): fondo verde muy oscuro, blanco tiza, ámbar de acento, verde de barras.

---

## 8. Referencias científicas incluidas en el test

- Di Salvo et al. — Performance characteristics according to playing position in elite soccer (*Int J Sports Med*).
- Demandas físicas por posición con GPS: MLS (2024), Ekstraklasa (2023), juveniles U19 4-3-3 (2025), fútbol femenino (2023).
- Perfil antropométrico por posición: muestra de 618 jugadores (2019); metaanálisis de composición corporal (*Applied Sciences*, 2023).
- Identificación de talento multidimensional: modelo GoldFit / Gold Score Soccer (*Res Q Exerc Sport*, 2024); rendimiento y selección en juveniles.
- Clasificación de posición con atributos físicos, técnicos, tácticos y psicológicos (machine learning; Springer, 2023).

**Conclusión de la revisión:** las preguntas coinciden con el consenso de la ciencia del rendimiento (mediocentros = más distancia; laterales/extremos/delanteros = más alta velocidad; centrales = menos; porteros/centrales más altos y fuertes en juego aéreo). Sigue siendo una herramienta de orientación, no un diagnóstico validado.
