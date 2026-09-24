/**
 * Bullet behaviour in the notepad. Pure string logic, no browser.
 */

import { test, expect } from '@playwright/test'
import { onEnter, onTab, seedBullet, BULLET } from '../../src/components/note/bullets'

test.describe('Enter continues a list', () => {
  test('adds a bullet on the next line', () => {
    const v = `${BULLET} first`
    const r = onEnter(v, v.length)
    expect(r?.value).toBe(`${BULLET} first\n${BULLET} `)
    expect(r?.caret).toBe(r?.value.length)
  })

  test('keeps the indent level', () => {
    const v = `  ${BULLET} nested`
    expect(onEnter(v, v.length)?.value).toBe(`  ${BULLET} nested\n  ${BULLET} `)
  })

  test('an empty nested bullet steps out one level', () => {
    // Otherwise you can never leave a nested list from the keyboard.
    const v = `${BULLET} a\n  ${BULLET} `
    expect(onEnter(v, v.length)?.value).toBe(`${BULLET} a\n${BULLET} `)
  })

  test('an empty top-level bullet clears itself', () => {
    const v = `${BULLET} a\n${BULLET} `
    expect(onEnter(v, v.length)?.value).toBe(`${BULLET} a\n`)
  })

  test('does nothing on a line with no bullet', () => {
    // Plain prose must keep normal Enter behaviour.
    expect(onEnter('just a sentence', 15)).toBeNull()
  })

  test('splits correctly mid-line', () => {
    // The bullet plus its space is TWO characters, so caret 4 sits after
    // "he". Getting this wrong is how a split lands in the wrong place.
    const v = `${BULLET} hello world`
    const r = onEnter(v, 4)
    expect(r?.value).toBe(`${BULLET} he\n${BULLET} llo world`)
    expect(r?.caret).toBe(7)
  })
})

test.describe('Tab indents', () => {
  test('indents a bullet', () => {
    const v = `${BULLET} a`
    expect(onTab(v, v.length, false)?.value).toBe(`  ${BULLET} a`)
  })

  test('outdents a nested bullet', () => {
    const v = `  ${BULLET} a`
    expect(onTab(v, v.length, true)?.value).toBe(`${BULLET} a`)
  })

  test('refuses to outdent past the left margin', () => {
    expect(onTab(`${BULLET} a`, 3, true)).toBeNull()
  })

  test('leaves non-bullet lines to the browser', () => {
    // Tab should still move focus out of a plain textarea.
    expect(onTab('prose', 5, false)).toBeNull()
  })
})

test.describe('seedBullet', () => {
  test('starts an empty notepad with a bullet', () => {
    expect(seedBullet('')).toBe(`${BULLET} `)
    expect(seedBullet('   ')).toBe(`${BULLET} `)
  })

  test('leaves existing content alone', () => {
    expect(seedBullet('already here')).toBe('already here')
  })
})
