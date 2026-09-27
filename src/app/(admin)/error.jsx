'use client';

import ErrorScreen from '@/components/ui/ErrorScreen';

export default function Error({ error, reset }) {
  return <ErrorScreen error={error} reset={reset} />;
}
