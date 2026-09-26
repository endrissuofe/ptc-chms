import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/" className="font-semibold text-primary">
        Go to your home screen
      </Link>
    </main>
  );
}
