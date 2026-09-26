'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { DayChips, ServiceChips } from '@/components/usher/ServiceDayPicker';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { MONTHS, birthdayProblem, daysInMonth } from '@/lib/birthday';
import MatchReview from './MatchReview';

const EMPTY = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  birthDay: '',
  birthMonth: '',
  prayerRequest: '',
  smsConsent: false,
  cardUnclear: false,
};

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

const input = 'input';
const label = 'field-label';

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** The card as the API wants it: numbers for the birthday, blanks left out. */
function toPayload(card) {
  return {
    firstName: card.firstName.trim(),
    lastName: card.lastName.trim(),
    phone: card.phone,
    email: card.email.trim(),
    birthDay: card.birthDay ? Number(card.birthDay) : undefined,
    birthMonth: card.birthMonth ? Number(card.birthMonth) : undefined,
    prayerRequest: card.prayerRequest.trim() || undefined,
    smsConsent: card.smsConsent,
    cardUnclear: card.cardUnclear,
  };
}

/**
 * Type up paper first-timer cards, one after another. Fields follow the card's order.
 * The phone number is checked as it's typed; if someone already uses it, the usher either
 * picks the returning visitor or confirms it's a different person (e.g. a shared family phone).
 */
export default function CardEntry({
  serviceDate,
  serviceDays,
  services,
  cardsByService,
  initialService,
}) {
  const router = useRouter();
  const firstNameRef = useRef(null);
  const [serviceKey, setServiceKey] = useState(initialService);
  const [counts, setCounts] = useState(cardsByService);
  const [card, setCard] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [lookup, setLookup] = useState({ phone: null, matches: [] });
  const [reviewing, setReviewing] = useState(false);
  const [status, setStatus] = useState({ state: 'idle' }); // idle | saving | error
  const [lastSaved, setLastSaved] = useState(null);

  const service = services.find((s) => s.key === serviceKey);
  const count = counts[serviceKey] ?? 0;
  const phone = normalizePhone(card.phone);
  const matches = lookup.phone === phone ? lookup.matches : [];
  const started = Object.entries(card).some(([k, v]) => v && v !== EMPTY[k]);

  // Check the number against church records as soon as it's a valid number.
  useEffect(() => {
    if (!phone || lookup.phone === phone) return undefined;
    const timer = setTimeout(async () => {
      const res = await post('/api/newcomers/lookup', { phone }).catch(() => null);
      if (res?.ok) setLookup({ phone, matches: res.data.matches });
    }, 350);
    return () => clearTimeout(timer);
  }, [phone, lookup.phone]);

  // Warn before closing the page with a half-typed card.
  useEffect(() => {
    if (!started) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [started]);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setCard((c) => ({ ...c, [field]: value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setStatus({ state: 'idle' });
  };

  function validate() {
    const found = {};
    if (!card.firstName.trim()) found.firstName = 'First name is required';
    if (!card.lastName.trim()) found.lastName = 'Last name is required';
    if (!isValidPhone(card.phone))
      found.phone = 'Enter a Nigerian mobile number, e.g. 0803 123 4567';
    if (card.email.trim() && !/^\S+@\S+\.\S+$/.test(card.email.trim())) {
      found.email = 'Check the email address';
    }
    const bday = birthdayProblem(Number(card.birthDay), Number(card.birthMonth));
    if (bday) found.birthDay = bday;
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function finish(message) {
    setLastSaved(message);
    setCard(EMPTY);
    setErrors({});
    setReviewing(false);
    setStatus({ state: 'idle' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    firstNameRef.current?.focus();
    router.refresh();
  }

  function failed(res) {
    if (!res) {
      setStatus({
        state: 'error',
        message: 'No connection. The card is still here — try again when data returns.',
      });
      return;
    }
    const fieldErrors = Object.fromEntries(
      (res.data.details || []).filter((d) => d.path?.length).map((d) => [d.path[0], d.message]),
    );
    setErrors(fieldErrors);
    setStatus({ state: 'error', message: res.data.error || 'Could not save. Please try again.' });
  }

  async function saveNew({ newPersonConfirmed = false } = {}) {
    if (!validate()) return;
    setStatus({ state: 'saving' });
    const res = await post('/api/newcomers', {
      ...toPayload(card),
      service: serviceKey,
      serviceDate,
      newPersonConfirmed,
    }).catch(() => null);

    if (res?.ok) {
      setCounts((c) => ({ ...c, [serviceKey]: (c[serviceKey] ?? 0) + 1 }));
      finish(`${card.firstName.trim()} ${card.lastName.trim()} saved as a First Timer`);
    } else if (res?.status === 409 && res.data.details?.matches?.length) {
      setLookup({ phone, matches: res.data.details.matches });
      setReviewing(true);
      setStatus(
        newPersonConfirmed
          ? {
              state: 'error',
              message: `Someone called ${card.firstName.trim()} ${card.lastName.trim()} is already on this number. If it's them, pick them below.`,
            }
          : { state: 'idle' },
      );
    } else {
      failed(res);
    }
  }

  async function saveReturning(match) {
    if (!validate()) return;
    setStatus({ state: 'saving' });
    const { email, birthDay, birthMonth, prayerRequest, smsConsent } = toPayload(card);
    const res = await post('/api/newcomers/returning', {
      personId: match.id,
      service: serviceKey,
      serviceDate,
      card: { email: email || undefined, birthDay, birthMonth, prayerRequest, smsConsent },
    }).catch(() => null);
    if (res?.ok) finish(`Welcome back recorded for ${match.firstName} ${match.lastName}`);
    else failed(res);
  }

  const goToDay = (day) => {
    if (started && !window.confirm('This card isn’t saved. Leave this day anyway?')) return;
    router.push(`/newcomers/new?date=${day}&service=${serviceKey}`);
  };

  if (reviewing) {
    return (
      <MatchReview
        matches={matches}
        card={card}
        serviceDate={serviceDate}
        serviceName={service.name}
        saving={status.state === 'saving'}
        error={status.state === 'error' ? status.message : null}
        onPick={saveReturning}
        onNewPerson={() => saveNew({ newPersonConfirmed: true })}
        onBack={() => {
          setReviewing(false);
          setStatus({ state: 'idle' });
        }}
      />
    );
  }

  const monthDays = daysInMonth(Number(card.birthMonth) || 1);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="person_add" size={16} />
            {service.name} · {dayLabel.format(new Date(serviceDate))}
          </p>
          <h1 className="page-title">First-timer card {count + 1}</h1>
          <p className="page-sub">
            Type the card exactly as written, in the same order as the paper.
          </p>
        </div>
        <span className="chip chip-primary">
          <Icon name="fact_check" size={15} />
          {count === 1 ? '1 card saved' : `${count} cards saved`}
        </span>
      </div>

      {lastSaved && (
        <p role="status" className="alert alert-success">
          <Icon name="check_circle" size={20} filled />
          {lastSaved}
        </p>
      )}

      <div className="flex flex-wrap gap-4">
        <DayChips days={serviceDays} selected={serviceDate} onSelect={goToDay} />
        <ServiceChips services={services} selected={serviceKey} onSelect={setServiceKey} />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (matches.length && validate()) setReviewing(true);
          else saveNew();
        }}
        className="card flex flex-col gap-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label="First name" required error={errors.firstName}>
            <input
              ref={firstNameRef}
              id="firstName"
              value={card.firstName}
              onChange={set('firstName')}
              autoCapitalize="words"
              autoComplete="off"
              maxLength={60}
              className={input}
            />
          </Field>
          <Field id="lastName" label="Last name" required error={errors.lastName}>
            <input
              id="lastName"
              value={card.lastName}
              onChange={set('lastName')}
              autoCapitalize="words"
              autoComplete="off"
              maxLength={60}
              className={input}
            />
          </Field>
        </div>

        <Field id="phone" label="Phone number" required error={errors.phone}>
          <div className="flex gap-2">
            <span className="flex min-h-[46px] items-center rounded-xl bg-surface-2 px-3.5 text-[15px] font-bold text-ink-2">
              +234
            </span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0803 000 0000"
              value={card.phone}
              onChange={set('phone')}
              maxLength={17}
              className={input}
            />
          </div>
          <PhoneStatus phone={phone} typed={card.phone} lookup={lookup} matches={matches} />
        </Field>

        <Field id="email" label="Email" hint="Optional" error={errors.email}>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            value={card.email}
            onChange={set('email')}
            className={input}
          />
        </Field>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${label} w-full`}>
            <span className="flex items-center gap-1.5">
              <Icon name="cake" size={18} className="text-coral-strong" />
              Birthday
            </span>
            <span className="font-semibold text-muted">Year not needed</span>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <select
              aria-label="Birthday day"
              value={card.birthDay}
              onChange={set('birthDay')}
              className={input}
            >
              <option value="">Day</option>
              {Array.from({ length: monthDays }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <select
              aria-label="Birthday month"
              value={card.birthMonth}
              onChange={set('birthMonth')}
              className={input}
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {errors.birthDay && <p className="field-error">{errors.birthDay}</p>}
        </fieldset>

        <div className="flex flex-col gap-2 rounded-tile bg-violet-soft p-4">
          <label htmlFor="prayerRequest" className={label}>
            <span className="flex items-center gap-1.5 text-violet">
              <Icon name="lock" size={16} />
              Prayer request
            </span>
            <span className="chip bg-surface text-violet">Pastors only</span>
          </label>
          <textarea
            id="prayerRequest"
            rows={3}
            maxLength={1000}
            value={card.prayerRequest}
            onChange={set('prayerRequest')}
            className="input resize-none"
          />
          <p className="flex justify-between text-[12px] font-semibold text-violet">
            <span className="flex items-center gap-1">
              <Icon name="shield" size={14} />
              Once saved, only the pastors can read it
            </span>
            <span>{card.prayerRequest.length} / 1000</span>
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-tile border border-line bg-surface-2 p-4">
          <input
            type="checkbox"
            checked={card.smsConsent}
            onChange={set('smsConsent')}
            className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[rgb(var(--primary))]"
          />
          <span>
            <span className="block text-[15px] font-semibold">Agreed to receive messages</span>
            <span className="block text-[13px] text-muted">
              Tick only if the card is ticked. They’ll get the church’s welcome and invite SMS.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-tile border border-line bg-surface-2 p-4">
          <input
            type="checkbox"
            checked={card.cardUnclear}
            onChange={set('cardUnclear')}
            className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[rgb(var(--primary))]"
          />
          <span>
            <span className="flex items-center gap-1.5 text-[15px] font-semibold">
              <Icon name="flag" size={16} className="text-danger" />
              Card hard to read
            </span>
            <span className="block text-[13px] text-muted">
              Flags it so someone checks the details with them next time.
            </span>
          </span>
        </label>

        {status.state === 'error' && (
          <p role="alert" className="alert alert-danger">
            {status.message}
          </p>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:justify-start">
          <button
            type="submit"
            disabled={status.state === 'saving'}
            className="btn btn-primary btn-lg"
          >
            <Icon
              name={status.state === 'saving' ? 'sync' : 'add_circle'}
              size={20}
              className={status.state === 'saving' ? 'animate-spin' : ''}
            />
            {status.state === 'saving' ? 'Saving…' : 'Save & next card'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (started && !window.confirm('This card isn’t saved. Finish anyway?')) return;
              router.push('/today');
            }}
            className="btn btn-ghost btn-lg"
          >
            <Icon name="task_alt" size={20} className="text-muted" />
            Done for now
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ id, label: text, required, hint, error, children }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={label}>
        <span>
          {text}
          {required && <span className="ml-0.5 text-coral-strong">*</span>}
        </span>
        {hint && <span className="font-semibold text-muted">{hint}</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Live feedback under the phone field: invalid, checking, new number, or already known. */
function PhoneStatus({ phone, typed, lookup, matches }) {
  const digits = typed.replace(/\D/g, '');
  if (!phone) {
    return digits.length >= 10 ? (
      <p className="field-error">That doesn’t look like a Nigerian mobile number</p>
    ) : null;
  }
  if (lookup.phone !== phone) {
    return <p className="mt-1.5 text-[13px] text-muted">Checking church records…</p>;
  }
  if (!matches.length) {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-[13px] font-bold text-success">
        <Icon name="check_circle" size={16} />
        New number
      </p>
    );
  }
  const names = matches.map((m) => `${m.firstName} ${m.lastName}`).join(', ');
  return (
    <p className="alert alert-warning mt-2">
      <Icon name="contact_phone" size={18} />
      Already in our records: {names}. Save to check if this is a returning visitor.
    </p>
  );
}
