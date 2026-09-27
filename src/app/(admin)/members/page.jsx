import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import { formatPhone } from '@/lib/phone';
import { MONTHS } from '@/lib/birthday';
import { listMembers } from '@/services/member.service';
import MemberImport from './MemberImport';

export const metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

/** /members?q=okafor&page=2 */
export default async function MembersPage({ searchParams }) {
  const { q = '', page = '1' } = await searchParams;
  const current = Math.max(Number(page) || 1, 1);
  const list = await listMembers({ q, page: current });
  const pages = Math.max(Math.ceil(list.total / list.limit), 1);
  const link = (p) => `/members?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="contacts" size={16} />
            Church family
          </p>
          <h1 className="page-title">Members</h1>
          <p className="page-sub">
            {list.all === 1 ? '1 member' : `${list.all} members`} on the list.
          </p>
        </div>
        {list.all > 0 && (
          <Link href="/sms#broadcast" className="btn btn-soft">
            <Icon name="send" size={18} />
            Send them a message
          </Link>
        )}
      </div>

      <MemberImport empty={list.all === 0} />

      {list.all > 0 && (
        <section className="card flex flex-col gap-4">
          <form className="flex flex-wrap gap-2" action="/members">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Search by name or phone</span>
              <Icon
                name="search"
                size={20}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search by name or phone"
                className="input pl-11"
              />
            </label>
            <button type="submit" className="btn btn-soft">
              Search
            </button>
            {q && (
              <Link href="/members" className="btn btn-ghost">
                Clear
              </Link>
            )}
          </form>

          {list.items.length === 0 ? (
            <p className="py-6 text-center text-muted">Nobody matches “{q}”.</p>
          ) : (
            <ul className="divide-y divide-line">
              {list.items.map((m) => (
                <li key={m._id} className="flex items-center gap-3 py-3">
                  <Avatar name={`${m.firstName} ${m.lastName}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-extrabold">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-meta text-muted">{formatPhone(m.phone)}</p>
                  </div>
                  <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                    {m.source === 'first_timer' && m.person && (
                      <Link href={`/newcomers/${m.person}`} className="chip chip-coral">
                        <Icon name="person_add" size={14} />
                        Was a first timer
                      </Link>
                    )}
                    {m.gender && (
                      <span className="chip">{m.gender === 'male' ? 'Male' : 'Female'}</span>
                    )}
                    {m.birthDay && (
                      <span className="chip chip-coral">
                        <Icon name="cake" size={14} />
                        {m.birthDay} {MONTHS[m.birthMonth - 1].slice(0, 3)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
              <span className="text-meta text-muted">
                Page {current} of {pages} · {list.total} {q ? 'found' : 'members'}
              </span>
              <div className="flex gap-2">
                {current > 1 && (
                  <Link href={link(current - 1)} className="btn btn-ghost btn-sm">
                    <Icon name="arrow_back" size={16} />
                    Previous
                  </Link>
                )}
                {current < pages && (
                  <Link href={link(current + 1)} className="btn btn-ghost btn-sm">
                    Next
                    <Icon name="arrow_forward" size={16} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
