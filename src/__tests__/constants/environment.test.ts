import { getAppEnvironment } from '../../constants/environment';

// getAppEnvironment reads __DEV__ and process.env.APP_ENV at call time. In jest
// the babel inline-env plugin is NOT applied (it's scoped to the production babel
// env in babel.config.js), so process.env.APP_ENV is a real runtime lookup we can
// vary per case. Access both through globalThis to avoid depending on Node global
// type declarations in this file.
const g = globalThis as unknown as {
  __DEV__: boolean;
  process: { env: Record<string, string | undefined> };
};

describe('getAppEnvironment', () => {
  const realDev = g.__DEV__;
  const realAppEnv = g.process.env.APP_ENV;

  afterEach(() => {
    g.__DEV__ = realDev;
    if (realAppEnv === undefined) {
      delete g.process.env.APP_ENV;
    } else {
      g.process.env.APP_ENV = realAppEnv;
    }
  });

  it('returns development whenever __DEV__ is true, ignoring APP_ENV', () => {
    g.__DEV__ = true;
    g.process.env.APP_ENV = 'production';
    expect(getAppEnvironment()).toBe('development');
  });

  it('returns testing for a release build that opted in via APP_ENV=testing', () => {
    g.__DEV__ = false;
    g.process.env.APP_ENV = 'testing';
    expect(getAppEnvironment()).toBe('testing');
  });

  it('FAIL-SAFE: returns production for a release build with APP_ENV unset', () => {
    g.__DEV__ = false;
    delete g.process.env.APP_ENV;
    expect(getAppEnvironment()).toBe('production');
  });

  it('returns production for a release build with APP_ENV=production', () => {
    g.__DEV__ = false;
    g.process.env.APP_ENV = 'production';
    expect(getAppEnvironment()).toBe('production');
  });

  it('FAIL-SAFE: returns production for any unrecognized APP_ENV value', () => {
    g.__DEV__ = false;
    g.process.env.APP_ENV = 'staging-typo';
    expect(getAppEnvironment()).toBe('production');
  });
});
