import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import { listMembers, listPossibleDuplicates } from '@/services/member.service';
import MemberImport from './MemberImport';
import MemberList, { AddMember } from './MemberList';

export const metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

/** /members?q=okafor&page=2 */
export default async function MembersPage({ searchParams }) {
  const { q = '', page = '1' } = await searchParams;
  const current = Math.max(Number(page) || 1, 1);
  const [list, duplicates] = await Promise.all([
    listMembers({ q, page: current }),
    listPossibleDuplicates(),
  ]);
  const toCheck = duplicates.reduce((n, g) => n + g.pairs.length, 0);
  const pages = Math.max(Math.ceil(list.total / list.limit), 1);
  const link = (p) => `/members?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`;

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Members</p>
        <h1 className="of-h1">
          {list.all === 0 ? 'No members yet' : list.all === 1 ? '1 member' : `${list.all} members`}
        </h1>
        <p className="max-w-[65ch] text-meta text-muted">
          {list.all === 0
            ? 'Add people one at a time, or upload your list from a spreadsheet.'
            : 'Their birthdays and anniversaries show on the Birthdays screen. Members with SMS on get church messages and wishes.'}
        </p>
      </header>

      {/* Buttons first; a form or upload that is opened drops below them (order-last). */}
      <div className="flex flex-wrap items-center gap-2">
        <AddMember />
        <MemberImport empty={list.all === 0} />
        {list.all > 0 && (
          <Link href="/sms#broadcast" className="of-btn-quiet">
            <Icon name="send" size={18} />
            Send them a message
          </Link>
        )}
        {toCheck > 0 && (
          <Link href="/members/duplicates" className="of-btn-quiet">
            <Icon name="group" size={18} />
            {toCheck === 1 ? '1 possible duplicate' : `${toCheck} possible duplicates`}
          </Link>
        )}
      </div>

      {list.all > 0 && (
        <section className="flex flex-col gap-4" aria-label="Member list">
          <form className="flex flex-wrap items-center gap-2" action="/members">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search by name or phone</span>
              <Icon
                name="search"
                size={20}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                name="q"
                defaultValue={q}
                type="search"
                enterKeyHint="search"
                placeholder="Search by name or phone"
                className="input rounded-full pl-11 focus:border-of-accent focus:ring-of-accent/30"
              />
            </label>
            <button type="submit" className="of-btn-quiet">
              Search
            </button>
            {q && (
              <Link href="/members" className="of-link px-2">
                Clear
              </Link>
            )}
          </form>

          {q && list.items.length > 0 && (
            <p className="text-meta text-muted">
              {list.total === 1 ? '1 found' : `${list.total} found`} for “{q}”
            </p>
          )}

          {list.items.length === 0 ? (
            <EmptyState
              card
              icon="person_search"
              title={`Nobody matches “${q}”`}
              action={{ href: '/members', label: 'Clear search' }}
            />
          ) : (
            <MemberList
              members={list.items.map((m) => ({
                id: String(m._id),
                firstName: m.firstName,
                lastName: m.lastName ?? '',
                phone: m.phone,
                address: m.address ?? '',
                gender: m.gender ?? '',
                birthDay: m.birthDay ?? null,
                birthMonth: m.birthMonth ?? null,
                anniversaryDay: m.anniversaryDay ?? null,
                anniversaryMonth: m.anniversaryMonth ?? null,
                smsOptOut: Boolean(m.smsOptOut),
                source: m.source,
                person: m.person ? String(m.person) : null,
              }))}
            />
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-meta text-muted">
                Page {current} of {pages} · {list.total} {q ? 'found' : 'members'}
              </span>
              <div className="flex gap-2">
                {current > 1 && (
                  <Link href={link(current - 1)} className="of-btn-quiet">
                    <Icon name="arrow_back" size={18} />
                    Previous
                  </Link>
                )}
                {current < pages && (
                  <Link href={link(current + 1)} className="of-btn-quiet">
                    Next
                    <Icon name="arrow_forward" size={18} />
                  </Link>
                )}
              </div>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
