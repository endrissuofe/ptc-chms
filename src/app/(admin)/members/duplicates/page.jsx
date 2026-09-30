import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import { formatPhone } from '@/lib/phone';
import { listPossibleDuplicates } from '@/services/member.service';
import DuplicatePair from './DuplicatePair';

export const metadata = { title: 'Possible duplicates' };
export const dynamic = 'force-dynamic';

const shown = (m) => ({
  id: String(m._id),
  name: `${m.firstName} ${m.lastName ?? ''}`.trim(),
  address: m.address ?? '',
  gender: m.gender ?? '',
  birthDay: m.birthDay ?? null,
  birthMonth: m.birthMonth ?? null,
  anniversaryDay: m.anniversaryDay ?? null,
  anniversaryMonth: m.anniversaryMonth ?? null,
  smsOptOut: Boolean(m.smsOptOut),
  wasFirstTimer: Boolean(m.person),
  added: m.createdAt ? new Date(m.createdAt).toISOString() : null,
});

/** /members/duplicates: members sharing a phone whose names look like one person. */
export default async function DuplicatesPage() {
  const groups = await listPossibleDuplicates();
  const pairs = groups.reduce((n, g) => n + g.pairs.length, 0);

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Members</p>
        <h1 className="of-h1">
          {pairs === 0
            ? 'No possible duplicates'
            : pairs === 1
              ? '1 possible duplicate'
              : `${pairs} possible duplicates`}
        </h1>
        <p className="max-w-[65ch] text-meta text-muted">
          People on the same phone whose names look alike, often one person entered twice with a
          spelling slip. Families share phones too, so check before merging. Merging keeps one
          record, adds anything it was missing from the other, and takes the other off the list.
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState
          card
          icon="task_alt"
          title="Nothing to check"
          action={{ href: '/members', label: 'Back to Members' }}
        >
          Nobody on the members list shares a phone with a look-alike name.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((g) =>
            g.pairs.map((p) => (
              <li key={`${p.a._id}-${p.b._id}`}>
                <DuplicatePair
                  phone={formatPhone(g.phone)}
                  reason={p.reason}
                  a={shown(p.a)}
                  b={shown(p.b)}
                />
              </li>
            )),
          )}
        </ul>
      )}

      <Link href="/members" className="of-link inline-flex items-center gap-1 self-start">
        <Icon name="arrow_back" size={18} />
        Back to Members
      </Link>
    </div>
  );
}
