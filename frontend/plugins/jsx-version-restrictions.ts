export type VersionRestrictionEntry = { readonly selector: string; readonly message: string }

export const hardcodedVersionRestrictions: ReadonlyArray<VersionRestrictionEntry> = [
  {
    selector: 'JSXText[value=/(?:^|\\s)(?:\\d+\\.\\d+\\.\\d+|dev|local|unknown)(?:\\s|$)/]',
    message:
      'Hardcoded version/build/environment strings are forbidden in JSX render paths. Import from the shared build-version module.',
  },
  {
    selector: 'JSXAttribute > Literal[value=/^(?:\\d+\\.\\d+\\.\\d+|dev|local|unknown)$/]',
    message:
      'Hardcoded version/build/environment strings are forbidden in JSX attributes. Import from the shared build-version module.',
  },
  {
    selector:
      'JSXExpressionContainer > Literal[value=/^(?:\\d+\\.\\d+\\.\\d+|dev|local|unknown)$/]',
    message:
      'Hardcoded version/build/environment strings are forbidden in JSX expressions. Import from the shared build-version module.',
  },
]
