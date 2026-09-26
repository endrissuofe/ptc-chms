'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { formatPhone } from '@/lib/phone';
import { MONTHS } from '@/lib/birthday';

async function post(body) {
  const res = await fetch('/api/members/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Something went wrong');
  return data;
}

const STATUS = {
  new: { label: 'New', chip: 'chip-success' },
  update: { label: 'Already a member', chip: 'chip-primary' },
  duplicate: { label: 'Repeated in file', chip: 'chip-warning' },
  invalid: { label: 'Can’t import', chip: 'chip-danger' },
};

/**
 * Upload a member list (CSV with Name, Phone, Gender, Birthday). The file is checked first —
 * nothing is saved until the admin sees the result and presses Import.
 */
export default function MemberImport({ empty }) {
  const router = useRouter();
  const input = useRef(null);
  const [file, setFile] = useState(null); // { name, text }
  const [preview, setPreview] = useState(null);
  const [state, setState] = useState({ kind: 'idle' });
  const [open, setOpen] = useState(empty);

  async function choose(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setState({ kind: 'busy' });
    setPreview(null);
    try {
      const text = await f.text();
      setFile({ name: f.name, text });
      setPreview(await post({ csv: text, commit: false }));
      setState({ kind: 'idle' });
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
    e.target.value = '';
  }

  async function commit() {
    setState({ kind: 'busy' });
    try {
      const r = await post({ csv: file.text, commit: true });
      setState({
        kind: 'ok',
        message: `Imported: ${r.added} new, ${r.updated} already on the list${r.skipped ? `, ${r.skipped} skipped` : ''}.`,
      });
      setPreview(null);
      setFile(null);
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-soft">
          <Icon name="file_download" size={18} />
          Upload more members (CSV)
        </button>
        {state.kind === 'ok' && (
          <p role="status" className="alert alert-success">
            <Icon name="check_circle" size={19} filled />
            {state.message}
          </p>
        )}
      </div>
    );
  }

  const problems = preview?.rows.filter((r) => r.status !== 'new' && r.status !== 'update') ?? [];
  const shown = preview?.rows.slice(0, 200) ?? [];

  return (
    <section className="card flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="icon-tile tone-primary h-12 w-12">
          <Icon name="file_download" size={24} />
        </span>
        <div className="flex-1">
          <h2 className="text-2xl font-black">Upload your member list</h2>
          <p className="card-sub">
            A CSV file with the columns{' '}
            <strong className="text-ink">Name, Phone, Gender, Birthday</strong> (Excel: File → Save
            As → CSV). Birthdays like 14/10 or 14 Oct. Nothing is saved until you check it and press
            Import.
          </p>
        </div>
      </div>

      <input ref={input} type="file" accept=".csv,text/csv" onChange={choose} className="sr-only" />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={state.kind === 'busy'}
          className="btn btn-primary"
        >
          <Icon name="add" size={18} />
          {file ? 'Choose a different file' : 'Choose CSV file'}
        </button>
        {file && <span className="chip">{file.name}</span>}
        {state.kind === 'busy' && <span className="text-sm text-muted">Checking…</span>}
      </div>

      {state.kind === 'error' && (
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={19} />
          {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <p role="status" className="alert alert-success">
          <Icon name="check_circle" size={19} filled />
          {state.message}
        </p>
      )}

      {preview && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['new', 'update', 'duplicate', 'invalid'].map((s) => (
              <div key={s} className="rounded-tile bg-surface-2 p-4">
                <p className="label-caps">{STATUS[s].label}</p>
                <p className="font-display text-3xl font-black tabular-nums">
                  {preview.summary[s]}
                </p>
              </div>
            ))}
          </div>

          {problems.length > 0 && (
            <p className="alert alert-warning">
              <Icon name="error_outline" size={19} />
              {problems.length} {problems.length === 1 ? 'row' : 'rows'} will be skipped — see the
              reasons below. You can fix them in the file and upload it again later.
            </p>
          )}

          <div className="max-h-[420px] overflow-auto rounded-tile border border-line">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="sticky top-0 bg-surface-2 text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3">Birthday</th>
                  <th className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.line}>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{r.line}</td>
                    <td className="px-4 py-2.5 font-semibold">{r.name || '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.phone ? formatPhone(r.phone) : r.phoneRaw || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.gender ? (r.gender === 'male' ? 'Male' : 'Female') : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.birthDay ? (
                        `${r.birthDay} ${MONTHS[r.birthMonth - 1].slice(0, 3)}`
                      ) : r.birthdayUnread ? (
                        <span className="text-warning">Couldn’t read</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`chip ${STATUS[r.status].chip}`}>
                        {STATUS[r.status].label}
                      </span>
                      {r.problems.length > 0 && (
                        <span className="ml-2 text-[12px] text-danger">
                          {r.problems.join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > shown.length && (
              <p className="p-3 text-center text-[13px] text-muted">
                Showing the first {shown.length} of {preview.rows.length} rows.
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setFile(null);
                if (!empty) setOpen(false);
              }}
              className="btn btn-ghost btn-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={state.kind === 'busy' || preview.summary.new + preview.summary.update === 0}
              className="btn btn-primary btn-lg"
            >
              <Icon name="check" size={20} />
              Import {preview.summary.new} new {preview.summary.new === 1 ? 'member' : 'members'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
