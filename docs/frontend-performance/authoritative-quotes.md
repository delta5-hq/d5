# Authoritative Quotes on React State Management & Performance

## React Context — Not for Frequent State Updates

**Sebastian Markbage** (React core team architect):
> "New context is ready for low frequency unlikely updates (like locale/theme). It's not ready to be used as a replacement for all Flux-like state propagation."

Source: https://github.com/facebook/react/issues/14110#issuecomment-448074060

---

**Mark Erikson** (Redux maintainer):
> "When useReducer produces a new state value, all components that are subscribed to that context will be forced to re-render, even if they only care about part of the data."

> "If you get past 2-3 state-related contexts, you're reinventing a weaker version of React-Redux."

Source: https://blog.isquaredsoftware.com/2021/01/context-redux-differences/

---

**TkDodo** (TanStack Query maintainer):
> "🕵️ We've fixed a huge performance problem this week by moving useState + context over to zustand. Same amount of code. The lib is < 1kb. Don't use context for state management. Use it for dependency injection only."

Source: https://x.com/TkDodo/status/1495072479118864398

---

## Zustand + React Context Pattern

**TkDodo** — "Zustand and React Context" (April 2024):
> The idea is to merely share the store instance via React Context — not the store values themselves. Conceptually, this is what React Query is doing with the QueryClientProvider, and what redux is doing as well with their single store.

> Use `createStore` (vanilla Zustand) not `create` (hook-bound Zustand). Pass the store instance through React Context. Consumers use `useStore(store, selector)` with atomic selectors.

Source: https://tkdodo.eu/blog/zustand-and-react-context

---

## TanStack Query — Server State, Not Client State

**TkDodo** — "React Query and Forms" (April 2022):
> "I am not a fan of copying state from one state manager to another, be it putting props to state or copying state from React Query to local state."

> Forms (and WYSIWYG editors) are an exception where you deliberately copy server state as initial data, but you must be aware of the tradeoffs: no background updates will be reflected.

Source: https://tkdodo.eu/blog/react-query-and-forms

---

## Context as Dependency Injection (Not State Management)

**Mark Erikson**:
> "Context is a form of Dependency Injection. It is a transport mechanism — it doesn't 'manage' anything. Any 'state management' is done by you and your own code, typically via useState/useReducer."

> "React-Redux only passes down the Redux store instance via context, not the current state value!"

Source: https://blog.isquaredsoftware.com/2021/01/context-redux-differences/
