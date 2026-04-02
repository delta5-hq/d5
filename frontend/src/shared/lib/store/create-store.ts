import type { Store, Listener } from './types'

function hasChanges<T extends object>(current: T, next: Partial<T>): boolean {
  const keys = Object.keys(next) as Array<keyof T>
  return keys.some(key => !Object.is(current[key], next[key]))
}

export function createStore<T extends object>(initialState: T): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  const getState = () => state

  const setState: Store<T>['setState'] = partial => {
    const next = typeof partial === 'function' ? partial(state) : partial

    if (!hasChanges(state, next)) return

    state = { ...state, ...next }
    listeners.forEach(listener => listener())
  }

  const subscribe = (listener: Listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const destroy = () => {
    listeners.clear()
  }

  return { getState, setState, subscribe, destroy }
}
