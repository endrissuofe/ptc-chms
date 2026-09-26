import Sidebar from '@/components/layout/Sidebar';

export default function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-line bg-surface px-8">
          <span className="whitespace-nowrap font-serif text-lg font-semibold">
            RCCG Peculiar Treasure Chapel
          </span>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
