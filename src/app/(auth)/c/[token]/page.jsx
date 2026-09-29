import Icon from '@/components/ui/Icon';
import PublicFrame from '@/components/layout/PublicFrame';
import { findCheckIn } from '@/services/checkin.service';
import CheckInForm from './CheckInForm';

export const metadata = { title: 'How has it been?' };
export const dynamic = 'force-dynamic';

/** /c/<token>: the one-month check-in survey a first timer opens from their SMS. Public. */
export default async function CheckInPage({ params }) {
  const { token } = await params;
  const checkIn = await findCheckIn(token);

  return (
    <PublicFrame>
      {checkIn ? (
        <>
          <header className="flex flex-col gap-2">
            <h1 className="of-h1">Hi {checkIn.firstName}!</h1>
            <p className="text-meta text-muted">
              It’s been a month since you first worshipped with us. We’d love to know how it’s been.
            </p>
          </header>
          <CheckInForm token={token} answered={checkIn.answered} />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="icon-tile tone-warning">
            <Icon name="link_off" size={22} />
          </span>
          <h1 className="of-h2">This link doesn’t work</h1>
          <p className="text-meta text-muted">Check it was copied in full from the SMS.</p>
        </div>
      )}
    </PublicFrame>
  );
}
