'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { formatServiceTime } from '@/lib/church';

async function api(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Something went wrong');
  return data;
}

const input =
  'h-11 rounded-[10px] border-[1.5px] border-line bg-surface px-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';

/** Add, rename, retime, reorder and switch off services. Services are never deleted. */
export default function ServicesManager({ initial }) {
  const [services, setServices] = useState(initial);
  const [error, setError] = useState('');
  const activeCount = services.filter((s) => s.active).length;

  async function run(action) {
    setError('');
    try {
      await action();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  const replace = (updated) =>
    setServices((list) => list.map((s) => (s.key === updated.key ? updated : s)));

  const move = (index, by) =>
    run(async () => {
      const order = services.map((s) => s.key);
      [order[index], order[index + by]] = [order[index + by], order[index]];
      setServices((await api('/api/services', 'PATCH', { order })).items);
    });

  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {services.map((s, i) => (
            <ServiceRow
              key={s.key}
              service={s}
              canMoveUp={i > 0}
              canMoveDown={i < services.length - 1}
              onMove={(by) => move(i, by)}
              isLastActive={s.active && activeCount === 1}
              onSave={(changes) =>
                run(async () => replace(await api(`/api/services/${s.key}`, 'PATCH', changes)))
              }
            />
          ))}
        </ul>
      </section>

      <AddService
        onAdd={(values) =>
          run(async () => {
            const created = await api('/api/services', 'POST', values);
            setServices((list) => [...list, created]);
          })
        }
      />
    </>
  );
}

function ServiceRow({ service, canMoveUp, canMoveDown, onMove, isLastActive, onSave }) {
  const [name, setName] = useState(service.name);
  const [startTime, setStartTime] = useState(service.startTime);
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== service.name || startTime !== service.startTime;

  async function save(changes) {
    setBusy(true);
    await onSave(changes);
    setBusy(false);
  }

  return (
    <li
      className={`flex flex-wrap items-center gap-3 px-5 py-4 ${service.active ? '' : 'bg-paper'}`}
    >
      <div className="flex flex-col">
        <button
          type="button"
          aria-label={`Move ${service.name} up`}
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
          className="flex h-6 w-8 items-center justify-center rounded text-muted hover:bg-paper disabled:opacity-30"
        >
          <Icon name="arrow_upward" size={18} />
        </button>
        <button
          type="button"
          aria-label={`Move ${service.name} down`}
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
          className="flex h-6 w-8 rotate-180 items-center justify-center rounded text-muted hover:bg-paper disabled:opacity-30"
        >
          <Icon name="arrow_upward" size={18} />
        </button>
      </div>

      <form
        className="flex flex-1 flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save({ name: name.trim(), startTime });
        }}
      >
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px] font-semibold text-muted">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            className={`${input} font-normal text-ink`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
          Starts
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className={`${input} font-normal text-ink`}
          />
        </label>
        <button
          type="submit"
          disabled={!dirty || busy}
          className="mt-5 h-11 rounded-[10px] bg-primary px-4 text-[15px] font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
        >
          Save
        </button>
      </form>

      <div className="mt-5 flex items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            service.active
              ? 'bg-stage-regular-bg text-stage-regular-text'
              : 'bg-stage-second-bg text-muted'
          }`}
        >
          {service.active ? 'Active' : 'Switched off'}
        </span>
        <button
          type="button"
          disabled={busy || isLastActive}
          title={isLastActive ? 'At least one service must stay active' : undefined}
          onClick={() => save({ active: !service.active })}
          className="h-11 rounded-[10px] border-[1.5px] border-line px-3 text-[13px] font-semibold hover:border-primary disabled:opacity-40"
        >
          {service.active ? 'Switch off' : 'Switch on'}
        </button>
      </div>
    </li>
  );
}

function AddService({ onAdd }) {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Add a service</h2>
      <p className="mt-1 text-[13px] text-muted">
        For example “2nd Service” at 10:00. Ushers see it straight away.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onAdd({ name: name.trim(), startTime })) {
            setName('');
            setStartTime('');
          }
        }}
      >
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px] font-semibold text-muted">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            placeholder="2nd Service"
            className={`${input} font-normal text-ink`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
          Starts
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className={`${input} font-normal text-ink`}
          />
        </label>
        <button
          type="submit"
          className="flex h-11 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[15px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="add" size={18} />
          Add service
        </button>
      </form>
      {startTime && (
        <p className="mt-2 text-[13px] text-muted">Shows as {formatServiceTime(startTime)}</p>
      )}
    </section>
  );
}
