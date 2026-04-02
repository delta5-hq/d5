import { useSyncExternalStore } from 'react'
import type { Store } from './types'

type EqualityFn<T> = (a: T, b: T) => boolean

const defaultEquals = Object.is

export function useSelector<State extends object, Selected>(
  store: Store<State>,
  selector: (state: State) => Selected,
  equalityFn: EqualityFn<Selected> = defaultEquals,
): Selected {
  let prevSelected = selector(store.getState())

  const getSnapshot = () => {
    const nextSelected = selector(store.getState())
    if (equalityFn(prevSelected, nextSelected)) return prevSelected
    prevSelected = nextSelected
    return nextSelected
  }

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
