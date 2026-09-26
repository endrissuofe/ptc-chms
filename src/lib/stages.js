import { differenceInCalendarDays } from 'date-fns';

/** The newcomer journey. Labels match the design system exactly. */
export const STAGES = {
  FIRST_TIMER: 'first_timer',
  SECOND_TIMER: 'second_timer',
  REGULAR: 'regular',
  BELIEVERS_CLASS: 'believers_class',
  MEMBER: 'member',
  LOST: 'lost',
};

export const STAGE_LABELS = {
  first_timer: 'First Timer',
  second_timer: 'Second Timer',
  regular: 'Regular',
  believers_class: "Believers' Class",
  member: 'Member',
  lost: 'Lost',
};

/** A "regular" has attended at least this many times within the window. */
export const REGULAR_MIN_VISITS = 3;
export const REGULAR_WINDOW_DAYS = 42;
/** No visit for this long after their last one marks a newcomer as lost. */
export const LOST_AFTER_DAYS = 42;

/**
 * Works out a person's stage from their visits and the two manual milestones.
 * @param {object} input
 * @param {Date[]} input.visitDates  every service date they attended
 * @param {boolean} [input.inBelieversClass]  set by pastor/admin
 * @param {boolean} [input.isMember]          set by pastor/admin
 * @param {Date} [input.today]
 */
export function computeStage({
  visitDates = [],
  inBelieversClass = false,
  isMember = false,
  today = new Date(),
}) {
  if (isMember) return STAGES.MEMBER;
  if (inBelieversClass) return STAGES.BELIEVERS_CLASS;
  if (visitDates.length === 0) return STAGES.FIRST_TIMER;

  const sorted = [...visitDates].map((d) => new Date(d)).sort((a, b) => a - b);
  const last = sorted[sorted.length - 1];

  if (differenceInCalendarDays(today, last) > LOST_AFTER_DAYS) return STAGES.LOST;

  const recent = sorted.filter((d) => differenceInCalendarDays(today, d) <= REGULAR_WINDOW_DAYS);
  if (recent.length >= REGULAR_MIN_VISITS) return STAGES.REGULAR;
  if (sorted.length >= 2) return STAGES.SECOND_TIMER;
  return STAGES.FIRST_TIMER;
}
