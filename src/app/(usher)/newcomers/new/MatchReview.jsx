'use client';

import Avatar from '@/components/ui/Avatar';
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
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm self-start">
        <Icon name="arrow_back" size={18} />
        Back to the card
      </button>

      <section className="card flex items-start gap-4 border-coral/40 bg-coral-soft">
        <span className="icon-tile h-12 w-12 bg-surface text-coral-strong">
          <Icon name="contact_phone" size={24} filled />
        </span>
        <div>
          <p className="eyebrow">Returning visitor?</p>
          <h1 className="text-2xl font-black">This phone number is already in our records</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            The card says <strong className="text-ink">{typedName}</strong>. Is this{' '}
            {plural ? 'one of these people' : 'the same person'} coming back?
          </p>
        </div>
      </section>

      {error && (
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={20} />
          {error}
        </p>
      )}

      <div className={`grid gap-4 ${plural ? 'md:grid-cols-2' : ''}`}>
        {matches.map((m) => {
          const alreadyToday = m.lastVisitDate && iso(m.lastVisitDate) === serviceDate;
          return (
            <section key={m.id} className="card flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={`${m.firstName} ${m.lastName}`} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-xl font-black">
                    {m.firstName} {m.lastName}
                  </h2>
                  <StageBadge stage={m.stage} />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2.5 text-sm">
                <div className="rounded-tile bg-surface-2 p-3">
                  <dt className="label-caps flex items-center gap-1">
                    <Icon name="event" size={14} />
                    First visit
                  </dt>
                  <dd className="mt-1 font-display text-base font-extrabold">
                    {date.format(new Date(m.firstVisitDate))}
                  </dd>
                </div>
                <div className="rounded-tile bg-surface-2 p-3">
                  <dt className="label-caps flex items-center gap-1">
                    <Icon name="repeat" size={14} />
                    Visits so far
                  </dt>
                  <dd className="mt-1 font-display text-base font-extrabold">{m.visitCount}</dd>
                </div>
                {m.assignedTo && (
                  <div className="col-span-2 rounded-tile bg-primary-soft p-3 text-primary-ink">
                    <dt className="label-caps flex items-center gap-1 text-primary-ink/80">
                      <Icon name="assignment_ind" size={14} />
                      Follow-up worker
                    </dt>
                    <dd className="mt-1 font-display text-base font-extrabold">{m.assignedTo}</dd>
                  </div>
                )}
              </dl>

              {alreadyToday && (
                <p className="alert alert-success">
                  <Icon name="check_circle" size={18} />
                  Already recorded for this day — confirming again changes nothing.
                </p>
              )}

              <button
                type="button"
                disabled={saving}
                onClick={() => onPick(m)}
                className="btn btn-primary btn-lg mt-auto"
              >
                <Icon name="how_to_reg" size={20} />
                Yes, it’s {m.firstName} coming back
              </button>
            </section>
          );
        })}
      </div>

      <p className="alert alert-info">
        <Icon name="info" size={19} />
        <span>
          Confirming records their visit to {serviceName}
          {matches.some((m) => m.stage === STAGES.FIRST_TIMER) &&
            ' and moves a First Timer to Second Timer'}
          . {card.prayerRequest.trim() && 'The prayer request on this card is saved too. '}
          Email and birthday are only added if we didn’t have them.
        </span>
      </p>

      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          disabled={saving}
          onClick={onNewPerson}
          className="btn btn-ghost btn-lg w-full sm:w-auto"
        >
          <Icon name="person_add" size={20} />
          No, {typedName} is a different person
        </button>
        <p className="text-[13px] text-muted">For example, a family member using the same phone.</p>
      </div>
    </div>
  );
}
