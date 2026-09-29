import { getSession } from '@/lib/auth';
import { CHURCH } from '@/lib/church-profile';
import { MEDIA_EDITORS } from '@/lib/roles';
import { getBrandKit } from '@/services/media.service';
import BrandKitForm from './BrandKitForm';

export const metadata = { title: 'Brand kit' };
export const dynamic = 'force-dynamic';

/** Where the church is online and how its posts end. Media team and admins edit; pastors see it. */
export default async function BrandKitPage() {
  const [session, brand] = await Promise.all([getSession(), getBrandKit()]);
  return (
    <div className="flex max-w-3xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Media</p>
        <h1 className="of-h1">Brand kit</h1>
        <p className="text-meta text-muted">
          Added to the ready-made posts for {CHURCH.name}, so every post says the same thing.
        </p>
      </header>
      <BrandKitForm
        initial={{
          ...brand,
          instagram: brand.instagram ? `@${brand.instagram}` : '',
          hashtags: brand.hashtags.map((t) => `#${t}`).join(' '),
        }}
        readOnly={!MEDIA_EDITORS.includes(session?.user?.role)}
        churchName={CHURCH.name}
      />
    </div>
  );
}
