import ScreenPlaceholder from '@/components/ui/ScreenPlaceholder';

export const metadata = { title: 'Newcomer profile' };

export default async function NewcomerProfilePage({ params }) {
  const { id } = await params;
  return (
    <ScreenPlaceholder title="Newcomer profile" design="follow_up_newcomer_profile">
      <p className="mt-2 text-xs text-muted">Record: {id}</p>
    </ScreenPlaceholder>
  );
}
