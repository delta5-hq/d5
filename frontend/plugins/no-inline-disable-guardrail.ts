import type { Rule } from 'eslint'

export const noInlineDisableGuardrailRule: Rule.RuleModule = {
  create(context) {
    return {
      Program(node) {
        context.sourceCode.getAllComments().forEach(comment => {
          if (/\beslint-disable(?:-next-line|-line)?\b.*\bno-restricted-syntax\b/.test(comment.value)) {
            context.report({
              node,
              loc: comment.loc ?? node.loc ?? undefined,
              message:
                'Inline disables for no-restricted-syntax are forbidden in render-path lint gates.',
            })
          }
        })
      },
    }
  },
}
