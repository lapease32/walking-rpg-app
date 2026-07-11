/* eslint-disable no-console -- this module is the single sanctioned wrapper around console.* */
import { getAppEnvironment } from '../constants/environment';
import CrashlyticsService from '../services/CrashlyticsService';

/**
 * Centralized app logger — the single place for diagnostic output, replacing scattered `console.*`.
 *
 * Behavior by level:
 * - `debug` / `log` / `info` — printed to console ONLY in non-production (development + testing);
 *   a no-op in a public release, so shipping builds stay quiet and don't pay the console cost.
 * - `warn` — printed in non-production AND forwarded to Crashlytics as a breadcrumb.
 * - `error` — printed in non-production AND recorded to Crashlytics (an Error in the args is
 *   preferred; otherwise the args become the message).
 *
 * Crashlytics forwarding is unconditional here because CrashlyticsService self-gates (it no-ops when
 * collection is disabled, e.g. in dev), so callers never need to branch on environment.
 *
 * NOTE: CrashlyticsService intentionally does NOT route through this logger — it's the forwarding
 * sink, so doing so would create an import cycle.
 */
const isProd = (): boolean => getAppEnvironment() === 'production';

const safeStringify = (value: unknown): string => {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const toMessage = (args: unknown[]): string =>
  args.map(a => (a instanceof Error ? a.message : safeStringify(a))).join(' ');

const firstError = (args: unknown[]): Error | undefined =>
  args.find((a): a is Error => a instanceof Error);

export const logger = {
  debug(...args: unknown[]): void {
    if (!isProd()) console.debug(...args);
  },
  log(...args: unknown[]): void {
    if (!isProd()) console.log(...args);
  },
  info(...args: unknown[]): void {
    if (!isProd()) console.info(...args);
  },
  warn(...args: unknown[]): void {
    if (!isProd()) console.warn(...args);
    CrashlyticsService.log(`WARN: ${toMessage(args)}`);
  },
  error(...args: unknown[]): void {
    if (!isProd()) console.error(...args);
    CrashlyticsService.recordError(firstError(args) ?? new Error(toMessage(args)));
  },
};

export default logger;
