import { describe, expect, it } from 'vitest';
import {
  buildReplayPayload,
  hashReplaySummary,
  parseReplayPayload,
  runReplay,
  summarizeReplayState,
  verifyReplayDeterminism,
} from './replay';

describe('replay tooling', () => {
  it('replays the same payload to the same summarized state', () => {
    const payload = buildReplayPayload(20260222, 'calm_markets', [
      ['buy_sovereign_bonds'],
      ['buy_equities'],
      ['buy_gold', 'reduce_leverage'],
      [],
      ['raise_leverage'],
    ]);
    const serialized = JSON.stringify(payload);
    const parsed = parseReplayPayload(serialized);

    const verification = verifyReplayDeterminism(parsed);
    const replayedState = runReplay(parsed);
    const replayedSummary = summarizeReplayState(replayedState);

    expect(verification.deterministic).toBe(true);
    expect(replayedSummary).toEqual(verification.summary);
    expect(hashReplaySummary(replayedSummary)).toBe(verification.hash);
  });
});
