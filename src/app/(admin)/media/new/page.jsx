import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { isoDay, toServiceDate } from '@/lib/dates';
import { MEDIA_EDITORS } from '@/lib/roles';
import QuickPostForm from './QuickPostForm';

export const metadata = { title: 'Quick post' };
export const dynamic = 'force-dynamic';

/** /media/new?date=YYYY-MM-DD: add something to the media list that isn't a service. */
export default async function QuickPostPage({ searchParams }) {
  const [session, sp] = await Promise.all([getSession(), searchParams]);
  if (!MEDIA_EDITORS.includes(session?.user?.role)) redirect('/media');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date : isoDay(toServiceDate());
  return (
    <div className="flex max-w-3xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Media</p>
        <h1 className="of-h1">Quick post</h1>
        <p className="text-meta text-muted">
          For anything that isn’t a service: a change of plan, an event, a reminder. You get the
          text for WhatsApp, Facebook and Instagram to copy.
        </p>
      </header>
      <QuickPostForm initialDate={date} />
    </div>
  );
}
