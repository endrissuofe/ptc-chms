import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Logo from '@/components/ui/Logo';
import { ROLE_INFO } from '@/lib/users';
import { findJoinLink } from '@/services/user.service';
import JoinForm from './JoinForm';

export const metadata = { title: 'Join the team' };
export const dynamic = 'force-dynamic';

/** /join/<token>: the page a team's invite link opens. Public; the admin approves each person. */
export default async function JoinPage({ params }) {
  const { token } = await params;
  const link = await findJoinLink(token);
  const role = link ? ROLE_INFO[link.role] : null;

  return (
    <main className="min-h-screen px-4 py-8 sm:grid sm:place-items-center sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={44} />
          <div>
            <p className="font-display text-lg font-black">Ptchapel</p>
            <p className="text-meta text-muted">Peculiar Treasure Chapel · RCCG Youth Province 2</p>
          </div>
        </div>
        <div className="card flex flex-col gap-5">
          {link ? (
            <>
              <div>
                <p className="eyebrow">
                  <Icon name={role.icon} size={16} />
                  {link.label}
                </p>
                <h1 className="page-title">Join the team</h1>
                <p className="page-sub">
                  An admin checks each sign-up. You’ll get an email when you can sign in.
                </p>
              </div>
              <JoinForm token={token} />
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="icon-tile tone-warning">
                <Icon name="link_off" size={22} />
              </span>
              <h1 className="page-title">This link doesn’t work any more</h1>
              <p className="page-sub">Ask the church admin or your team leader for a new one.</p>
              <Link href="/login" className="btn btn-soft self-start">
                Go to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
