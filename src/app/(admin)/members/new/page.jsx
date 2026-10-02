import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { getSession } from '@/lib/auth';
import { MEMBER_MANAGERS } from '@/lib/roles';
import AddMemberForm from './AddMemberForm';

export const metadata = { title: 'Add a member' };
export const dynamic = 'force-dynamic';

/**
 * /members/new: add one member. For the usher, follow-up and media teams this is all they
 * have of Members (they never see the list); pastors and admins also get a way back to it.
 */
export default async function AddMemberPage() {
  const seesList = MEMBER_MANAGERS.includes((await getSession())?.user?.role);
  return (
    <div className="flex max-w-3xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Members</p>
        <h1 className="of-h1">Add a member</h1>
        <p className="max-w-[65ch] text-meta text-muted">
          For someone who belongs to the church but isn’t on the members list yet, for example a
          birthday celebrant who was missed. If they’re already on the list, you’ll be told.
        </p>
      </header>
      <AddMemberForm />
      {seesList && (
        <Link href="/members" className="of-link inline-flex items-center gap-1 self-start">
          <Icon name="arrow_back" size={18} />
          Back to Members
        </Link>
      )}
    </div>
  );
}
