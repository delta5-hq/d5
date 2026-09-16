import {getNodeCommand} from '../../commands/utils/isCommand'
import {matchesCommand} from '../../constants/matchesCommand'
import {SUMMARIZE_QUERY} from '../../constants/summarize'
import {MEMORIZE_QUERY} from '../../constants/memorize'
import {OUTLINE_QUERY, readSummarizeParam} from '../../constants/outline'
import {VALIDATE_QUERY} from '../../constants/validate'

// A single-command modifier term (`/elect :n=N /chat`, `/refine :n=N /chat`) carries exactly one
// generating command. Its only admissible children are the assertions that gate it and the
// output-consuming post-processors `/foreach /chat` already admits. Sequencing (`#N`, `/steps`),
// fan-out (`/foreach`), routing (`/switch`) and nested reliability (`/elect`, `/refine`) have no
// generating command to attach to here; they belong under a `/steps` term.
const admitsInlineTermChild = query =>
  Boolean(query) &&
  (matchesCommand(query, VALIDATE_QUERY) ||
    matchesCommand(query, SUMMARIZE_QUERY) ||
    matchesCommand(query, MEMORIZE_QUERY) ||
    (query.startsWith(OUTLINE_QUERY) && readSummarizeParam(query)))

export const firstInadmissibleInlineTermChild = (scopeNode, store) =>
  (scopeNode.children ?? [])
    .map(id => store.getNode(id))
    .find(child => child && !admitsInlineTermChild(getNodeCommand(child))) ?? null

export const inlineTermChildRefusalMessage = (modifierLabel, childCommand) =>
  `Error: ${modifierLabel} :n=N /<command> admits only /validate and output post-processors ` +
  `(/summarize, /memorize, /outline --summarize) as children; "${childCommand}" is none of these. ` +
  `To sequence, fan out, route or nest reliability, wrap the steps in ${modifierLabel} :n=N /steps.`
