import {All, Any, Optional, Star, Node} from './rdParse'
import Grammar, {IgnoreWhitespace} from './rdParseJsExpr'

// const srcMap = (obj: unknown, $: any, $next: any) =>
//   Object.defineProperties(obj, {
//     pos: {writable: true, configurable: true, value: $.pos},
//     text: {
//       writable: true,
//       configurable: true,
//       value: ($.text || $next.text).slice($.pos, $next.pos),
//     },
//   })

// const withSrcMap =
//   (reducer = ([n]: unknown[]) => n) =>
//   (parts: unknown, ...$$: any[]) =>
//     srcMap(reducer(parts, ...$$), ...$$)

const plainReducer = ([n]) => n

const Expression = $ => Grammar($)

// Array literal

const EmptyElement = Node(',', () => ({empty: true}))
const Elision = All(',', Star(EmptyElement))
const SpreadElement = Node(All('...', Expression), ([spread]) => ({
  spread,
}))
const Element = Any(SpreadElement, Expression)

const ElementList = All(Star(EmptyElement), Element, Star(All(Elision, Element)))

const ArrayLiteral = Node(
  All('[', Any(All(Star(EmptyElement), ']'), All(ElementList, Optional(Elision), ']'))),
  elements => ({type: 'ArrayLiteral', elements}),
)

export const TolerantArrayGrammar = IgnoreWhitespace(Node(ArrayLiteral, plainReducer))
