export interface PromptSeed {
  title: string
  children: PromptSeed[]
}

const TAB_AS_SPACES = '    '

const isBlank = (line: string): boolean => /^\s*$/.test(line)

const leadingSpaces = (line: string): number => {
  let count = 0
  while (count < line.length && line[count] === ' ') count += 1
  return count
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

const blockToLines = (block: string): string[] =>
  block
    .replace(/\r\n|\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n')
    .replace(/\t/g, TAB_AS_SPACES)
    .replace(/^ +$/gm, '')
    .split('\n')
    .filter(line => !isBlank(line))

const groupByRoots = (lines: readonly string[]): string[][] =>
  lines.reduce<string[][]>((groups, line) => {
    if (groups.length === 0 || !line.startsWith(' ')) groups.push([])
    groups[groups.length - 1].push(line)
    return groups
  }, [])

const linesToTree = (group: readonly string[]): PromptSeed => {
  const root: PromptSeed = { title: group[0].slice(leadingSpaces(group[0])), children: [] }
  const parentAtLevel: PromptSeed[] = [root]
  const spacesAtLevel: number[] = [leadingSpaces(group[0])]
  let previous = root

  for (let i = 1; i < group.length; i += 1) {
    const spaces = leadingSpaces(group[i])
    const seed: PromptSeed = { title: group[i].slice(spaces), children: [] }
    const currentLevelSpaces = sum(spacesAtLevel)

    if (spaces > currentLevelSpaces) {
      parentAtLevel.push(previous)
      spacesAtLevel.push(spaces - currentLevelSpaces)
    } else if (spaces < currentLevelSpaces) {
      for (let level = 0; level < spacesAtLevel.length; level += 1) {
        spacesAtLevel.pop()
        parentAtLevel.pop()
        if (spaces >= sum(spacesAtLevel)) break
      }
    }

    parentAtLevel[parentAtLevel.length - 1].children.push(seed)
    previous = seed
  }

  return root
}

// Mirrors backend createNodes.linesToNodes. Keeping the parser at the workflow
// entity layer lets both the producer and provenance validator share one shape.
export function parseTextToPromptSeeds(text: string): PromptSeed[] {
  if (!text.trim()) return []
  return text
    .split('\n\n')
    .flatMap(block => groupByRoots(blockToLines(block)))
    .map(linesToTree)
}
