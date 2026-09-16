import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import type { ReactNode } from 'react'
import messages from '@shared/lib/intl'
import { ForkFailureReason } from '../fork-failure-reason'

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en" messages={messages.en}>
    {children}
  </IntlProvider>
)

const renderReason = (reason: string) => render(<ForkFailureReason reason={reason} />, { wrapper })

// Every recognised failure cause the reliability engine can emit maps to a stable,
// human-readable message. This table is the single owner of that mapping decision.
describe('ForkFailureReason — recognised cause tokens map to their message', () => {
  it.each([
    ['empty-output', 'Empty output'],
    ['refusal-output', 'Refusal output'],
    ['mcp-tool-error', 'MCP tool reported an error'],
    ['http-status-error', 'HTTP transport returned a non-success status'],
    ['ssh-exit-error', 'SSH command returned a nonzero exit code'],
    ['runtime-error', 'Command execution failed at runtime'],
    ['execution-error', 'Command produced an execution error'],
    ['structural-gate', 'Structurally rejected by the gate'],
    ['no-judge-signal', 'The verifier could not be reached'],
    ['verdict-unparsed', 'The verifier returned an unrecognised verdict'],
  ])('renders the localized message for %s', (reason, expected) => {
    renderReason(reason)
    expect(screen.getByText(expected)).toBeDefined()
  })
})

// An unrecognised cause is raw juror text — a free-form reason the engine did not tokenize.
// It must reach the user verbatim rather than being swallowed or mistaken for a token.
describe('ForkFailureReason — unrecognised reason falls back to raw text', () => {
  it.each([
    ['a free-form juror sentence', 'the reply contains two words, not one'],
    ['a token-shaped but unmapped cause', 'provider-specific-error'],
    ['prose containing a mapped substring', 'runtime-error was expected but not seen'],
  ])('renders %s verbatim', (_name, reason) => {
    renderReason(reason)
    expect(screen.getByText(reason)).toBeDefined()
  })

  it('renders an empty reason without throwing', () => {
    expect(() => renderReason('')).not.toThrow()
  })
})
