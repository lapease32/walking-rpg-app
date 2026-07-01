// Focused test for usePlayer.debugTriggerArchetypeSelection — the debug reset that had two
// bugbot-caught data-safety bugs. The critical invariant: it must CLEAR LOCAL STORAGE (so the
// reconcile that runs when the user re-picks sees empty local → adopts the cloud save instead of
// overwriting it), and it must only re-enter archetype selection if that clear succeeded.
jest.mock('../../utils/storage', () => ({
  savePlayerData: jest.fn().mockResolvedValue(true),
  readLocalPlayerSnapshot: jest.fn().mockResolvedValue({ data: null, savedAt: 0 }),
  reconcileCloudPlayerData: jest.fn().mockResolvedValue({ status: 'noNewerCloud' }),
  writeLocalPlayerSnapshot: jest.fn().mockResolvedValue(undefined),
  clearLocalPlayerData: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/AnalyticsService', () => ({
  __esModule: true,
  default: { playerSessionStart: jest.fn() },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { usePlayer } from '../../hooks/usePlayer';
import { clearLocalPlayerData } from '../../utils/storage';

const mockClearLocal = clearLocalPlayerData as jest.Mock;

type PlayerHook = ReturnType<typeof usePlayer>;

function renderUsePlayer(): { current: PlayerHook } {
  const ref: { current: PlayerHook | null } = { current: null };
  function Probe(): null {
    ref.current = usePlayer();
    return null;
  }
  act(() => {
    TestRenderer.create(React.createElement(Probe));
  });
  return ref as { current: PlayerHook };
}

describe('usePlayer.debugTriggerArchetypeSelection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears local storage and re-shows archetype selection', async () => {
    const hook = renderUsePlayer();
    expect(hook.current.needsArchetypeSelection).toBe(false);

    await act(async () => {
      await hook.current.debugTriggerArchetypeSelection();
    });

    // Clearing local is the fix that makes reconcile ADOPT (not overwrite) the cloud save.
    expect(mockClearLocal).toHaveBeenCalledTimes(1);
    expect(hook.current.needsArchetypeSelection).toBe(true);
  });

  it('aborts (does not re-show selection) if clearing local storage fails', async () => {
    mockClearLocal.mockRejectedValueOnce(new Error('storage error'));
    const hook = renderUsePlayer();
    expect(hook.current.needsArchetypeSelection).toBe(false);

    await act(async () => {
      await hook.current.debugTriggerArchetypeSelection();
    });

    // If the clear failed, re-entering selection would leave the unsafe stale-local state that
    // lets handleArchetypeSelected overwrite the cloud — so it must NOT proceed.
    expect(mockClearLocal).toHaveBeenCalledTimes(1);
    expect(hook.current.needsArchetypeSelection).toBe(false);
  });
});
