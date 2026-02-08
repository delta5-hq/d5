export type Listener = () => void
export type Unsubscribe = () => void
export type SetStateFn<T> = (partial: Partial<T> | ((prev: T) => Partial<T>)) => void

export interface Store<T> {
  getState: () => T
  setState: SetStateFn<T>
  subscribe: (listener: Listener) => Unsubscribe
  destroy: () => void
}
