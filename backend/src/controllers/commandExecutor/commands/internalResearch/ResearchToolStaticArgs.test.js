import {buildInternalResearchToolStaticArgs, cleanInternalResearchPrompt} from './ResearchToolStaticArgs'
import {DEFAULT_CONTEXT_NAME, EXT_QUERY_TYPE} from '../../constants/ext'
import {OUTLINE_QUERY_TYPE, SCHOLAR_DEFAULT, SCHOLAR_MIN_YEAR_DEFAULT, WEB_DEFAULT} from '../../constants/outline'
import {SCHOLAR_QUERY_TYPE} from '../../constants/scholar'
import {WEB_QUERY_TYPE} from '../../constants/web'

const buildArgs = (queryType, command) => buildInternalResearchToolStaticArgs(queryType, command)
const commonArgs = {lang: 'ru', citations: true, maxChunks: 'xxs'}

const commonFlagCommands = [
  {label: 'web', queryType: WEB_QUERY_TYPE, command: '/web --lang=ru --citation --xxs query'},
  {label: 'scholar', queryType: SCHOLAR_QUERY_TYPE, command: '/scholar --lang=ru --citation --xxs query'},
  {label: 'ext', queryType: EXT_QUERY_TYPE, command: '/ext --lang=ru --citation --xxs query'},
  {label: 'outline', queryType: OUTLINE_QUERY_TYPE, command: '/outline --lang=ru --citation --xxs query'},
]

const querySpecificArgCases = [
  {
    label: 'web keeps only common args',
    queryType: WEB_QUERY_TYPE,
    command: '/web --lang=ru --citation --xxs query',
    expectedArgs: commonArgs,
  },
  {
    label: 'scholar accepts kebab-case min-year',
    queryType: SCHOLAR_QUERY_TYPE,
    command: '/scholar --min-year=2020 query',
    expectedArgs: {minYear: 2020},
  },
  {
    label: 'scholar accepts snake_case min_year',
    queryType: SCHOLAR_QUERY_TYPE,
    command: '/scholar --min_year=2024 query',
    expectedArgs: {minYear: 2024},
  },
  {
    label: 'scholar keeps min-year default when omitted',
    queryType: SCHOLAR_QUERY_TYPE,
    command: '/scholar query',
    expectedArgs: {minYear: SCHOLAR_MIN_YEAR_DEFAULT},
  },
  {
    label: 'ext keeps default context when context is omitted',
    queryType: EXT_QUERY_TYPE,
    command: '/ext query',
    expectedArgs: {context: DEFAULT_CONTEXT_NAME},
  },
  {
    label: 'ext accepts hyphenated context names',
    queryType: EXT_QUERY_TYPE,
    command: '/ext --context=project-notes query',
    expectedArgs: {context: 'project-notes'},
  },
  {
    label: 'outline omits inactive research sources',
    queryType: OUTLINE_QUERY_TYPE,
    command: '/outline query',
    expectedArgs: {},
  },
  {
    label: 'outline enables web with its default size',
    queryType: OUTLINE_QUERY_TYPE,
    command: '/outline --web query',
    expectedArgs: {web: WEB_DEFAULT},
  },
  {
    label: 'outline enables scholar with default size and min year',
    queryType: OUTLINE_QUERY_TYPE,
    command: '/outline --scholar query',
    expectedArgs: {scholar: SCHOLAR_DEFAULT, minYear: SCHOLAR_MIN_YEAR_DEFAULT},
  },
  {
    label: 'outline enables ext with default context',
    queryType: OUTLINE_QUERY_TYPE,
    command: '/outline --ext query',
    expectedArgs: {ext: true, context: DEFAULT_CONTEXT_NAME},
  },
  {
    label: 'outline keeps quoted href',
    queryType: OUTLINE_QUERY_TYPE,
    command: '/outline --href="https://example.com/research" query',
    expectedArgs: {href: 'https://example.com/research'},
  },
]

const promptCleaningCases = [
  {
    label: 'common research flags',
    prompt: '/web --lang=ru --citation --xxs find workflow evidence',
    expectedPrompt: 'find workflow evidence',
  },
  {
    label: 'scholar year aliases',
    prompt: '/scholar --min-year=2020 --min_year=2024 compare protocols',
    expectedPrompt: 'compare protocols',
  },
  {
    label: 'outline source flags',
    prompt: '/outline --web=xxs --scholar=xs --ext --context=project-notes map sources',
    expectedPrompt: 'map sources',
  },
]

describe('ResearchToolStaticArgs', () => {
  it.each(commonFlagCommands)('applies shared flags for $label commands', ({queryType, command}) => {
    expect(buildArgs(queryType, command)).toMatchObject(commonArgs)
  })

  it.each(querySpecificArgCases)('$label', ({queryType, command, expectedArgs}) => {
    expect(buildArgs(queryType, command)).toEqual(expectedArgs)
  })

  it('omits empty common args instead of leaking parser defaults', () => {
    expect(buildArgs(WEB_QUERY_TYPE, '/web plain query')).toEqual({})
  })

  it('returns no static args for unsupported query types', () => {
    expect(buildArgs('unsupported', '/unsupported --lang=ru query')).toEqual({})
  })

  it.each(promptCleaningCases)('cleans $label without removing the user prompt', ({prompt, expectedPrompt}) => {
    expect(cleanInternalResearchPrompt(prompt)).toBe(expectedPrompt)
  })

  it('normalizes empty prompt input to an empty prompt', () => {
    expect(cleanInternalResearchPrompt()).toBe('')
  })
})
