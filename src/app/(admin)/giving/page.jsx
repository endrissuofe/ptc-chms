import ComingSoon from '@/components/ui/ComingSoon';

export const metadata = { title: 'Giving' };

/** Giving: not built yet (coming soon). */
export default function GivingPage() {
  return (
    <ComingSoon
      icon="account_balance_wallet"
      title="Giving"
      line="Tithes and offerings: record them and see the totals."
    />
  );
}
