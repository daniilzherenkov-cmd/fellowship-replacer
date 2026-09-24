/**
 * SQL dialect guard.
 *
 * WHY THIS EXISTS: dev runs SQLite and production runs MySQL, so a statement
 * that is valid in SQLite alone passes every test and then throws in the pod.
 * That is exactly how `meeting_id IS ?` shipped: MySQL accepts IS only with
 * NULL / TRUE / FALSE / UNKNOWN, never a bound parameter, and creating an
 * action item was broken in production while 128 tests stayed green.
 *
 * This is a static scan, not a database test, so it costs nothing and runs
 * even when no MySQL is available. It cannot catch everything, only the
 * known-dangerous shapes. Add to it whenever a new dialect trap is found.
 */

import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LIB = join(process.cwd(), 'src', 'lib')

/** Every .ts under src/lib, which is where all SQL lives. */
function sqlSources(): { file: string; text: string }[] {
  return readdirSync(LIB)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: readFileSync(join(LIB, f), 'utf8') }))
}

const TRAPS: { name: string; pattern: RegExp; why: string }[] = [
  {
    name: 'IS with a bound parameter',
    pattern: /\bIS\s+\?/i,
    why: 'MySQL allows IS only with NULL/TRUE/FALSE/UNKNOWN. Branch on the value instead.',
  },
  {
    name: 'SQLite double-quoted string literal',
    pattern: /=\s*"[^"]*"\s*(?:AND|OR|ORDER|LIMIT|\)|$)/i,
    why: 'MySQL reads double quotes as an identifier unless ANSI_QUOTES is set. Use single quotes.',
  },
  {
    name: 'INSERT OR REPLACE / INSERT OR IGNORE',
    pattern: /INSERT\s+OR\s+(REPLACE|IGNORE)/i,
    why: 'SQLite-only. MySQL uses INSERT ... ON DUPLICATE KEY UPDATE.',
  },
  {
    name: 'AUTOINCREMENT',
    pattern: /\bAUTOINCREMENT\b/i,
    why: 'SQLite spelling. MySQL uses AUTO_INCREMENT.',
  },
  {
    name: 'strftime()',
    pattern: /\bstrftime\s*\(/i,
    why: 'SQLite-only date function. Use DATE_FORMAT or compute in JS.',
  },
  {
    name: 'group_concat with SEPARATOR-less SQLite syntax',
    pattern: /group_concat\s*\([^)]*,\s*'[^']*'\s*\)/i,
    why: "MySQL needs GROUP_CONCAT(x SEPARATOR ','), not a second argument.",
  },
]

test.describe('SQL dialect', () => {
  for (const trap of TRAPS) {
    test(`no ${trap.name}`, () => {
      const hits: string[] = []
      for (const { file, text } of sqlSources()) {
        text.split('\n').forEach((line, i) => {
          // Only look at lines that plausibly contain SQL, so prose in a
          // comment explaining the trap does not trip the guard.
          if (!/SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|VALUES/i.test(line)) return
          if (trap.pattern.test(line)) hits.push(`${file}:${i + 1}  ${line.trim()}`)
        })
      }
      expect(hits, `${trap.why}\n\n${hits.join('\n')}`).toEqual([])
    })
  }
})
