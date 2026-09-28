import { daysBetween, toServiceDate } from './dates';
import { STAGES } from './stages';

/** What happened on a follow-up call or visit. */
export const OUTCOMES = {
  reached: { label: 'Reached', icon: 'phone_in_talk', chip: 'chip-success' },
  no_answer: { label: 'No answer', icon: 'phone_missed', chip: 'chip-warning' },
  call_back: { label: 'Call back later', icon: 'schedule', chip: 'chip-primary' },
  wrong_number: { label: 'Wrong number', icon: 'error_outline', chip: 'chip-danger' },
};

export const CHANNELS = {
  call: { label: 'Phone call', icon: 'call' },
  whatsapp: { label: 'WhatsApp', icon: 'chat' },
  in_person: { label: 'In person', icon: 'group' },
};

/** Not reached this many days after their last visit: flagged as overdue. */
export const OVERDUE_AFTER_DAYS = 3;
/** First visit at least this long ago: offered for moving into the Members list. */
export const MOVE_AFTER_DAYS = 30;

const onOrAfter = (a, b) => Boolean(a && b && new Date(a) >= new Date(b));

/** They asked for a call on the one-month check-in, after their latest visit. */
export const askedForCall = (person) =>
  onOrAfter(person.callRequestedAt, person.lastVisitDate || person.firstVisitDate);

/** When this round of follow-up started: their latest visit, or a later request for a call. */
const roundStart = (person) =>
  askedForCall(person) ? person.callRequestedAt : person.lastVisitDate || person.firstVisitDate;

/**
 * Where someone is in follow-up since their latest visit (every new visit, or a request for a
 * call on the check-in, starts a new round):
 *   reached      someone spoke with them
 *   wrong_number the number doesn't work (needs fixing, not calling)
 *   to_call      nobody has got through yet (tried: a call was made but not answered)
 */
export function followUpState(person) {
  const since = roundStart(person);
  if (onOrAfter(person.lastContactAt, since)) return { state: 'reached', tried: true };
  const tried = onOrAfter(person.lastAttemptAt, since);
  if (tried && person.lastOutcome === 'wrong_number') return { state: 'wrong_number', tried };
  return { state: 'to_call', tried, lastOutcome: tried ? person.lastOutcome : null };
}

/** Days since this round started (visit or request), and whether that's overdue for a call. */
export function waiting(person, today = new Date()) {
  const last = roundStart(person);
  const days = Math.max(daysBetween(toServiceDate(last), toServiceDate(today)), 0);
  return { days, overdue: days > OVERDUE_AFTER_DAYS };
}

/** Still in the follow-up list: not yet moved to Members and not a member. */
export const inFollowUp = (person) => !person.movedToMembersAt && person.stage !== STAGES.MEMBER;

/** Phone links. Numbers are stored as +234…; wa.me wants digits only. */
export const telLink = (phone) => `tel:${phone}`;
export const whatsAppLink = (phone) => `https://wa.me/${String(phone).replace(/\D/g, '')}`;
