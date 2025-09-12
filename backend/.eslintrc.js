module.exports = {
  env: {
    jest: true,
    node: true,
    es6: true,
  },
  plugins: ['prettier', 'jest', 'babel'],
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 2016,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'no-import-assign': 'off',
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        semi: false,
        trailingComma: 'all',
        bracketSpacing: false,
        printWidth: 120,
        arrowParens: 'avoid',
      },
    ],
    indent: ['off', 2],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single', {avoidEscape: true}],
    semi: ['error', 'never'],
    // ctx is often changed after some async io operation
    'require-atomic-updates': [0],
    'no-unused-vars': ['error', {ignoreRestSiblings: true}],
  },
}
