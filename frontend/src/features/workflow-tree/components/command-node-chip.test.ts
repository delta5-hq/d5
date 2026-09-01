import { describe, expect, it } from 'vitest'
import { BUILTIN_COMMANDS } from '@shared/lib/builtin-command-aliases'
import { getCommandChip, truncateTitleForChip } from './command-node-chip'

describe('command node chips', () => {
  it.each(BUILTIN_COMMANDS)('labels $alias by command token without command arguments', ({ alias }) => {
    expect(getCommandChip(`${alias} :n=2 List 3 colors`, []).label).toBe(alias)
  })

  it('distinguishes command-less nodes from assigned command families', () => {
    expect(getCommandChip(undefined, [])).toMatchObject({
      label: 'Not assigned',
      testId: 'node-chip-commandless',
    })
    expect(getCommandChip('/steps', [])).toMatchObject({
      label: '/steps',
      testId: 'node-chip-steps',
    })
    expect(getCommandChip('/foreach item', [])).toMatchObject({
      label: '/foreach',
      testId: 'node-chip-foreach',
    })
  })

  it('recognizes dynamic slash aliases as assigned command chips', () => {
    expect(
      getCommandChip('/team_command do work', [{ alias: '/team_command', queryType: 'custom_llm' }]),
    ).toMatchObject({
      label: '/team_command',
      testId: 'node-chip-command',
    })
  })

  it('resolves the slash-verb caption color from the canonical role palette', () => {
    expect(getCommandChip('/chat hi', [])).toMatchObject({ color: '#ffa726' })
    expect(getCommandChip('/web query', [])).toMatchObject({ color: '#42a5f5' })
    expect(getCommandChip('/foreach item', [])).toMatchObject({ color: '#ab47bc' })
    expect(getCommandChip('/refine text', [])).toMatchObject({ color: '#66bb6a' })
    expect(getCommandChip('/download url', [])).toMatchObject({ color: '#9e9e9e' })
    expect(getCommandChip(undefined, []).color).toBeUndefined()
  })

  it.each([
    { title: '1234567890123456789', expected: '1234567890123456789' },
    { title: '12345678901234567890', expected: '12345678901234567890' },
    { title: '12345678901234567890-rest', expected: '12345678901234567890' },
  ])('limits only the title chip display value: "$title"', ({ title, expected }) => {
    expect(truncateTitleForChip(title)).toBe(expected)
  })

  it('does not trim title content before display truncation', () => {
    expect(truncateTitleForChip('  leading title')).toBe('  leading title')
  })
})
