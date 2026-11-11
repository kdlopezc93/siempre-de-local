import { MapPin } from '@phosphor-icons/react/dist/csr/MapPin';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { ShareNetwork } from '@phosphor-icons/react/dist/csr/ShareNetwork';
import { Wallet } from '@phosphor-icons/react/dist/csr/Wallet';
import { XCircle } from '@phosphor-icons/react/dist/csr/XCircle';
import type { Match, MatchRoster } from '@sdl/contracts';
import { findFormation, isGame } from '@sdl/domain';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { appUrl, canShareFiles, whatsappUrl } from '../../shared/share';
import { IconButton } from '../../shared/ui/IconButton';
import { Button } from '../../shared/ui/Button';
import { Chips } from '../../shared/ui/Chips';
import { GroupShare } from '../../shared/ui/GroupShare';
import { ButtonLink } from '../../shared/ui/ButtonLink';
import { Screen } from '../../shared/ui/Screen';
import { SectionTabs } from '../../shared/ui/SectionTabs';
import { Sheet } from '../../shared/ui/Sheet';
import { FORMAT_LABEL } from '../shell/shell-nav';
import { usePublishLineup, useLineups } from '../lineup/use-lineups';
import { AfterMatch, FigureShare, MatchResultView } from './AfterMatch';
import { WhoCameAlone } from './WhoCame';
import { lineupImage } from './lineup-image';
import { minorsGroup } from '../shell/shell-nav';
import { matchKindLine, matchWhen, slotName } from './match-view';
import { PublishedBoard } from './PublishedBoard';
import { callUpMessage, lineupMessage, matchdayMessage } from './share-messages';
import { POSTER_VERSION } from '../../shared/poster/poster';
import { useTeamColors } from '../team/use-team-colors';
import { Reminders } from './Reminders';
import { resultImage } from './result-image';
import { resultMessage, type MatchResult } from './result-view';
import styles from './Matches.module.css';
import {
  useCreateTournament,
  useMatch,
  usePublishedLineup,
  useReplyMatch,
  useTournaments,
  useUpdateMatch,
} from './use-matches';
import { Badge } from '../../shared/ui/Badge';
import { StatGrid, StatTile } from '../../shared/ui/StatTile';

/**
 * /equipos/:teamId/partidos/:matchId — el partido: responder, y para el cuerpo técnico, quién va
 * y, ya jugado, el resultado y cómo jugó cada uno.
 */
export function MatchPage({ me, teamId, matchId }: { me: Me; teamId: string; matchId: string }) {
  const membership = me.teams.find((t) => t.team.id === teamId);
  const roles = membership?.roles ?? [];
  const staff = roles.includes('coach') || roles.includes('assistant');
  const player = roles.includes('player');
  // El tesorero pasa lista (2026-10-30), aunque no carga el resultado ni evalúa.
  const takesList = staff || roles.includes('treasurer');
  const data = useMatch(teamId, matchId);
  const back = (
    <Link to={`/equipos/${teamId}/partidos`} className={styles.back}>
      Partidos
    </Link>
  );

  if (data.isPending) {
    return (
      <Screen>
        <p className="sr-only" role="status">
          Cargando el partido…
        </p>
      </Screen>
    );
  }
  if (data.isError) {
    return (
      <Screen className={styles.screen}>
        {back}
        <p role="alert">
          {data.error instanceof ApiError && data.error.status === 404
            ? 'No encontramos ese partido.'
            : 'No pudimos cargar el partido. Revisa tu conexión e intenta de nuevo.'}
        </p>
      </Screen>
    );
  }
  const { match, roster } = data.data;
  // Ya jugado (D18): el cuerpo técnico carga el resultado y evalúa; el resto lo ve. Las
  // respuestas (voy / no voy) ya no hacen falta.
  // El entreno (2026-10-28) es convocatoria y asistencia: sin resultado ni alineación.
  const game = isGame(match.kind);
  const started = match.status === 'scheduled' && !match.open;
  const played = game && started;
  // "¿Quién vino?" (2026-10-30) va sola en el entreno, y en el partido para el tesorero; al
  // cuerpo técnico, en el partido, le llega dentro de "después del partido".
  const listAlone = takesList && roster !== null && started && !(staff && game);
  const teamName = membership?.team.name ?? 'Nosotros';
  // Con niños (2026-11-10, Kevin): el afiche del resultado sin "la figura" ni su afiche aparte.
  const minors = membership ? minorsGroup(membership) : false;

  return (
    <Screen className={styles.screen}>
      {back}
      {/* Lo fuerte de la pantalla: el partido en el bloque cobalto, como el entreno de hoy. */}
      <header className={styles.matchHero}>
        <div className={styles.heroBadges}>
          <Badge tone="white">{matchWhen(match.startsAt)}</Badge>
          {/*
            Día de partido (2026-11-10, Kevin): compartir el afiche de los convocados. El cuerpo
            técnico, siempre; los jugadores, cuando hay alineación publicada (esa lista ya la ve
            todo el equipo; sin ella saldría de quién respondió qué, que no ven).
          */}
          {match.open && game && ((staff && roster) || (player && match.published)) && (
            <MatchdayShare
              teamId={teamId}
              teamName={teamName}
              match={match}
              roster={roster ?? []}
            />
          )}
          {!match.open && (
            <Badge tone={match.status === 'cancelled' ? 'danger' : 'accent'}>
              {match.status === 'cancelled' ? 'Cancelado' : 'Jugado'}
            </Badge>
          )}
        </div>
        <p className={styles.heroOverline}>
          {game ? `${matchKindLine(match)}, contra` : 'Convocatoria a'}
        </p>
        <h1 className={styles.heroTitle}>{game ? match.opponent : 'Entrenar'}</h1>
        <p className={styles.heroMeta}>
          <MapPin size={16} aria-hidden="true" />
          {match.place}, {FORMAT_LABEL[match.format]}
        </p>
        {!match.open && (
          <p className={styles.heroMeta}>
            {match.status === 'cancelled'
              ? game
                ? 'Partido cancelado.'
                : 'Entreno cancelado.'
              : game
                ? 'El partido ya empezó.'
                : 'El entreno ya empezó.'}
          </p>
        )}
        {/* La pregunta del partido, en el bloque cobalto (2026-11-06, Kevin). */}
        {!played && player && match.open && <ReplyButtons teamId={teamId} match={match} />}
      </header>

      {staff && match.kind === 'championship' && !match.tournament && (
        <AssignTournament teamId={teamId} matchId={match.id} />
      )}

      {/* El resultado al grupo (2026-11-06): el afiche "Marcador gigante", del cuerpo técnico. */}
      {played && staff && match.result && (
        <ResultShare
          teamId={teamId}
          teamName={teamName}
          match={match}
          result={minors ? { ...match.result, figure: null } : match.result}
        />
      )}
      {played && staff && !minors && match.result?.figure && (
        <FigureShare
          teamId={teamId}
          teamName={teamName}
          match={match}
          result={match.result}
          label="Compartir el afiche de la figura"
        />
      )}

      {played &&
        (staff && roster ? (
          <AfterMatch teamId={teamId} teamName={teamName} match={match} roster={roster} />
        ) : (
          <MatchResultView teamId={teamId} teamName={teamName} match={match} meId={me.user.id} />
        ))}

      {listAlone && <WhoCameAlone teamId={teamId} match={match} roster={roster} />}

      {/*
        Lo que se hace con el partido, a la mano (2026-11-06, Kevin): cobrar (`06` Cobros, desde
        que se convoca), editar y cancelar (hasta cargar el resultado, aunque ya pasó la hora).
      */}
      <MatchActions
        teamId={teamId}
        match={match}
        canCharge={takesList && match.status === 'scheduled'}
        canEdit={staff && match.editable}
      />

      {/*
        El cuerpo técnico antes del partido (2026-11-06): convocatoria y alineación en dos
        pestañas, cada una con su "Mandar al grupo". El entreno no tiene alineación.
      */}
      {staff && !played && roster ? (
        game ? (
          <StaffTabs teamId={teamId} teamName={teamName} match={match} roster={roster} me={me} />
        ) : (
          <CallUp teamId={teamId} match={match} roster={roster} />
        )
      ) : (
        <>
          {match.published && (
            <PublishedSection teamId={teamId} match={match} meId={me.user.id} player={player} />
          )}
          {!played && (
            <StatGrid columns={match.replies.injured > 0 ? 4 : 3}>
              <StatTile label="Van" value={match.replies.yes} />
              <StatTile label="No van" value={match.replies.no} />
              <StatTile label="Faltan" value={match.replies.pending} />
              {match.replies.injured > 0 && (
                <StatTile label="Lesionados" value={match.replies.injured} />
              )}
            </StatGrid>
          )}
        </>
      )}
    </Screen>
  );
}

/**
 * Los partidos de antes del 2026-10-28 quedaron de campeonato sin torneo (Kevin): el cuerpo
 * técnico se lo asigna aquí, aunque el partido ya tenga resultado.
 */
function AssignTournament({ teamId, matchId }: { teamId: string; matchId: string }) {
  const tournaments = useTournaments(teamId);
  const create = useCreateTournament(teamId);
  const update = useUpdateMatch(teamId, matchId);
  const [choice, setChoice] = useState('');
  const [name, setName] = useState('');
  const known = tournaments.data?.items ?? [];
  const creating = choice === NEW || known.length === 0;
  const failed = create.error ?? update.error;

  async function save() {
    let tournamentId = creating ? '' : choice;
    if (creating) {
      if (!name.trim()) return;
      try {
        tournamentId = (await create.mutateAsync(name.trim())).tournament.id;
      } catch {
        return;
      }
    }
    if (tournamentId) update.mutate({ tournamentId });
  }

  return (
    <section aria-labelledby="sin-torneo" className={styles.assign}>
      <h2 id="sin-torneo" className={styles.assignTitle}>
        ¿De qué torneo es?
      </h2>
      <p className={styles.muted}>Es de campeonato y todavía no tiene torneo.</p>
      {known.length > 0 && (
        <Chips
          label="Torneo"
          options={[
            ...known.map((t) => ({ value: t.id, label: t.name })),
            { value: NEW, label: 'Nuevo torneo' },
          ]}
          selected={new Set([choice])}
          onToggle={setChoice}
        />
      )}
      {creating && (
        <input
          name="tournament"
          aria-label="Nombre del torneo"
          autoComplete="off"
          maxLength={80}
          className={styles.input}
          placeholder="Ej.: Liga del barrio 2026…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      {failed && (
        <p role="alert" className={styles.error}>
          {failed instanceof ApiError && failed.status < 500
            ? failed.message
            : 'No pudimos guardar. Revisa tu conexión e intenta de nuevo.'}
        </p>
      )}
      <Button
        variant="secondary"
        busy={create.isPending || update.isPending}
        disabled={creating ? !name.trim() : !choice}
        onClick={() => void save()}
      >
        Guardar torneo
      </Button>
    </section>
  );
}

const NEW = 'nuevo';

function ReplyButtons({ teamId, match }: { teamId: string; match: Match }) {
  const reply = useReplyMatch(teamId, match.id);
  return (
    <section aria-labelledby="tu-respuesta" className={styles.heroReply}>
      <h2 id="tu-respuesta" className={styles.heroQuestion}>
        {match.myReply ? 'Tu respuesta' : '¿Vas?'}
      </h2>
      <div className={styles.replies}>
        {(['yes', 'no'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={styles.replyButton}
            aria-pressed={match.myReply === value}
            disabled={!match.open || reply.isPending}
            onClick={() => reply.mutate(value)}
          >
            {value === 'yes' ? 'Voy' : 'No voy'}
          </button>
        ))}
      </div>
      {match.open && match.myReply && (
        <p className={styles.heroHint}>Puedes cambiarla hasta la hora del partido.</p>
      )}
      {reply.isError && (
        <p role="alert" className={styles.heroError}>
          {reply.error instanceof ApiError && reply.error.status < 500
            ? reply.error.message
            : 'No pudimos guardar tu respuesta. Revisa tu conexión e intenta de nuevo.'}
        </p>
      )}
    </section>
  );
}

/** Quién va, quién no, quién falta y los lesionados que no respondieron (no "faltan"). */
const GROUPS: {
  title: string;
  tone: 'wait' | 'yes' | 'no' | 'hurt';
  has: (p: MatchRoster[number]) => boolean;
}[] = [
  { title: 'Faltan por responder', tone: 'wait', has: (p) => p.reply === null && !p.injured },
  { title: 'Van', tone: 'yes', has: (p) => p.reply === 'yes' },
  { title: 'No van', tone: 'no', has: (p) => p.reply === 'no' },
  { title: 'Lesionados', tone: 'hurt', has: (p) => p.reply === null && p.injured },
];

/**
 * Quién va (2026-11-06, Kevin: "le falta color"): cada grupo con su color (faltan en naranja,
 * van en verde, no van en rojo) en las cifras y en las píldoras, con el dorsal en un círculo.
 * Debajo de los que faltan, "Mandar la convocatoria al grupo".
 */
function CallUp({ teamId, match, roster }: { teamId: string; match: Match; roster: MatchRoster }) {
  // Tres cifras; los lesionados van solo en su grupo (con cuatro, no cabían a 360 px).
  const groups = GROUPS.map((g) => ({ ...g, people: roster.filter(g.has) }));
  const message = callUpMessage(match, roster, appUrl(`/equipos/${teamId}/partidos/${match.id}`));
  return (
    <>
      <dl className={styles.replyCounts}>
        {(
          [
            ['Van', match.replies.yes, 'yes'],
            ['No van', match.replies.no, 'no'],
            ['Faltan', match.replies.pending, 'wait'],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className={styles[tone]}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {groups.map(({ title, tone, people }) =>
        people.length === 0 && tone !== 'wait' ? null : (
          <section
            key={title}
            aria-label={`${title} (${people.length})`}
            className={[styles.group, styles[tone]].join(' ')}
          >
            <h2 className={styles.groupTitle}>
              {people.length || tone !== 'wait'
                ? `${title} (${people.length})`
                : 'Ya respondieron todos'}
            </h2>
            {people.length > 0 && (
              <ul className={styles.pills}>
                {people.map((p) => (
                  <li key={p.playerId}>
                    <span className={styles.dorsal} aria-hidden="true">
                      {p.jerseyNumber ?? p.displayName.slice(0, 2).toUpperCase()}
                    </span>
                    {p.displayName}
                  </li>
                ))}
              </ul>
            )}
            {tone === 'wait' && match.open && (
              <>
                <GroupShare message={message} label="Mandar la convocatoria al grupo" />
                <Reminders teamId={teamId} match={match} pending={people.length} />
              </>
            )}
          </section>
        ),
      )}
    </>
  );
}

/**
 * "Mandar los convocados al grupo" (2026-11-10): el afiche "Día de partido" y su mensaje. Los
 * convocados son los de la alineación publicada (titulares y banca, Kevin); sin alineación, los
 * que dijeron "Voy" (sin lesionados). Se dibuja en el celular, como los demás afiches.
 */
function MatchdayShare({
  teamId,
  teamName,
  match,
  roster,
}: {
  teamId: string;
  teamName: string;
  match: Match;
  roster: MatchRoster;
}) {
  const colors = useTeamColors(teamId);
  const lineup = usePublishedLineup(teamId, match.id, match.published?.at ?? null);
  const players = convocados(roster, match.published ? (lineup.data ?? null) : null);
  const image = useQuery({
    queryKey: [
      'matchday-image',
      POSTER_VERSION,
      match.id,
      match.startsAt,
      match.place,
      match.opponent,
      teamName,
      ...players.map((p) => `${p.jerseyNumber ?? ''}:${p.displayName}`),
      ...(colors ?? []),
    ],
    queryFn: () =>
      matchdayImage({
        teamName,
        kindLine: matchKindLine(match),
        opponent: match.opponent ?? '',
        startsAt: match.startsAt,
        place: match.place,
        players,
        colors,
      }),
    staleTime: Infinity,
    structuralSharing: false,
    networkMode: 'always',
  });
  const url = appUrl(`/equipos/${teamId}/partidos/${match.id}`);
  // Con alineación publicada, se espera a tenerla para no mandar la lista equivocada.
  if (players.length === 0 || (match.published && !lineup.data)) return null;
  const file = image.data ?? null;
  return (
    <IconButton
      variant="accent"
      label="Compartir el afiche de los convocados"
      icon={<ShareNetwork size={22} weight="bold" aria-hidden="true" />}
      onClick={() => {
        // Con la imagen, el menú de compartir del celular; si no deja, WhatsApp con el mensaje.
        if (file && canShareFiles([file])) {
          const text = matchdayMessage(match, players, url);
          void navigator.share({ files: [file], text }).catch(() => {});
        } else {
          const text = matchdayMessage(match, players, url, { withNames: true });
          window.open(whatsappUrl(text), '_blank', 'noopener,noreferrer');
        }
      }}
    />
  );
}

type StaffTab = 'convocatoria' | 'alineacion';

/** Convocatoria y alineación en dos pestañas (2026-11-06); la elegida queda en la URL (`?ver=`). */
function StaffTabs({
  teamId,
  teamName,
  match,
  roster,
  me,
}: {
  teamId: string;
  teamName: string;
  match: Match;
  roster: MatchRoster;
  me: Me;
}) {
  const [params, setParams] = useSearchParams();
  const tab: StaffTab = params.get('ver') === 'alineacion' ? 'alineacion' : 'convocatoria';
  const { yes, no, pending, injured } = match.replies;
  return (
    <>
      <SectionTabs<StaffTab>
        label="Del partido"
        value={tab}
        onChange={(value) =>
          setParams(value === 'alineacion' ? { ver: value } : {}, { replace: true })
        }
        options={[
          { value: 'convocatoria', label: `Convocatoria ${yes}/${yes + no + pending + injured}` },
          { value: 'alineacion', label: 'Alineación' },
        ]}
      />
      {tab === 'convocatoria' ? (
        <CallUp teamId={teamId} match={match} roster={roster} />
      ) : (
        <LineupTab teamId={teamId} teamName={teamName} match={match} meId={me.user.id} />
      )}
    </>
  );
}

/**
 * La fila de acciones del partido (2026-11-06, Kevin): Cobrar, Editar y Cancelar a la mano, con
 * Cancelar en rojo y su confirmación ("es común que pase").
 */
function MatchActions({
  teamId,
  match,
  canCharge,
  canEdit,
}: {
  teamId: string;
  match: Match;
  canCharge: boolean;
  canEdit: boolean;
}) {
  const update = useUpdateMatch(teamId, match.id);
  const [confirm, setConfirm] = useState(false);
  if (!canCharge && !canEdit) return null;
  return (
    <nav aria-label="Acciones del partido" className={styles.matchActions}>
      {canCharge && (
        <Link
          to={`/equipos/${teamId}/cobros/nuevo?partido=${match.id}`}
          className={[styles.action, styles.actionMoney].join(' ')}
        >
          <span className={styles.actionIcon}>
            <Wallet size={22} weight="bold" aria-hidden="true" />
          </span>
          Cobrar
        </Link>
      )}
      {canEdit && (
        <>
          <Link
            to={`/equipos/${teamId}/partidos/${match.id}/editar`}
            className={[styles.action, styles.actionEdit].join(' ')}
          >
            <span className={styles.actionIcon}>
              <PencilSimple size={22} weight="bold" aria-hidden="true" />
            </span>
            Editar
          </Link>
          <button
            type="button"
            className={[styles.action, styles.actionDanger].join(' ')}
            onClick={() => setConfirm(true)}
          >
            <span className={styles.actionIcon}>
              <XCircle size={22} weight="bold" aria-hidden="true" />
            </span>
            Cancelar
          </button>
        </>
      )}
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Cancelar el partido?">
        <div className={styles.sheetActions}>
          <p>
            El equipo lo verá cancelado y ya no se podrá responder ni editar. Queda en la cuenta de
            partidos cancelados.
          </p>
          {update.isError && (
            <p role="alert" className={styles.error}>
              No pudimos cancelarlo. Revisa tu conexión e intenta de nuevo.
            </p>
          )}
          <Button
            variant="danger"
            busy={update.isPending}
            onClick={() =>
              update.mutate({ status: 'cancelled' }, { onSuccess: () => setConfirm(false) })
            }
          >
            Sí, cancelarlo
          </Button>
          <Button variant="ghost" disabled={update.isPending} onClick={() => setConfirm(false)}>
            No
          </Button>
        </div>
      </Sheet>
    </nav>
  );
}

/**
 * La pestaña Alineación (Fase 7, 2026-11-06): la publicada en la cancha, las guardadas para
 * publicar (D17: se republica hasta la hora del partido), "Mandar la alineación al grupo" y
 * armar otra.
 */
function LineupTab({
  teamId,
  teamName,
  match,
  meId,
}: {
  teamId: string;
  teamName: string;
  match: Match;
  meId: string;
}) {
  const lineups = useLineups(teamId);
  const publish = usePublishLineup(teamId);
  const mine = (lineups.data?.items ?? []).filter((l) => l.matchId === match.id);
  const publishedId = match.published?.lineupId ?? null;
  return (
    <section aria-label="Alineación" className={styles.section}>
      {match.published ? (
        <>
          <p className={styles.published}>
            Publicada el {matchWhen(match.published.at)}: el equipo ya la ve.
          </p>
          <PublishedLineup teamId={teamId} match={match} meId={meId} />
        </>
      ) : (
        <p className={styles.muted}>
          {mine.length
            ? 'Publica una para que el equipo la vea.'
            : 'Todavía no hay alineación para este partido.'}
        </p>
      )}
      {mine.length > 0 && (
        <ul className={styles.lineups}>
          {mine.map((l) => (
            <li key={l.id}>
              <Link to={`/equipos/${teamId}/alineaciones/${l.id}`} className={styles.lineupName}>
                {l.name}
              </Link>
              {l.id === publishedId ? (
                <Badge tone="success">Publicada</Badge>
              ) : (
                match.open && (
                  <button
                    type="button"
                    className={styles.publishButton}
                    disabled={publish.isPending}
                    onClick={() => publish.mutate(l.id)}
                  >
                    {publishedId ? 'Publicar esta' : 'Publicar'}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {publish.isError && (
        <p role="alert" className={styles.error}>
          No pudimos publicarla. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
      {match.published && match.open && (
        <LineupShare teamId={teamId} teamName={teamName} match={match} at={match.published.at} />
      )}
      {match.open && (
        <ButtonLink
          variant={match.published ? 'secondary' : 'primary'}
          to={`/equipos/${teamId}/planificador?partido=${match.id}`}
        >
          {mine.length ? 'Armar otra' : 'Armar la alineación'}
        </ButtonLink>
      )}
    </section>
  );
}

/**
 * La alineación al grupo (2026-11-06): con su imagen si el celular deja compartirla (se arma de
 * antemano: el menú de compartir solo abre en el mismo toque); si no, el mensaje con el enlace.
 */
function LineupShare({
  teamId,
  teamName,
  match,
  at,
}: {
  teamId: string;
  teamName: string;
  match: Match;
  at: string;
}) {
  const colors = useTeamColors(teamId);
  const lineup = usePublishedLineup(teamId, match.id, at);
  const image = useQuery({
    queryKey: ['lineup-image', POSTER_VERSION, match.id, at, ...(colors ?? [])],
    enabled: lineup.data !== undefined,
    queryFn: () =>
      lineupImage({
        lineup: lineup.data!,
        teamName,
        kindLine: matchKindLine(match),
        opponent: match.opponent,
        startsAt: match.startsAt,
        place: match.place,
        colors,
      }),
    staleTime: Infinity,
    structuralSharing: false,
    networkMode: 'always',
  });
  const message = lineupMessage(match, appUrl(`/equipos/${teamId}/partidos/${match.id}`));
  return (
    <GroupShare message={message} file={image.data ?? null} label="Mandar la alineación al grupo" />
  );
}

/** "Mandar el resultado al grupo" (2026-11-06): el afiche "Marcador gigante" con su mensaje. */
function ResultShare({
  teamId,
  teamName,
  match,
  result,
}: {
  teamId: string;
  teamName: string;
  match: Match;
  result: MatchResult;
}) {
  const colors = useTeamColors(teamId);
  const image = useQuery({
    // Con la figura o sin ella (grupos de menores): dos afiches distintos.
    queryKey: [
      'result-image',
      POSTER_VERSION,
      match.id,
      result.at,
      result.figure?.id ?? 'sin-figura',
      teamName,
      ...(colors ?? []),
    ],
    queryFn: () => resultImage({ match, result, teamName, kindLine: matchKindLine(match), colors }),
    staleTime: Infinity,
    structuralSharing: false,
    networkMode: 'always',
  });
  const message = resultMessage(match, result, appUrl(`/equipos/${teamId}/partidos/${match.id}`));
  return (
    <GroupShare message={message} file={image.data ?? null} label="Mandar el resultado al grupo" />
  );
}

/** La publicada en la pestaña del cuerpo técnico: la cancha y los suplentes. */
function PublishedLineup({ teamId, match, meId }: { teamId: string; match: Match; meId: string }) {
  const lineup = usePublishedLineup(teamId, match.id, match.published?.at ?? null);
  if (!lineup.data) {
    return lineup.isError ? (
      <p role="alert" className={styles.muted}>
        No pudimos cargar la alineación. Revisa tu conexión.
      </p>
    ) : null;
  }
  const { bench } = lineup.data;
  return (
    <>
      <PublishedBoard lineup={lineup.data} meId={meId} />
      <p className={styles.muted}>
        Suplentes:{' '}
        {bench.length
          ? bench
              .map((p) =>
                p.jerseyNumber !== null ? `${p.jerseyNumber} ${p.displayName}` : p.displayName,
              )
              .join(', ')
          : 'ninguno.'}
      </p>
    </>
  );
}

/** La alineación publicada, para todo el equipo (D17): dónde estás tú, la cancha y el banco. */
function PublishedSection({
  teamId,
  match,
  meId,
  player,
}: {
  teamId: string;
  match: Match;
  meId: string;
  player: boolean;
}) {
  const lineup = usePublishedLineup(teamId, match.id, match.published?.at ?? null);
  if (!lineup.data) {
    return lineup.isError ? (
      <p role="alert" className={styles.muted}>
        No pudimos cargar la alineación. Revisa tu conexión.
      </p>
    ) : null;
  }
  const data = lineup.data;
  const formation = findFormation(data.formation);
  const mySlot = data.starters.find((s) => s.player?.id === meId);
  const slot = mySlot && formation?.slots.find((s) => s.id === mySlot.slotId);
  const onBench = data.bench.some((p) => p.id === meId);
  return (
    <section aria-labelledby="la-alineacion" className={styles.section}>
      <h2 id="la-alineacion" className={styles.sectionTitle}>
        La alineación
      </h2>
      {player && (
        <p className={styles.myPlace}>
          {slot
            ? `Eres titular: ${slotName(slot, formation?.format)}.`
            : onBench
              ? 'Vas al banco.'
              : 'Esta vez no estás en la lista.'}
        </p>
      )}
      <PublishedBoard lineup={data} meId={meId} />
      <h3 className={styles.sectionTitle}>Suplentes ({data.bench.length})</h3>
      <p className={styles.muted}>
        {data.bench.length
          ? data.bench
              .map((p) =>
                p.jerseyNumber !== null ? `${p.jerseyNumber} ${p.displayName}` : p.displayName,
              )
              .join(', ')
          : 'Ninguno.'}
      </p>
      <p className={styles.muted}>Publicada el {matchWhen(data.publishedAt)}.</p>
    </section>
  );
}
