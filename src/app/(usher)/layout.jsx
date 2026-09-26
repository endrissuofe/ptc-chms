import MobileHeader from '@/components/layout/MobileHeader';
import MobileTabs from '@/components/layout/MobileTabs';
import { getSession } from '@/lib/auth';

export default async function UsherLayout({ children }) {
  const session = await getSession();
  const name = session?.user?.name;
  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      <MobileHeader subtitle={name ? `${name} • Ushering` : 'Ushering'} />
      <main className="p-4">{children}</main>
      <MobileTabs />
    </div>
  );
}
