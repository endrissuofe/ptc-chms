import Logo from '@/components/ui/Logo';
import OnefoldLogo from '@/components/brand/Onefold';
import { CHURCH } from '@/lib/church-profile';

/**
 * Public pages people open from a link (team sign-up, the check-in survey): the church's name
 * and logo on top, one panel, and a quiet Onefold line underneath.
 */
export default function PublicFrame({ children }) {
  return (
    <main className="flex min-h-screen flex-col px-4 py-8 font-ui sm:py-12">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 sm:justify-center">
        <Logo size={44} withName subtitle={CHURCH.fullName} />
        <div className="of-panel flex flex-col gap-5 p-5 sm:p-7">{children}</div>
        <p className="flex items-center gap-2 text-2xs font-semibold text-muted">
          Runs on
          <OnefoldLogo size={16} className="text-ink-2" />
        </p>
      </div>
    </main>
  );
}
