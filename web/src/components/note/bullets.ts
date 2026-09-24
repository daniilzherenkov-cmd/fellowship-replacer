/**
 * Bullet-list behaviour for the notepad.
 *
 * WHY NOT A RICH TEXT LIBRARY: the notepad column is `mediumtext` holding
 * plain text, and every note written so far is in it. Adopting ProseMirror or
 * Lexical means a new storage format (HTML or JSON), a migration of existing
 * notes, and 100KB+ of JavaScript in an image we deliberately keep small.
 *
 * What Fellow's notepad actually gives you day to day is bullets that
 * continue, indent and clear themselves. That is achievable on a plain
 * textarea with no dependency and no migration, and it keeps every note
 * readable as plain text in an export or a database row.
 *
 * Bold and italic are NOT included. If they turn out to matter, that is the
 * point to take the editor decision properly rather than half-implementing
 * markdown here.
 */

export const BULLET = '•'
const INDENT = '  '

/** The leading indent and bullet of a line, if it has one. */
function parseLine(line: string): { indent: string; hasBullet: boolean; body: string } {
  const m = /^(\s*)(•\s?)?(.*)$/.exec(line)
  return { indent: m?.[1] ?? '', hasBullet: Boolean(m?.[2]), body: m?.[3] ?? '' }
}

export interface EditResult {
  value: string
  /** Where to put the caret afterwards. */
  caret: number
}

/**
 * Enter: continue the list.
 *
 * On an empty bullet, Enter OUTDENTS one level, and clears the bullet at the
 * top level. That is how every list editor behaves and it is the only way to
 * leave a list without reaching for the mouse.
 */
export function onEnter(value: string, caret: number): EditResult | null {
  const before = value.slice(0, caret)
  const after = value.slice(caret)
  const lineStart = before.lastIndexOf('\n') + 1
  const line = before.slice(lineStart)
  const { indent, hasBullet, body } = parseLine(line)

  if (!hasBullet) return null

  if (body.trim() === '') {
    // Empty bullet: step out rather than adding another one.
    const next = indent.length >= INDENT.length ? `${indent.slice(INDENT.length)}${BULLET} ` : ''
    const value2 = value.slice(0, lineStart) + next + after
    return { value: value2, caret: lineStart + next.length }
  }

  const insert = `\n${indent}${BULLET} `
  return { value: before + insert + after, caret: caret + insert.length }
}

/** Tab / Shift-Tab: indent or outdent the current line. */
export function onTab(value: string, caret: number, back: boolean): EditResult | null {
  const before = value.slice(0, caret)
  const lineStart = before.lastIndexOf('\n') + 1
  const lineEnd = value.indexOf('\n', caret)
  const end = lineEnd === -1 ? value.length : lineEnd
  const line = value.slice(lineStart, end)
  const { indent, hasBullet } = parseLine(line)
  if (!hasBullet) return null

  if (back) {
    if (indent.length < INDENT.length) return null
    const next = line.slice(INDENT.length)
    return {
      value: value.slice(0, lineStart) + next + value.slice(end),
      caret: Math.max(lineStart, caret - INDENT.length),
    }
  }

  return {
    value: value.slice(0, lineStart) + INDENT + line + value.slice(end),
    caret: caret + INDENT.length,
  }
}

/** Typing into an empty notepad starts a bullet, as Fellow's does. */
export function seedBullet(value: string): string {
  return value.trim() === '' ? `${BULLET} ` : value
}
