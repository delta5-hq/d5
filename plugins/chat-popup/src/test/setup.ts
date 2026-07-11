import { expect, afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

if (!global.crypto?.randomUUID) {
  Object.defineProperty(global, "crypto", {
    value: {
      randomUUID: () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    },
    writable: true,
    configurable: true,
  })
}

if (typeof globalThis.EventSource === "undefined") {
  Object.defineProperty(globalThis, "EventSource", {
    value: Object.assign(function EventSource() {}, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSED: 2,
    }),
    writable: true,
    configurable: true,
  })
}
