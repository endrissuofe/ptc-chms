'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import Busy from '@/components/ui/Busy';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { formatPhone } from '@/lib/phone';
import { MONTHS, daysInMonth } from '@/lib/birthday';

const short = (d, m) => `${d} ${MONTHS[m - 1].slice(0, 3)}`;

/** "Add a member" plus the list, where each member can be edited in place. */
export function AddMember() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null);
  const button = useRef(null);
  if (open) {
    return (
      <section className="card">
        <MemberForm
          title="Add a member"
          onCancel={() => {
            setOpen(false);
            requestAnimationFrame(() => button.current?.focus());
          }}
          onSaved={(m) => {
            setOpen(false);
            setDone(`${m.firstName} ${m.lastName} added.`);
            requestAnimationFrame(() => button.current?.focus());
          }}
        />
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <button
        ref={button}
        type="button"
        onClick={() => {
          setOpen(true);
          setDone(null);
        }}
        className="btn btn-primary self-start"
      >
        <Icon name="person_add" size={18} />
        Add a member
      </button>
      {done && <FormAlert success={done} />}
    </div>
  );
}

export default function MemberList({ members }) {
  return (
    <ul className="divide-y divide-line">
      {members.map((m) => (
        <MemberRow key={m.id} member={m} />
      ))}
    </ul>
  );
}

function MemberRow({ member: m }) {
  const [editing, setEditing] = useState(false);
  const [done, setDone] = useState(null);
  const edit = useRef(null);
  const name = `${m.firstName} ${m.lastName}`.trim();

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="break-words font-display font-extrabold">{name}</p>
          <p className="text-meta text-muted">{formatPhone(m.phone)}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {m.source === 'first_timer' && m.person && (
            <Link
              href={`/newcomers/${m.person}`}
              className="-my-2.5 inline-flex min-h-[44px] items-center"
            >
              <span className="chip chip-primary">
                <Icon name="person_add" size={14} />
                Was a first timer
              </span>
            </Link>
          )}
          {m.birthDay && (
            <span className="chip chip-coral" title="Birthday">
              <Icon name="cake" size={14} />
              {short(m.birthDay, m.birthMonth)}
            </span>
          )}
          {m.anniversaryDay && (
            <span className="chip chip-violet" title="Wedding anniversary">
              <Icon name="favorite" size={14} />
              {short(m.anniversaryDay, m.anniversaryMonth)}
            </span>
          )}
          {m.smsOptOut && <span className="chip">No SMS</span>}
        </div>
        {!editing && (
          <button
            ref={edit}
            type="button"
            onClick={() => {
              setEditing(true);
              setDone(null);
            }}
            className="btn btn-ghost btn-sm"
            aria-label={`Edit ${name}`}
          >
            <Icon name="edit_note" size={17} />
            Edit
          </button>
        )}
      </div>
      {editing && (
        <div className="rounded-tile border border-line p-4">
          <MemberForm
            member={m}
            onCancel={() => {
              setEditing(false);
              requestAnimationFrame(() => edit.current?.focus());
            }}
            onSaved={(_, message) => {
              setEditing(false);
              setDone(message);
              requestAnimationFrame(() => edit.current?.focus());
            }}
          />
        </div>
      )}
      {done && <FormAlert success={done} />}
    </li>
  );
}

function DateField({ label, icon, day, month, onDay, onMonth, error, errorId }) {
  const days = daysInMonth(Number(month) || 1);
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="field-label">
        <span className="flex items-center gap-1.5">
          <Icon name={icon} size={17} className="text-muted" />
          {label}
        </span>
        <span className="font-semibold text-muted">Optional</span>
      </legend>
      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
        <select
          aria-label={`${label} day`}
          value={day}
          onChange={(e) => onDay(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="input"
        >
          <option value="">Day</option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} month`}
          value={month}
          onChange={(e) => {
            onMonth(e.target.value);
            if (day && Number(day) > daysInMonth(Number(e.target.value) || 1)) onDay('');
          }}
          aria-invalid={error ? true : undefined}
          className="input"
        >
          <option value="">Month</option>
          {MONTHS.map((mn, i) => (
            <option key={mn} value={i + 1}>
              {mn}
            </option>
          ))}
        </select>
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  );
}

function MemberForm({ member, title, onCancel, onSaved }) {
  const router = useRouter();
  const confirm = useConfirm();
  const form = useRef(null);
  const [f, setF] = useState({
    firstName: member?.firstName ?? '',
    lastName: member?.lastName ?? '',
    phone: member ? formatPhone(member.phone) : '',
    gender: member?.gender ?? '',
    birthDay: member?.birthDay ?? '',
    birthMonth: member?.birthMonth ?? '',
    anniversaryDay: member?.anniversaryDay ?? '',
    anniversaryMonth: member?.anniversaryMonth ?? '',
    sms: !member?.smsOptOut,
  });
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy' || state.kind === 'removing';
  const fields = state.kind === 'error' ? (state.error.fields ?? {}) : {};
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  const num = (v) => (v === '' ? null : Number(v));

  useEffect(() => {
    form.current?.querySelector('input')?.focus();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setState({ kind: 'busy' });
    const body = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      phone: f.phone,
      gender: f.gender || null,
      birthDay: num(f.birthDay),
      birthMonth: num(f.birthMonth),
      anniversaryDay: num(f.anniversaryDay),
      anniversaryMonth: num(f.anniversaryMonth),
      smsOptOut: !f.sms,
    };
    try {
      const saved = member
        ? await sendJson(`/api/members/${member.id}`, 'PATCH', body)
        : await sendJson('/api/members', 'POST', body);
      router.refresh();
      onSaved(saved, 'Saved.');
    } catch (err) {
      setState({ kind: 'error', error: err });
      const first = ['firstName', 'phone', 'birthDay', 'anniversaryDay'].find(
        (k) => err.fields?.[k],
      );
      if (first)
        form.current
          ?.querySelector(
            `[name="${first}"], [aria-label^="${first === 'birthDay' ? 'Birthday' : 'Wedding'}"]`,
          )
          ?.focus();
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Take ${member.firstName} off the members list?`,
      body: 'They stop getting member messages. Their record is kept, so you can add them back.',
      confirmLabel: 'Take off the list',
      tone: 'danger',
    });
    if (!ok) return;
    setState({ kind: 'removing' });
    try {
      await sendJson(`/api/members/${member.id}`, 'PATCH', { active: false });
      router.refresh();
      onSaved(null, `${member.firstName} is no longer on the list.`);
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  const invalid = (k) =>
    fields[k]
      ? { 'aria-invalid': true, 'aria-describedby': `${member?.id ?? 'new'}-${k}-error` }
      : {};
  const errId = (k) => `${member?.id ?? 'new'}-${k}-error`;

  return (
    <form
      ref={form}
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="flex flex-col gap-4 motion-safe:animate-fade-in"
    >
      {title && <h2 className="card-title">{title}</h2>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col">
          <span className="field-label">First name</span>
          <input
            name="firstName"
            value={f.firstName}
            onChange={set('firstName')}
            required
            maxLength={60}
            autoCapitalize="words"
            className="input"
            {...invalid('firstName')}
          />
          <FieldError id={errId('firstName')}>{fields.firstName}</FieldError>
        </label>
        <label className="flex flex-col">
          <span className="field-label">Last name</span>
          <input
            name="lastName"
            value={f.lastName}
            onChange={set('lastName')}
            maxLength={60}
            autoCapitalize="words"
            className="input"
          />
        </label>
        <label className="flex flex-col">
          <span className="field-label">Phone</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            value={f.phone}
            onChange={set('phone')}
            required
            placeholder="e.g. 0803 000 0000"
            className="input"
            {...invalid('phone')}
          />
          <FieldError id={errId('phone')}>{fields.phone}</FieldError>
        </label>
        <label className="flex flex-col">
          <span className="field-label">
            Gender <span className="font-semibold text-muted">Optional</span>
          </span>
          <select value={f.gender} onChange={set('gender')} className="input">
            <option value="">Not given</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <DateField
          label="Birthday"
          icon="cake"
          day={f.birthDay}
          month={f.birthMonth}
          onDay={set('birthDay')}
          onMonth={set('birthMonth')}
          error={fields.birthDay}
          errorId={errId('birthDay')}
        />
        <DateField
          label="Wedding anniversary"
          icon="favorite"
          day={f.anniversaryDay}
          month={f.anniversaryMonth}
          onDay={set('anniversaryDay')}
          onMonth={set('anniversaryMonth')}
          error={fields.anniversaryDay}
          errorId={errId('anniversaryDay')}
        />
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={f.sms}
          onChange={(e) => setF((s) => ({ ...s, sms: e.target.checked }))}
          className="checkbox"
        />
        Send them church SMS (messages, birthday and anniversary wishes)
      </label>
      {state.kind === 'error' && !Object.keys(fields).length && <FormAlert error={state.error} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" aria-disabled={busy} className="btn btn-primary">
          <Busy busy={state.kind === 'busy'} icon="save" label={member ? 'Save' : 'Add member'} />
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
        {member && (
          <button
            type="button"
            onClick={remove}
            aria-disabled={busy}
            className="btn btn-danger-ghost sm:ml-auto"
          >
            <Busy
              busy={state.kind === 'removing'}
              busyLabel="Removing…"
              icon="remove"
              label="Take off the list"
            />
          </button>
        )}
      </div>
    </form>
  );
}
