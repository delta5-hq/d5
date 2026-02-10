import type { RefObject } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'

type ResizeCallback = (entry: ResizeObserverEntry) => void

const callbacks = new WeakMap<Element, ResizeCallback>()
let observer: ResizeObserver | null = null

const getObserver = (): ResizeObserver => {
  if (!observer) {
    observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        callbacks.get(entry.target)?.(entry)
      }
    })
  }
  return observer
}

const observe = (element: Element, callback: ResizeCallback): void => {
  callbacks.set(element, callback)
  getObserver().observe(element)
}

const unobserve = (element: Element): void => {
  callbacks.delete(element)
  getObserver().unobserve(element)
}

export const useElementHeight = (defaultHeight: number): [RefObject<HTMLDivElement | null>, number] => {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(defaultHeight)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const updateHeight = () => {
      const measured = element.clientHeight
      if (measured > 0) setHeight(measured)
    }

    updateHeight()
    observe(element, updateHeight)
    return () => unobserve(element)
  }, [])

  return [ref, height]
}
