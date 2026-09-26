import MobileHeader from '@/components/layout/MobileHeader';
import MobileTabs from '@/components/layout/MobileTabs';

export default function UsherLayout({ children }) {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      <MobileHeader subtitle="Ushering" />
      <main className="p-4">{children}</main>
      <MobileTabs />
    </div>
  );
}
