import {calculateMaxChunksFromSize} from '../../../controllers/commandExecutor/constants'
import {SERP_API_SCHOLAR_PARAMS} from '../../../controllers/commandExecutor/constants/outline'

export class OutlineParamsAdapter {
  adaptParams(args = {}) {
    const hasWeb = !!args.web
    const hasScholar = !!args.scholar
    const hasExt = !!args.ext

    const disableSearchScrape = hasExt
    const maxChunks = hasScholar
      ? calculateMaxChunksFromSize(args.scholar)
      : hasWeb
      ? calculateMaxChunksFromSize(args.web)
      : args.maxChunks
      ? calculateMaxChunksFromSize(args.maxChunks)
      : undefined

    const serpApiParams = hasScholar ? {...SERP_API_SCHOLAR_PARAMS, as_ylo: args.minYear || undefined} : undefined

    const from = args.href ? [args.href] : []

    return {
      lang: args.lang || null,
      citations: args.citations || false,
      maxChunks,
      serpApiParams,
      disableSearchScrape,
      context: args.context || null,
      from,
    }
  }
}
