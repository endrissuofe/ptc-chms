import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import PublicFrame from '@/components/layout/PublicFrame';
import { findJoinLink } from '@/services/user.service';
import JoinForm from './JoinForm';

export const metadata = { title: 'Join the team' };
export const dynamic = 'force-dynamic';

/** /join/<token>: the page a team's invite link opens. Public; the admin approves each person. */
export default async function JoinPage({ params }) {
  const { token } = await params;
  const link = await findJoinLink(token);

  return (
    <PublicFrame>
      {link ? (
        <>
          <header className="flex flex-col gap-2">
            <p className="of-eyebrow">{link.label}</p>
            <h1 className="of-h1">Join the team</h1>
            <p className="text-meta text-muted">
              An admin checks each sign-up. You’ll get an email when you can sign in.
            </p>
          </header>
          <JoinForm token={token} />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="icon-tile tone-warning">
            <Icon name="link_off" size={22} />
          </span>
          <h1 className="of-h2">This link doesn’t work any more</h1>
          <p className="text-meta text-muted">
            Ask the church admin or your team leader for a new one.
          </p>
          <Link href="/login" className="of-btn-quiet self-start">
            Go to sign in
          </Link>
        </div>
      )}
    </PublicFrame>
  );
}
