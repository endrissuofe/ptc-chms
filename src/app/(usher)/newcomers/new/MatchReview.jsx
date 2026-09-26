'use client';

import Icon from '@/components/ui/Icon';
import StageBadge from '@/components/ui/StageBadge';
import { STAGES } from '@/lib/stages';

const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const iso = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * "Returning visitor found" (docs/design/usher_returning_visitor_found).
 * Everyone already on the card's phone number; the usher picks who this is,
 * or confirms it's a different person sharing the phone.
 */
export default function MatchReview({
  matches,
  card,
  serviceDate,
  serviceName,
  saving,
  error,
  onPick,
  onNewPerson,
  onBack,
}) {
  const typedName = `${card.firstName.trim()} ${card.lastName.trim()}`;
  const plural = matches.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted"
      >
        <Icon name="arrow_back" size={20} />
        Back to the card
      </button>

      <section className="flex items-start gap-3 rounded-xl bg-stage-first-bg p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
          <Icon name="contact_phone" size={22} filled />
        </span>
        <div>
          <h1 className="text-xl font-semibold leading-tight text-primary">
            This phone number is already in our records
          </h1>
          <p className="mt-1 text-[13px] text-ink">
            The card says <strong>{typedName}</strong>. Is this{' '}
            {plural ? 'one of these people' : 'the same person'} coming back?
          </p>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {matches.map((m) => {
        const alreadyToday = m.lastVisitDate && iso(m.lastVisitDate) === serviceDate;
        return (
          <section
            key={m.id}
            className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stage-regular-bg font-serif text-lg font-semibold text-stage-regular-text">
                {`${m.firstName[0] || ''}${m.lastName[0] || ''}`.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">
                  {m.firstName} {m.lastName}
                </h2>
                <StageBadge stage={m.stage} />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-lg bg-paper p-3">
                <dt className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                  <Icon name="event" size={14} />
                  First visit
                </dt>
                <dd className="mt-0.5 font-semibold">{date.format(new Date(m.firstVisitDate))}</dd>
              </div>
              <div className="rounded-lg bg-paper p-3">
                <dt className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                  <Icon name="repeat" size={14} />
                  Visits so far
                </dt>
                <dd className="mt-0.5 font-semibold">{m.visitCount}</dd>
              </div>
              {m.assignedTo && (
                <div className="col-span-2 rounded-lg bg-stage-second-bg p-3">
                  <dt className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                    <Icon name="assignment_ind" size={14} />
                    Follow-up worker
                  </dt>
                  <dd className="mt-0.5 font-semibold">{m.assignedTo}</dd>
                </div>
              )}
            </dl>

            {alreadyToday && (
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-secondary">
                <Icon name="check_circle" size={16} />
                Already recorded for this day — confirming again changes nothing.
              </p>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => onPick(m)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-white active:bg-primary-dark disabled:opacity-50"
            >
              <Icon name="how_to_reg" size={20} />
              Yes, it’s {m.firstName} coming back
            </button>
          </section>
        );
      })}

      <section className="flex items-start gap-3 rounded-xl bg-stage-regular-bg p-4 text-[13px] text-stage-regular-text">
        <Icon name="info" size={18} />
        <p>
          Confirming records their visit to {serviceName}
          {matches.some((m) => m.stage === STAGES.FIRST_TIMER) &&
            ' and moves a First Timer to Second Timer'}
          . {card.prayerRequest.trim() && 'The prayer request on this card goes to the pastors. '}
          Email and birthday are only added if we didn’t have them.
        </p>
      </section>

      <button
        type="button"
        disabled={saving}
        onClick={onNewPerson}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[15px] font-semibold disabled:opacity-50"
      >
        <Icon name="person_add" size={20} />
        No, {typedName} is a different person
      </button>
      <p className="text-center text-[11px] text-muted">
        For example, a family member using the same phone.
      </p>
    </div>
  );
}
