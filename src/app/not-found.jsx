import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Logo from '@/components/ui/Logo';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card flex max-w-md flex-col items-center gap-4 text-center">
        <Logo size={48} />
        <span className="chip chip-coral">404</span>
        <h1 className="page-title">Page not found</h1>
        <p className="text-muted">That page doesn’t exist or has moved.</p>
        <Link href="/" className="btn btn-primary">
          <Icon name="home" size={18} />
          Go to your home screen
        </Link>
      </div>
    </main>
  );
}
