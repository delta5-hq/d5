import {CONTROL_FLOW_COMMANDS} from '../../constants'
import {OUTLINE_QUERY_TYPE} from '../../constants/outline'
import {STEPS_QUERY_TYPE} from '../../constants/steps'

// The single source of truth for query types that cannot serve as a generating
// term after /elect or /refine: control-flow and post-processor commands consume
// existing output rather than producing a fresh candidate. /outline is excluded
// unconditionally — it never generates, regardless of any --summarize parameter.
// /steps is admitted as a term: it owns sequencing and, run per fork, produces a
// fresh whole-subtree candidate. The frontend mirror lives in
// shared/lib/reliability/inline-term-parser.ts and is pinned to this set by the
// mechanical parity tests on both stacks.
export const NON_GENERATING_TERM_QUERY_TYPES = new Set(
  [...CONTROL_FLOW_COMMANDS, OUTLINE_QUERY_TYPE].filter(queryType => queryType !== STEPS_QUERY_TYPE),
)
