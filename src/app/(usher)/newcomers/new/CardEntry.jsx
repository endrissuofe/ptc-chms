'use client';

import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { DayChips, ServiceChips } from '@/components/usher/ServiceDayPicker';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { MONTHS, birthdayProblem, daysInMonth } from '@/lib/birthday';
import { useUnsavedGuard } from '@/lib/use-unsaved-guard';
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
const NO_LOOKUP = { phone: null, matches: [], error: false };
// The order the cursor goes to when something is missing.
const FIELD_ORDER = ['firstName', 'lastName', 'phone', 'email', 'birthDay'];

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const confirm = useConfirm();
  const formRef = useRef(null);
  const [serviceKey, setServiceKey] = useState(initialService);
  const [counts, setCounts] = useState(cardsByService);
  const [card, setCard] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [lookup, setLookup] = useState(NO_LOOKUP);
  const [reviewing, setReviewing] = useState(false);
  const [status, setStatus] = useState({ state: 'idle' }); // idle | saving | error
  const [lastSaved, setLastSaved] = useState(null);

  const saving = status.state === 'saving';
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
      setLookup(
        res?.ok
          ? { phone, matches: res.data.matches, error: false }
          : { phone, matches: [], error: true },
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [phone, lookup.phone]);

  useUnsavedGuard(started && !saving, {
    title: 'Leave this card?',
    body: 'The card you are typing hasn’t been saved yet.',
  });

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setCard((c) => {
      const next = { ...c, [field]: value };
      // A day that doesn't exist in the new month (e.g. 31 February) is cleared.
      if (
        field === 'birthMonth' &&
        next.birthDay &&
        Number(next.birthDay) > daysInMonth(Number(value) || 1)
      ) {
        next.birthDay = '';
      }
      return next;
    });
    setErrors((er) => ({ ...er, [field]: undefined }));
    setStatus((s) => (s.state === 'saving' ? s : { state: 'idle' }));
  };

  function focusField(id) {
    const el = formRef.current?.querySelector(`#${id}`);
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  function validate() {
    const found = {};
    if (!card.firstName.trim()) found.firstName = 'First name is required';
    if (!card.lastName.trim()) found.lastName = 'Last name is required';
    if (!isValidPhone(card.phone)) {
      found.phone = 'Enter a Nigerian mobile number, e.g. 0803 000 0000';
    }
    if (card.email.trim() && !/^\S+@\S+\.\S+$/.test(card.email.trim())) {
      found.email = 'Check the email address';
    }
    const bday = birthdayProblem(Number(card.birthDay), Number(card.birthMonth));
    if (bday) found.birthDay = bday;
    setErrors(found);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) focusField(first);
    return !first;
  }

  function finish(message) {
    setLastSaved(message);
    setCard(EMPTY);
    setErrors({});
    // Forget the old lookup: the person just saved is now on that number.
    setLookup(NO_LOOKUP);
    setReviewing(false);
    setStatus({ state: 'idle' });
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    formRef.current?.querySelector('#firstName')?.focus({ preventScroll: true });
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
    const first = FIELD_ORDER.find((f) => fieldErrors[f]);
    if (first) focusField(first);
    setStatus({
      state: 'error',
      message: first
        ? 'Please check the highlighted fields.'
        : res.data.error || 'Could not save. Please try again.',
      signedOut: res.status === 401,
    });
  }

  async function saveNew({ newPersonConfirmed = false } = {}) {
    if (saving || !validate()) return;
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
      setLookup({ phone, matches: res.data.details.matches, error: false });
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
    if (saving || !validate()) return;
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

  const askToLeave = () =>
    confirm({
      title: 'Leave this card?',
      body: 'The card you are typing hasn’t been saved yet.',
      confirmLabel: 'Leave without saving',
      cancelLabel: 'Keep typing',
      tone: 'danger',
    });

  const goToDay = async (day) => {
    if (started && !(await askToLeave())) return;
    setCard(EMPTY);
    router.push(`/newcomers/new?date=${day}&service=${serviceKey}`);
  };

  if (reviewing) {
    return (
      <MatchReview
        matches={matches}
        card={card}
        serviceDate={serviceDate}
        serviceName={service.name}
        saving={saving}
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

      {lastSaved && <FormAlert success={lastSaved} />}

      <div className="flex min-w-0 flex-wrap gap-4">
        <DayChips days={serviceDays} selected={serviceDate} onSelect={goToDay} />
        <ServiceChips services={services} selected={serviceKey} onSelect={setServiceKey} />
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (saving) return;
          if (matches.length && validate()) setReviewing(true);
          else saveNew();
        }}
        className="card flex flex-col gap-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label="First name" required error={errors.firstName}>
            <input
              id="firstName"
              value={card.firstName}
              onChange={set('firstName')}
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={60}
              className="input"
            />
          </Field>
          <Field id="lastName" label="Last name" required error={errors.lastName}>
            <input
              id="lastName"
              value={card.lastName}
              onChange={set('lastName')}
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={60}
              className="input"
            />
          </Field>
        </div>

        <Field
          id="phone"
          label="Phone number"
          required
          error={errors.phone}
          after={
            <PhoneStatus
              phone={phone}
              typed={card.phone}
              lookup={lookup}
              matches={matches}
              onRetry={() => setLookup(NO_LOOKUP)}
            />
          }
        >
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="e.g. 0803 000 0000"
            value={card.phone}
            onChange={set('phone')}
            maxLength={18}
            className="input"
          />
        </Field>

        <Field id="email" label="Email" hint="Optional" error={errors.email}>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="next"
            value={card.email}
            onChange={set('email')}
            className="input"
          />
        </Field>

        <fieldset
          className="flex flex-col gap-1.5"
          aria-describedby={errors.birthDay ? 'birthDay-error' : undefined}
        >
          <legend className="field-label w-full">
            <span className="flex items-center gap-1.5">
              <Icon name="cake" size={18} className="text-coral-ink" />
              Birthday
            </span>
            <span className="font-semibold text-muted">Year not needed</span>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <select
              id="birthDay"
              aria-label="Birthday day"
              aria-invalid={errors.birthDay ? true : undefined}
              value={card.birthDay}
              onChange={set('birthDay')}
              className="input"
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
              aria-invalid={errors.birthDay ? true : undefined}
              value={card.birthMonth}
              onChange={set('birthMonth')}
              className="input"
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {errors.birthDay && (
            <p id="birthDay-error" className="field-error">
              <Icon name="error_outline" size={16} className="mt-px" />
              {errors.birthDay}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-2 rounded-tile bg-violet-soft p-4">
          <label htmlFor="prayerRequest" className="field-label">
            <span className="flex items-center gap-1.5 text-violet">
              <Icon name="volunteer_activism" size={16} />
              Prayer request
            </span>
            <span className="font-semibold text-violet">Optional</span>
          </label>
          <textarea
            id="prayerRequest"
            rows={3}
            maxLength={1000}
            value={card.prayerRequest}
            onChange={set('prayerRequest')}
            className="input resize-none"
          />
          <p className="text-right text-xs font-semibold text-violet">
            {card.prayerRequest.length} / 1000
          </p>
        </div>

        <label className="check-row items-start">
          <input
            type="checkbox"
            checked={card.smsConsent}
            onChange={set('smsConsent')}
            className="checkbox mt-0.5"
          />
          <span>
            <span className="block font-semibold">Agreed to receive messages</span>
            <span className="block text-meta text-muted">
              Tick only if the card is ticked. They’ll get the church’s welcome and invite SMS.
            </span>
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={card.cardUnclear}
            onChange={set('cardUnclear')}
            className="checkbox"
          />
          <span className="flex items-center gap-1.5 font-semibold">
            <Icon name="flag" size={16} className="text-danger" />
            Card hard to read
          </span>
        </label>

        {status.state === 'error' && (
          <FormAlert error={{ message: status.message, signedOut: status.signedOut }} />
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:justify-start">
          <button type="submit" aria-disabled={saving} className="btn btn-primary btn-lg">
            <Busy busy={saving} icon="add_circle" label="Save & next card" size={20} />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              if (started && !(await askToLeave())) return;
              setCard(EMPTY);
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

/**
 * A labelled field. The input inside gets aria-invalid and is linked to its error, so screen
 * readers read the problem; `after` sits between the input and the error (e.g. phone status).
 */
function Field({ id, label: text, required, hint, error, after, children }) {
  const errorId = `${id}-error`;
  const input = Children.only(children);
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="field-label">
        <span>
          {text}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-coral-ink">
              *
            </span>
          )}
        </span>
        {hint && <span className="font-semibold text-muted">{hint}</span>}
      </label>
      {isValidElement(input)
        ? cloneElement(input, {
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? errorId : undefined,
            'aria-required': required || undefined,
          })
        : input}
      {after}
      {error && (
        <p id={errorId} className="field-error">
          <Icon name="error_outline" size={16} className="mt-px" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Live feedback under the phone field: invalid, checking, new number, or already known. */
function PhoneStatus({ phone, typed, lookup, matches, onRetry }) {
  const digits = typed.replace(/\D/g, '');
  if (!phone) {
    return digits.length >= 10 ? (
      <p className="field-hint font-semibold text-danger">
        That doesn’t look like a Nigerian mobile number
      </p>
    ) : null;
  }
  if (lookup.phone !== phone) {
    return (
      <p className="field-hint flex items-center gap-1.5">
        <Icon name="sync" size={15} className="motion-safe:animate-spin" />
        Checking church records…
      </p>
    );
  }
  if (lookup.error) {
    return (
      <p className="field-hint flex flex-wrap items-center gap-x-2">
        Couldn’t check the records right now — you can still save.
        <button type="button" onClick={onRetry} className="tap-link text-primary">
          Try again
        </button>
      </p>
    );
  }
  if (!matches.length) {
    return (
      <p className="field-hint flex items-center gap-1 font-bold text-success">
        <Icon name="check_circle" size={16} />
        New number
      </p>
    );
  }
  const names = matches.map((m) => `${m.firstName} ${m.lastName}`).join(', ');
  return (
    <p className="alert alert-info mt-2">
      <Icon name="contact_phone" size={18} />
      <span>
        Already in our records: <strong>{names}</strong>. Press Save to check if this is a returning
        visitor.
      </span>
    </p>
  );
}
