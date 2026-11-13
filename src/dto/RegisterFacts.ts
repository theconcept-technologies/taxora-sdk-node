import { type Language } from '../enums/Language.js';

/** Official commercial register: Spain's BORME or France's BODACC. */
export type RegisterSource = 'borme' | 'bodacc';

/** How serious a register note or announcement is. */
export type RegisterSeverity = 'error' | 'warning' | 'info' | 'neutral';

const SEVERITIES: readonly string[] = ['error', 'warning', 'info', 'neutral'];

/**
 * One official register publication: a BORME act (Spain) or a BODACC announcement (France).
 * Used for `RegisterFacts.publications`, `RegisterNote.source` and `VatRegisterFacts.announcements`.
 */
export interface RegisterPublication {
  /** e.g. 'BORME-A-2026-182-46' or 'A202602042782'. */
  id?: string;
  /** Publication date (YYYY-MM-DD). */
  date?: string;
  /** Link to the official publication. */
  url?: string;
  /** Set on `RegisterNote.source`. */
  register?: RegisterSource;
  /** BORME entry number (Spain). */
  entry?: number;
  /** What the publication is about, e.g. 'proceeding_opened' (France, and the VAT-check timeline). */
  kind?: string;
  /** Timeline only. */
  severity?: RegisterSeverity;
}

/** France: open insolvency proceedings. */
export interface RegisterProceeding {
  type: 'liquidation' | 'redressement' | 'sauvegarde' | (string & {});
  /** Since when (YYYY-MM-DD). */
  since?: string;
}

/**
 * What the official commercial register says about a company (Spain: BORME, France: BODACC) — why a
 * VAT ID may not (yet / any more) be valid. Never contains a VAT number the register confirmed and
 * never changes the result status. Fields that do not apply to the register are left out.
 *
 * Spain (`source` 'borme'): `status` 'newly_founded', 'dissolved', 'extinct' (see `successors`),
 * 'renamed' (see `newName`), 'sheet_closed' or 'active'.
 * France (`source` 'bodacc', by SIREN): 'struck_off' (`reason` 'merger' / 'liquidation' /
 * 'ex_officio', absorbing company as counterpart), 'merging', 'insolvency', 'sold' (buyer as
 * counterpart), 'newly_registered', 'renamed', 'moved'. Open insolvency proceedings are also given
 * in `proceeding` — on confirmed results too.
 */
export interface RegisterFacts {
  source: RegisterSource | (string & {});
  status: string;
  companyName?: string;
  /** France: the SIREN looked up. */
  siren?: string;
  /** France: date of the decisive event (YYYY-MM-DD). */
  date?: string;
  /** Spain: incorporation date. */
  incorporatedOn?: string;
  /** Spain: dissolution date. */
  dissolvedOn?: string;
  /** Spain: extinction date. */
  extinctOn?: string;
  /** Spain: 'merger' | 'split' | 'global_transfer' | 'voluntary' | 'other'; France: 'merger' | 'liquidation' | 'ex_officio'. */
  reason?: string;
  newName?: string;
  previousName?: string;
  /** Spain: the companies that took over. */
  successors: string[];
  /** Spain: the companies this one came from (split, transfer). */
  predecessors: string[];
  /** Spain: 'transferee' when the predecessors transferred their business, otherwise a split. */
  predecessorRole?: string;
  /** Spain: the predecessors no longer exist. */
  predecessorsExtinct?: boolean;
  /** Spain: registered seat. */
  domicile?: string;
  province?: string;
  /** France: the absorbing company / buyer. */
  counterpartName?: string;
  counterpartSiren?: string;
  /** France: the counterpart's VAT ID computed from its SIREN — not verified. */
  counterpartVat?: string;
  /** France: only a branch / part of the business was sold. */
  partial?: boolean;
  /** France: the new city after a move. */
  city?: string;
  /** France: open insolvency proceedings. */
  proceeding?: RegisterProceeding;
  publications: RegisterPublication[];
}

/**
 * Values for the `RegisterNote` codes. `vatNumber` is the confirmed number, or the one the tax
 * authority rejected; `successorVat` (France) is computed from the SIREN — not verified.
 */
export interface RegisterNoteParams {
  date?: string | null;
  related?: string[];
  relatedExtinct?: boolean;
  vatNumber?: string | null;
  newName?: string | null;
  previousName?: string | null;
  successorVat?: string | null;
  city?: string | null;
  warningDate?: string | null;
  [key: string]: unknown;
}

/**
 * The explanation of `RegisterFacts` for your customer, in three parts — what happened (`event`),
 * what it means for the VAT ID (`meaning`), what to do (`action`) — plus, for French insolvency
 * proceedings, an accounts payable/receivable `warning` (also on confirmed results). The codes are
 * stable (new ones may be added); `params` carries their values and `text` the finished sentences.
 *
 * - event: founded, founded_by_split, founded_by_transfer, took_over_split, took_over_transfer,
 *   extinct, extinct_split, extinct_merger, extinct_transfer, dissolved, renamed, renamed_from,
 *   sheet_closed, struck_off, struck_off_merger, struck_off_liquidation, struck_off_ex_officio,
 *   merging, insolvency_liquidation, insolvency_redressement, insolvency_sauvegarde, sold,
 *   sold_branch, registered, renamed_from_to, moved
 * - meaning: vat_not_active_yet, vat_ceased, vat_may_be_revoked, vat_under_new_name,
 *   registered_under_old_name, register_closed, vat_ceased_vies_lag, vat_ends_with_merger,
 *   vat_ends_with_liquidation, vat_unaffected_by_proceedings, vat_stays_with_seller,
 *   vat_unchanged_branch_sold, vat_not_in_vies_yet, vat_unchanged_after_move
 * - action: ask_roi_and_recheck, use_successor, ask_customer_status, update_master_data,
 *   use_successor_vat, check_open_items, check_buyer_vat, recheck_later, update_address
 * - warning: insolvency_liquidation, insolvency_redressement, insolvency_sauvegarde
 */
export interface RegisterNote {
  event: string;
  meaning: string | null;
  action: string | null;
  warning: string | null;
  severity: RegisterSeverity;
  params: RegisterNoteParams;
  /** The official publication: register, id, date and url. */
  source: RegisterPublication | null;
  /** The finished sentences in English and German. */
  text: { en?: string; de?: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(str).filter((v): v is string => v !== undefined) : [];

/** One publication; only the fields that are set. */
export function toRegisterPublication(value: unknown): RegisterPublication | undefined {
  if (!isRecord(value)) return undefined;
  const publication: RegisterPublication = {};
  const id = str(value['id']);
  const date = str(value['date']);
  const url = str(value['url']);
  const register = str(value['register']);
  const kind = str(value['kind']);
  const severity = str(value['severity']);
  if (id !== undefined) publication.id = id;
  if (date !== undefined) publication.date = date;
  if (url !== undefined) publication.url = url;
  if (register === 'borme' || register === 'bodacc') publication.register = register;
  if (typeof value['entry'] === 'number' && Number.isInteger(value['entry'])) publication.entry = value['entry'];
  if (kind !== undefined) publication.kind = kind;
  if (severity !== undefined && SEVERITIES.includes(severity)) publication.severity = severity as RegisterSeverity;
  return publication;
}

export function toRegisterPublications(value: unknown): RegisterPublication[] {
  if (!Array.isArray(value)) return [];
  return value.map(toRegisterPublication).filter((p): p is RegisterPublication => p !== undefined);
}

/** Tolerant parsing of the API's `registerFacts`; undefined without `source` and `status`. */
export function toRegisterFacts(value: unknown): RegisterFacts | undefined {
  if (!isRecord(value)) return undefined;
  const source = str(value['source']);
  const status = str(value['status']);
  if (source === undefined || status === undefined) return undefined;

  const facts: RegisterFacts = {
    source,
    status,
    successors: strings(value['successors']),
    predecessors: strings(value['predecessors']),
    publications: toRegisterPublications(value['publications']),
  };
  const optional = [
    'companyName',
    'siren',
    'date',
    'incorporatedOn',
    'dissolvedOn',
    'extinctOn',
    'reason',
    'newName',
    'previousName',
    'predecessorRole',
    'domicile',
    'province',
    'counterpartName',
    'counterpartSiren',
    'counterpartVat',
    'city',
  ] as const;
  for (const key of optional) {
    const v = str(value[key]);
    if (v !== undefined) facts[key] = v;
  }
  if (typeof value['predecessorsExtinct'] === 'boolean') facts.predecessorsExtinct = value['predecessorsExtinct'];
  if (typeof value['partial'] === 'boolean') facts.partial = value['partial'];
  const proceeding = value['proceeding'];
  if (isRecord(proceeding)) {
    const type = str(proceeding['type']);
    if (type !== undefined) {
      const since = str(proceeding['since']);
      facts.proceeding = since !== undefined ? { type, since } : { type };
    }
  }
  return facts;
}

/** Tolerant parsing of the API's `registerNote`; undefined without an `event`. */
export function toRegisterNote(value: unknown): RegisterNote | undefined {
  if (!isRecord(value)) return undefined;
  const event = str(value['event']);
  if (event === undefined) return undefined;

  const text: { en?: string; de?: string } = {};
  if (isRecord(value['text'])) {
    const en = str(value['text']['en']);
    const de = str(value['text']['de']);
    if (en !== undefined) text.en = en;
    if (de !== undefined) text.de = de;
  }
  const severity = str(value['severity']);

  return {
    event,
    meaning: str(value['meaning']) ?? null,
    action: str(value['action']) ?? null,
    warning: str(value['warning']) ?? null,
    severity: severity !== undefined && SEVERITIES.includes(severity) ? (severity as RegisterSeverity) : 'neutral',
    params: isRecord(value['params']) ? (value['params'] as RegisterNoteParams) : {},
    source: toRegisterPublication(value['source']) ?? null,
    text,
  };
}

/** The note's finished sentences in one language (English when the other is missing). */
export function registerNoteText(note: RegisterNote, locale: Language = 'en'): string | undefined {
  return locale === 'de' ? (note.text.de ?? note.text.en) : (note.text.en ?? note.text.de);
}
