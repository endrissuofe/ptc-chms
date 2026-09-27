import EmptyState from '@/components/ui/EmptyState';

export default function PersonNotFound() {
  return (
    <EmptyState
      card
      icon="person_search"
      tone="tone-warning"
      title="This person isn’t in the records"
      action={{ href: '/my-newcomers', label: 'Back to follow-up', icon: 'arrow_back' }}
    >
      They may have been removed, or the link is wrong.
    </EmptyState>
  );
}
