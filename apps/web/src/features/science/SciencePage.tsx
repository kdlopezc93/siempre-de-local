import { Screen } from '../../shared/ui/Screen';
import styles from './SciencePage.module.css';

const REFERENCES = [
  {
    title:
      'Di Salvo et al. — Performance characteristics according to playing position in elite soccer',
    source: 'Int J Sports Med',
    url: 'https://www.researchgate.net/publication/6769686_Performance_Characteristics_According_to_Playing_Position_in_Elite_Soccer',
  },
  {
    title: 'Demandas físicas por posición en la MLS (GPS)',
    source: 'PMC, 2024',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12551844/',
  },
  {
    title: 'Demandas físicas por posición en transiciones (Ekstraklasa)',
    source: 'PMC, 2023',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10955741/',
  },
  {
    title: 'Perfil de carrera en juveniles U19 (4-3-3)',
    source: 'PMC, 2025',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12473318/',
  },
  {
    title: 'Perfil antropométrico según la posición (618 jugadores)',
    source: 'Int J Environ Res Public Health, 2019',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6651378/',
  },
  {
    title: 'Composición corporal por posición: revisión sistemática y metaanálisis',
    source: 'Applied Sciences, 2023',
    url: 'https://www.mdpi.com/2076-3417/13/8/4782',
  },
  {
    title: 'Rendimiento y proceso de selección en juveniles',
    source: 'PMC',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4096087/',
  },
  {
    title: 'GoldFit / Gold Score Soccer: modelo multidimensional de identificación de talento',
    source: 'Res Q Exerc Sport, 2024',
    url: 'https://www.tandfonline.com/doi/full/10.1080/02701367.2024.2347983',
  },
  {
    title:
      'Predicción de posición con atributos físicos, técnicos, tácticos y psicológicos (machine learning)',
    source: 'Springer, 2023',
    url: 'https://link.springer.com/chapter/10.1007/978-981-99-3656-4_29',
  },
];

/** /bases — en qué se apoya el test (pantalla de metodología del prototipo, al día con v2). */
export function SciencePage() {
  return (
    <Screen className={styles.screen}>
      <h1 className={styles.title}>En qué se basa el test</h1>
      <p className={styles.lead}>
        Es una herramienta de <strong>orientación</strong> construida con lo que dice la ciencia del
        rendimiento, no un instrumento validado con tu equipo. Esto es lo que respalda cada tipo de
        pregunta.
      </p>

      <section className={styles.block}>
        <h2>Varias dimensiones a la vez</h2>
        <p>
          Para perfilar a un jugador se combinan lo físico, lo técnico, lo táctico y lo psicológico.
          Los modelos que asignan posición usan esa mezcla, por eso el test cruza situaciones de
          juego con tus cualidades.
        </p>
      </section>

      <section className={styles.block}>
        <h2>Lo que exige cada posición</h2>
        <p>
          Los estudios con GPS coinciden: los <strong>mediocentros</strong> son los que más corren;{' '}
          <strong>laterales, extremos y delanteros</strong> hacen más carreras a alta velocidad y
          sprints; los <strong>centrales</strong>, menos. Por eso "resistencia para cubrir la
          cancha" suma a mediocentro y "velocidad punta" a extremo y lateral.
        </p>
      </section>

      <section className={styles.block}>
        <h2>El cuerpo</h2>
        <p>
          Los <strong>porteros</strong> suelen ser los más altos y pesados, seguidos de los{' '}
          <strong>defensas</strong>; los <strong>mediocampistas</strong>, los más livianos.
          Centrales y delanteros destacan en el juego aéreo: por eso "fuerza y juego aéreo" suma a
          central y delantero.
        </p>
      </section>

      <section className={styles.block}>
        <h2>Táctica y rol</h2>
        <p>
          El central que ordena y despeja, el lateral que da amplitud y cierra, el pivote que
          protege a la defensa, el extremo que desborda, el delantero que define: son funciones en
          las que coincide el análisis de rendimiento, y las preguntas de situación salen de ahí.
        </p>
      </section>

      <section className={styles.warning}>
        <h2>Lo que no es</h2>
        <p>
          No reemplaza la mirada de tu entrenador ni predice cómo vas a rendir en un partido. Tu
          afinidad compara posiciones dentro de ti: no sirve para compararte con otro jugador. Úsalo
          para empezar la conversación, no como veredicto. Lo que sabes de una posición se mide
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
