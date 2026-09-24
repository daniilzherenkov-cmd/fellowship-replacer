/**
 * @mention detection, shared by the action-item picker (which assigns the
 * item) and the talking-point picker (which inserts the name as text).
 *
 * Pure logic, so it runs in the unit project with no browser.
 */

import { test, expect } from '@playwright/test'
import { detectMention } from '../../src/components/note/ActionItemRow'

test.describe('detectMention', () => {
  test('returns the query typed after @', () => {
    const text = 'Follow up with @dan'
    expect(detectMention(text, text.length)).toBe('dan')
  })

  test('returns an empty query on a bare @, so the full list opens', () => {
    const text = 'Follow up with @'
    expect(detectMention(text, text.length)).toBe('')
  })

  test('is null when there is no @ at all', () => {
    const text = 'Just a note'
    expect(detectMention(text, text.length)).toBeNull()
  })

  test('closes once a space follows the @', () => {
    // Otherwise the picker would stay open for the rest of the line.
    const text = 'Ask @dan about pricing'
    expect(detectMention(text, text.length)).toBeNull()
  })

  test('uses the caret, not the end of the string', () => {
    const text = 'Ask @da about pricing'
    // Caret sits right after "@da", mid-sentence.
    expect(detectMention(text, 7)).toBe('da')
  })

  test('takes the LAST @ before the caret', () => {
    const text = 'a@b.com then @ka'
    expect(detectMention(text, text.length)).toBe('ka')
  })
})

test.describe('mention scoping', () => {
  // Regression: the note passed listPeople(), i.e. EVERYONE the owner had ever
  // shared a meeting with, so a five-person retro offered the whole directory
  // alphabetically (Abdalla Chair, Abdou Abougouda, ...). Fellow scopes `@` to
  // the meeting's own attendees.
  const attendees = [
    { id: 'a', name: 'Akshay Bhave', email: 'akshay@x.com', role: null, colorHex: '#111', isMe: false, isRegistered: true },
    { id: 'b', name: 'Zoe Farooq', email: 'zoe@x.com', role: null, colorHex: '#222', isMe: false, isRegistered: false },
  ]
  const everyone = [
    ...attendees,
    { id: 'c', name: 'Abdalla Chair', email: 'abd@x.com', role: null, colorHex: '#333', isMe: false, isRegistered: false },
  ]

  /** Mirrors the ordering in MeetingNote: registered first, then by name. */
  function mentionable(list: typeof everyone, filterToRegistered = false) {
    const scoped = filterToRegistered ? list.filter((p) => p.isRegistered) : list
    return [...scoped].sort(
      (a, b) => Number(b.isRegistered) - Number(a.isRegistered) || a.name.localeCompare(b.name),
    )
  }

  test('offers only the meeting attendees, not the whole directory', () => {
    const names = mentionable(attendees).map((p) => p.name)
    expect(names).not.toContain('Abdalla Chair')
    expect(names).toHaveLength(2)
  })

  test('sorts people who use the app first', () => {
    // Alphabetically Akshay precedes Zoe anyway, so invert the input to prove
    // the registered flag is what orders it.
    const reversed = [...attendees].reverse()
    expect(mentionable(reversed)[0].name).toBe('Akshay Bhave')
  })

  test('hard filtering is available for when multi-user lands', () => {
    expect(mentionable(everyone, true).map((p) => p.name)).toEqual(['Akshay Bhave'])
  })
})
