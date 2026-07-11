// CrashlyticsService is globally stubbed via jest.config moduleNameMapper.
jest.mock('../../constants/environment', () => ({ getAppEnvironment: jest.fn() }));

import { getAppEnvironment } from '../../constants/environment';
import CrashlyticsService from '../../services/CrashlyticsService';
import logger from '../../utils/logger';

const env = getAppEnvironment as jest.Mock;
const crash = CrashlyticsService as unknown as { log: jest.Mock; recordError: jest.Mock };

describe('logger', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('prints log in non-production', () => {
    env.mockReturnValue('development');
    logger.log('hi');
    expect(logSpy).toHaveBeenCalledWith('hi');
  });

  it('suppresses log in production', () => {
    env.mockReturnValue('production');
    logger.log('hi');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('keeps warn/error off the console in production', () => {
    env.mockReturnValue('production');
    logger.warn('careful');
    logger.error('boom');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('forwards warn to Crashlytics as a breadcrumb, even in production', () => {
    env.mockReturnValue('production');
    logger.warn('careful now');
    expect(crash.log).toHaveBeenCalledWith(expect.stringContaining('careful now'));
  });

  it('records an error to Crashlytics, preferring an Error argument', () => {
    env.mockReturnValue('production');
    const e = new Error('kaboom');
    logger.error('context', e);
    expect(crash.recordError).toHaveBeenCalledWith(e);
  });

  it('wraps non-Error args in an Error for recordError', () => {
    env.mockReturnValue('development');
    logger.error('just a string');
    const arg = crash.recordError.mock.calls[0][0] as Error;
    expect(arg).toBeInstanceOf(Error);
    expect(arg.message).toContain('just a string');
  });
});
