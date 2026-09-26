import { describe, it, expect } from 'vitest';
import { computeStage, STAGES } from '@/lib/stages';

const today = new Date('2026-09-27T12:00:00Z');
const d = (iso) => new Date(`${iso}T00:00:00Z`);

describe('computeStage', () => {
  it('treats one visit as a first timer', () => {
    expect(computeStage({ visitDates: [d('2026-09-27')], today })).toBe(STAGES.FIRST_TIMER);
  });

  it('treats two visits as a second timer', () => {
    expect(computeStage({ visitDates: [d('2026-09-06'), d('2026-09-27')], today })).toBe(
      STAGES.SECOND_TIMER,
    );
  });

  it('treats three visits within six weeks as a regular', () => {
    const visits = ['2026-09-13', '2026-09-20', '2026-09-27'].map(d);
    expect(computeStage({ visitDates: visits, today })).toBe(STAGES.REGULAR);
  });

  it('does not count old visits towards regular', () => {
    const visits = ['2026-05-03', '2026-05-10', '2026-09-27'].map(d);
    expect(computeStage({ visitDates: visits, today })).toBe(STAGES.SECOND_TIMER);
  });

  it('marks someone lost after six weeks away', () => {
    expect(computeStage({ visitDates: [d('2026-08-02')], today })).toBe(STAGES.LOST);
  });

  it("lets the pastor's milestones win", () => {
    expect(computeStage({ visitDates: [d('2026-09-27')], inBelieversClass: true, today })).toBe(
      STAGES.BELIEVERS_CLASS,
    );
    expect(computeStage({ visitDates: [d('2026-08-02')], isMember: true, today })).toBe(
      STAGES.MEMBER,
    );
  });
});
