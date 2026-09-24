'use client'

/**
 * Drag-to-reorder for the note's row lists.
 *
 * Native HTML5 drag and drop rather than a library: the lists are short, the
 * rows are plain divs, and pulling in a DnD dependency for two lists is not
 * worth the bundle in an app that already watches its image size.
 *
 * Keyboard reordering is handled separately by the row's own menu, because a
 * drag target is unreachable by keyboard and screen reader.
 */

import { useCallback, useRef, useState } from 'react'

export interface RowDrag {
  /** Index currently being dragged, or null. */
  draggingIndex: number | null
  /** Index the row would land at, for the drop indicator. */
  overIndex: number | null
  handlers: (index: number) => {
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
  }
}

/** Move one element, returning a new array. Exported for testing. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list
  }
  const copy = [...list]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

export function useRowDrag(onReorder: (from: number, to: number) => void): RowDrag {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  // Read during drop; state would be stale inside the native event.
  const fromRef = useRef<number | null>(null)

  const handlers = useCallback(
    (index: number) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        fromRef.current = index
        setDraggingIndex(index)
        e.dataTransfer.effectAllowed = 'move'
        // Firefox refuses to start a drag without payload.
        e.dataTransfer.setData('text/plain', String(index))
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (overIndex !== index) setOverIndex(index)
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        const from = fromRef.current
        fromRef.current = null
        setDraggingIndex(null)
        setOverIndex(null)
        if (from === null || from === index) return
        onReorder(from, index)
      },
      onDragEnd: () => {
        fromRef.current = null
        setDraggingIndex(null)
        setOverIndex(null)
      },
    }),
    [onReorder, overIndex],
  )

  return { draggingIndex, overIndex, handlers }
}
