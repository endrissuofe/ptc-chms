import Logo from '@/components/ui/Logo';

export default function MobileHeader({ subtitle }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-line bg-paper/95 px-4 backdrop-blur">
      <Logo size={40} withName subtitle={subtitle} />
    </header>
  );
}
