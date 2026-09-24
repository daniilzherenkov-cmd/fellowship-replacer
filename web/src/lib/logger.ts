/**
 * Structured logging.
 *
 * The platform ships stdout to Grafana Loki as JSON-per-line, labelled
 * `dh_component == <app_id>`. A line that is not JSON still arrives, but as
 * an opaque string: you cannot filter or graph it. So every log line the app
 * emits should be an object, and anything you might want to chart should be
 * a top-level numeric field rather than interpolated into the message.
 *
 * Deliberately no winston or pino. The platform wants one JSON object per
 * line on stdout and nothing else; a logging framework would add weight and
 * a second opinion about formatting for no gain.
 */

type Level = 'info' | 'warn' | 'error'

export function log(level: Level, msg: string, extra?: Record<string, unknown>): void {
  const line = JSON.stringify({ level, msg, ...extra })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

export const logInfo = (msg: string, extra?: Record<string, unknown>) => log('info', msg, extra)
export const logWarn = (msg: string, extra?: Record<string, unknown>) => log('warn', msg, extra)
export const logError = (msg: string, extra?: Record<string, unknown>) => log('error', msg, extra)
