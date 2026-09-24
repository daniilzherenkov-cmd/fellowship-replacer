/**
 * Filter rules for the unified action list.
 *
 * Separate from ActionsList.tsx for the same reason sync-messages.ts is
 * separate from SyncButton.tsx: that file is a client component importing
 * next/navigation, which a plain Node test process cannot resolve. Pure logic
 * lives here so it can be unit tested without a browser or a bundler.
 */

import type { ActionItem } from '@/lib/queries'

/**
 * Fellow splits the list into what YOU owe and what you are waiting on from
 * someone else. With a second real user on the app this stopped being
 * theoretical.
 *
 * 'mine' means assigned to me OR unassigned: an item you wrote and never
 * assigned is still yours, and dropping those would hide work.
 */
export type OwnerTab = 'mine' | 'others'

export interface ActionFilters {
  tab: OwnerTab
  text: string
  personId: string
  /** A meeting id, '' for any, or '__none__' for standalone items. */
  meetingId: string
  showDone: boolean
}

export const NO_MEETING = '__none__'

export const EMPTY_FILTERS: ActionFilters = {
  tab: 'mine',
  text: '',
  personId: '',
  meetingId: '',
  showDone: false,
}

/**
 * Narrow the list before grouping. This is the one screen where a wrong
 * filter silently hides work, so each rule is asserted on its own in
 * actions-filter.spec.ts.
 */
export function applyFilters(items: ActionItem[], f: ActionFilters): ActionItem[] {
  const needle = f.text.trim().toLowerCase()
  return items.filter((i) => {
    const mine = !i.assignee || i.assignee.isMe
    if (f.tab === 'mine' && !mine) return false
    if (f.tab === 'others' && mine) return false
    if (!f.showDone && i.isDone) return false
    if (needle && !i.text.toLowerCase().includes(needle)) return false
    if (f.personId && i.assignee?.id !== f.personId) return false
    if (f.meetingId === NO_MEETING) {
      if (i.meetingId) return false
    } else if (f.meetingId && i.meetingId !== f.meetingId) {
      return false
    }
    return true
  })
}

/** The tab is not a "filter" for the Clear button; it is always one or the other. */
export function isFiltering(f: ActionFilters): boolean {
  return Boolean(f.text || f.personId || f.meetingId || f.showDone)
}
