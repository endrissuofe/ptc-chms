import Icon from '@/components/ui/Icon';
import Logo from '@/components/ui/Logo';
import { findCheckIn } from '@/services/checkin.service';
import CheckInForm from './CheckInForm';

export const metadata = { title: 'How has it been?' };
export const dynamic = 'force-dynamic';

/** /c/<token>: the one-month check-in survey a first timer opens from their SMS. Public. */
export default async function CheckInPage({ params }) {
  const { token } = await params;
  const checkIn = await findCheckIn(token);

  return (
    <main className="min-h-screen px-4 py-8 sm:grid sm:place-items-center sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={44} />
          <div>
            <p className="font-display text-lg font-bold">Ptchapel</p>
            <p className="text-meta text-muted">Peculiar Treasure Chapel · RCCG Youth Province 2</p>
          </div>
        </div>
        <div className="card flex flex-col gap-5">
          {checkIn ? (
            <>
              <div>
                <h1 className="page-title">Hi {checkIn.firstName}!</h1>
                <p className="page-sub">
                  It’s been a month since you first worshipped with us. We’d love to know how it’s
                  been.
                </p>
              </div>
              <CheckInForm token={token} answered={checkIn.answered} />
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="icon-tile tone-warning">
                <Icon name="link_off" size={22} />
              </span>
              <h1 className="page-title">This link doesn’t work</h1>
              <p className="page-sub">Check it was copied in full from the SMS.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
