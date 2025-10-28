import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ['./src/shared/**'],
    rules: {
      'fsd/public-api': 'off',
    },
  },
  {
    // Allow cross-imports between widgets
    files: ['src/widgets/**'],
    rules: {
      'fsd/forbidden-imports': 'off',
    },
  },
  {
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
