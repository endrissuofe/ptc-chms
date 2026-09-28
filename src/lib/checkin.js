/** The one-month check-in survey: when it goes, and what the answers mean. */

/** Sent this many days after someone's first visit... */
export const CHECKIN_AFTER_DAYS = 30;
/** ...or up to a week later, if the daily job missed a day. */
export const CHECKIN_WINDOW_DAYS = 7;

export const RATINGS = {
  5: { label: 'Wonderful', chip: 'chip-success' },
  4: { label: 'Good', chip: 'chip-success' },
  3: { label: 'Okay', chip: 'chip-warning' },
  2: { label: 'Not great', chip: 'chip-danger' },
  1: { label: 'Poor', chip: 'chip-danger' },
};

/** A low score or a request puts the person back on the follow-up list. */
export const needsCall = ({ rating, wantsCall }) => Boolean(wantsCall || (rating && rating <= 2));
