import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'
import prettierPlugin from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

const d5GuardrailRules = {
  'no-inline-disable-restricted-syntax': {
    create(context) {
      return {
        Program(node) {
          context.sourceCode.getAllComments().forEach(comment => {
            if (/\beslint-disable(?:-next-line|-line)?\b.*\bno-restricted-syntax\b/.test(comment.value)) {
              context.report({
                node,
                loc: comment.loc ?? node.loc ?? undefined,
                message: 'Inline disables for no-restricted-syntax are forbidden in render-path lint gates.',
              })
            }
          })
        },
      }
    },
  },
}

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['plugins/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.node.json',
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      globals: globals.node,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'warn',
      'object-shorthand': ['warn', 'always'],
      eqeqeq: ['warn', 'always'],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['plugins/**'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      globals: { ...globals.browser, __BUILD_VERSION__: 'readonly' },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'd5-guardrails': {rules: d5GuardrailRules},
      prettier: prettierPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
      ...reactRefresh.configs.vite.rules,

      'prettier/prettier': 'error',

      'no-unused-vars': 'off',

      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      'react-refresh/only-export-components': 'off',

      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'warn',
      'arrow-body-style': ['warn', 'as-needed'],
      'object-shorthand': ['warn', 'always'],
      eqeqeq: ['warn', 'always'],
      'd5-guardrails/no-inline-disable-restricted-syntax': 'error',

      // react rules
      'react/prefer-stateless-function': 'error',
      'react/button-has-type': 'error',
      'react/no-unused-prop-types': 'error',
      'react/jsx-pascal-case': 'error',
      'react/jsx-no-script-url': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
      'react/jsx-fragments': 'error',
      'react/destructuring-assignment': ['error', 'always', { destructureInSignature: 'always' }],
      'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary'] }],
      'react/function-component-definition': ['warn', { namedComponents: 'arrow-function' }],
      'react/jsx-key': [
        'error',
        {
          checkFragmentShorthand: true,
          checkKeyMustBeforeSpread: true,
          warnOnDuplicates: true,
        },
      ],
      'react/jsx-no-useless-fragment': 'warn',
      'react/jsx-curly-brace-presence': 'warn',
      'react/no-typos': 'warn',
      'react/display-name': 'warn',
      'react/self-closing-comp': 'warn',
      'react/jsx-sort-props': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-one-expression-per-line': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-literals': ['warn', { noStrings: true, ignoreProps: true, allowedStrings: ['.', '-', '+', ':', '/'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/(?:^|\s)(?:\d+\.\d+\.\d+|dev|local|unknown)(?:\s|$)/]',
          message:
            'Hardcoded version/build/environment strings are forbidden in JSX render paths. Import from the shared build-version module.',
        },
        {
          selector: 'JSXAttribute > Literal[value=/^(?:\d+\.\d+\.\d+|dev|local|unknown)$/]',
          message:
            'Hardcoded version/build/environment strings are forbidden in JSX attributes. Import from the shared build-version module.',
        },
        {
          selector: 'JSXExpressionContainer > Literal[value=/^(?:\d+\.\d+\.\d+|dev|local|unknown)$/]',
          message:
            'Hardcoded version/build/environment strings are forbidden in JSX expressions. Import from the shared build-version module.',
        },
      ],
    },
  },
])
