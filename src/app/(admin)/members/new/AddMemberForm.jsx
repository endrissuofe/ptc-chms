'use client';

import { useState } from 'react';
import FormAlert from '@/components/ui/FormAlert';
import { MemberForm } from '../MemberList';

/** The member form on its own: after each save it clears, ready for the next person. */
export default function AddMemberForm() {
  const [added, setAdded] = useState([]);
  // A new key gives a fresh, empty form.
  const [round, setRound] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      {added.length > 0 && (
        <FormAlert
          success={`${added[0]} added.${
            added.length > 1 ? ` ${added.length} people added so far.` : ''
          }`}
        />
      )}
      <section className="of-panel p-5 sm:p-6">
        <MemberForm
          key={round}
          onCancel={() => setRound((r) => r + 1)}
          onSaved={(m) => {
            setAdded((list) => [`${m.firstName} ${m.lastName}`.trim(), ...list]);
            setRound((r) => r + 1);
          }}
        />
      </section>
    </div>
  );
}
