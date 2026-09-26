import ComingSoon from '@/components/ui/ComingSoon';

export const metadata = { title: 'My newcomers' };

export default function MyNewcomersPage() {
  return (
    <ComingSoon
      title="My newcomers"
      description="The newcomers assigned to you, with call and WhatsApp buttons and who still needs a call."
    />
  );
}
