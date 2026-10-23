import { Screen } from '../../shared/ui/Screen';
import styles from './SciencePage.module.css';

/**
 * Fuentes verificadas el 2026-10-22: las de PubMed Central leídas; las demás confirmadas por
 * su DOI en Crossref. Enlaces por DOI o PMC (no se rompen).
 */
const REFERENCES = [
  {
    title:
      'Di Salvo et al. — Performance characteristics according to playing position in elite soccer',
    source: 'Int J Sports Med, 2007',
    url: 'https://doi.org/10.1055/s-2006-924294',
  },
  {
    title: 'Collins et al. — Demandas físicas de la MLS por posición (seguimiento óptico)',
    source: 'PLoS One, 2025',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12551844/',
  },
  {
    title: 'Bortnik et al. — Demandas físicas por posición en transiciones (Ekstraklasa)',
    source: 'Biology of Sport, 2024',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10955741/',
  },
  {
    title: 'Čaušević et al. — Quién corre más en un 4-3-3 (juveniles U19)',
    source: 'Sensors, 2025',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12473318/',
  },
  {
    title: 'Leão et al. — Perfil antropométrico según la posición (618 jugadores)',
    source: 'Int J Environ Res Public Health, 2019',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6651378/',
  },
  {
    title:
      'Sebastiá-Rico et al. — Composición corporal por posición: revisión sistemática y metaanálisis',
    source: 'Applied Sciences, 2023',
    url: 'https://doi.org/10.3390/app13084782',
  },
  {
    title: 'Lago-Peñas et al. — Características de rendimiento y selección en juveniles',
    source: 'J Hum Kinet, 2014',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4096087/',
  },
  {
    title: 'Werneck et al. — Goldfit Soccer: modelo multidimensional de identificación de talento',
    source: 'Res Q Exerc Sport, 2024',
    url: 'https://doi.org/10.1080/02701367.2024.2347983',
  },
  {
    title: 'Sujatha et al. — Predecir la posición con machine learning',
    source: 'Springer, 2023',
    url: 'https://doi.org/10.1007/978-981-99-3656-4_29',
  },
];

/** /bases — en qué se apoya el test (pantalla de metodología del prototipo, al día con v2). */
export function SciencePage() {
  return (
    <Screen className={styles.screen}>
      <h1 className={styles.title}>En qué se basa el test</h1>
      <p className={styles.lead}>
        Es una <strong>orientación</strong>: se apoya en estudios de rendimiento, pero no está
        validado con tu equipo. El cuerpo técnico puede medir si acierta en su informe de
        validación.
      </p>

      <section className={styles.block}>
        <h2>Lo que exige cada posición</h2>
        <p>
          En los estudios de seguimiento de partidos, los <strong>mediocentros</strong> son los que
          más distancia recorren; <strong>laterales y extremos</strong>, los que más corren a alta
          velocidad y esprintan; los <strong>centrales</strong>, los que menos. Por eso
          &quot;resistencia&quot; suma a mediocentro y &quot;velocidad punta&quot; a extremo y
          lateral.
        </p>
      </section>

      <section className={styles.block}>
        <h2>El cuerpo</h2>
        <p>
          Los <strong>porteros</strong> son, en todas las edades estudiadas, los más altos y
          pesados. Entre los de campo las diferencias son menores y cambian con la edad. Que
          &quot;fuerza y juego aéreo&quot; sume a central y delantero es un criterio del test, no un
          dato de estos estudios.
        </p>
      </section>

      <section className={styles.block}>
        <h2>Varias cosas a la vez</h2>
        <p>
          Los modelos que buscan talento o predicen la posición combinan lo físico, lo técnico, lo
          táctico y lo psicológico. Por eso el test mezcla situaciones de juego con tus cualidades.
        </p>
      </section>

      <section className={styles.warning}>
        <h2>Lo que no es</h2>
        <p>
          No reemplaza la mirada de tu entrenador ni predice cómo vas a rendir. Tu afinidad compara
          posiciones dentro de ti, no con otros jugadores. Lo que sabes de una posición se mide
          aparte, con el examen de conocimiento.
        </p>
      </section>

      <section>
        <h2 className={styles.refsTitle}>Referencias</h2>
        <ol className={styles.refs}>
          {REFERENCES.map((ref) => (
            <li key={ref.url}>
              <a href={ref.url} target="_blank" rel="noopener noreferrer">
                {ref.title}
              </a>
              <span className={styles.source}>{ref.source}</span>
            </li>
          ))}
        </ol>
      </section>
    </Screen>
  );
}
