jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    BatteryOptimization: {
      isIgnoringBatteryOptimizations: jest.fn(),
      requestExemption: jest.fn(),
    },
  },
}));
jest.mock('../../utils/storage', () => ({
  hasBatteryPromptBeenShown: jest.fn(),
  setBatteryPromptShown: jest.fn(),
}));

import { NativeModules, Platform } from 'react-native';
import { hasBatteryPromptBeenShown, setBatteryPromptShown } from '../../utils/storage';
import BatteryOptimizationService, {
  shouldPromptForExemption,
} from '../../services/BatteryOptimizationService';

const native = NativeModules.BatteryOptimization as {
  isIgnoringBatteryOptimizations: jest.Mock;
  requestExemption: jest.Mock;
};
const mockHasShown = hasBatteryPromptBeenShown as jest.Mock;
const mockSetShown = setBatteryPromptShown as jest.Mock;

describe('shouldPromptForExemption (pure gating)', () => {
  it('prompts only on Android, when not exempt, and not yet asked', () => {
    expect(
      shouldPromptForExemption({ isAndroid: true, isIgnoring: false, alreadyAsked: false }),
    ).toBe(true);
  });

  it('never prompts on iOS', () => {
    expect(
      shouldPromptForExemption({ isAndroid: false, isIgnoring: false, alreadyAsked: false }),
    ).toBe(false);
  });

  it('does not prompt when already exempt', () => {
    expect(
      shouldPromptForExemption({ isAndroid: true, isIgnoring: true, alreadyAsked: false }),
    ).toBe(false);
  });

  it('does not prompt when already asked once (no re-nag)', () => {
    expect(
      shouldPromptForExemption({ isAndroid: true, isIgnoring: false, alreadyAsked: true }),
    ).toBe(false);
  });
});

describe('BatteryOptimizationService.maybeRequestExemption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'android';
  });

  it('shows the dialog and records it when not exempt and not yet asked', async () => {
    mockHasShown.mockResolvedValue(false);
    native.isIgnoringBatteryOptimizations.mockResolvedValue(false);
    native.requestExemption.mockResolvedValue(true);

    await BatteryOptimizationService.maybeRequestExemption();

    expect(native.requestExemption).toHaveBeenCalledTimes(1);
    expect(mockSetShown).toHaveBeenCalledTimes(1);
  });

  it('does not prompt again once it has been shown', async () => {
    mockHasShown.mockResolvedValue(true);
    native.isIgnoringBatteryOptimizations.mockResolvedValue(false);

    await BatteryOptimizationService.maybeRequestExemption();

    expect(native.requestExemption).not.toHaveBeenCalled();
    expect(mockSetShown).not.toHaveBeenCalled();
  });

  it('does not prompt when the app is already exempt', async () => {
    mockHasShown.mockResolvedValue(false);
    native.isIgnoringBatteryOptimizations.mockResolvedValue(true);

    await BatteryOptimizationService.maybeRequestExemption();

    expect(native.requestExemption).not.toHaveBeenCalled();
    expect(mockSetShown).not.toHaveBeenCalled();
  });

  it('is a no-op on iOS', async () => {
    (Platform as { OS: string }).OS = 'ios';

    await BatteryOptimizationService.maybeRequestExemption();

    expect(native.requestExemption).not.toHaveBeenCalled();
    expect(native.isIgnoringBatteryOptimizations).not.toHaveBeenCalled();
  });

  it('does not record the prompt if launching the dialog fails (preserves the one ask)', async () => {
    mockHasShown.mockResolvedValue(false);
    native.isIgnoringBatteryOptimizations.mockResolvedValue(false);
    native.requestExemption.mockRejectedValue(new Error('no activity'));

    await BatteryOptimizationService.maybeRequestExemption();

    expect(mockSetShown).not.toHaveBeenCalled();
  });

  it('does not record the prompt when the native side reports already-exempt (no dialog shown)', async () => {
    mockHasShown.mockResolvedValue(false);
    native.isIgnoringBatteryOptimizations.mockResolvedValue(false);
    native.requestExemption.mockResolvedValue(false); // native: already exempt → no dialog launched

    await BatteryOptimizationService.maybeRequestExemption();

    expect(mockSetShown).not.toHaveBeenCalled();
  });

  it('guards against overlapping calls launching the dialog more than once', async () => {
    mockHasShown.mockResolvedValue(false);
    native.isIgnoringBatteryOptimizations.mockResolvedValue(false);
    let resolveRequest: (launched: boolean) => void = () => {};
    native.requestExemption.mockReturnValue(
      new Promise<boolean>(resolve => {
        resolveRequest = resolve;
      }),
    );

    // Fire two overlapping calls before the first resolves; the in-flight guard should let only
    // one through to the native dialog.
    const first = BatteryOptimizationService.maybeRequestExemption();
    const second = BatteryOptimizationService.maybeRequestExemption();
    resolveRequest(true);
    await Promise.all([first, second]);

    expect(native.requestExemption).toHaveBeenCalledTimes(1);
    expect(mockSetShown).toHaveBeenCalledTimes(1);
  });
});
