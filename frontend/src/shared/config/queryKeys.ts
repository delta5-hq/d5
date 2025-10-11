export const queryKeys = {
  authMe: ['auth', 'me'],
  authPwdTokenCheck: ['auth', 'check-token'],

  waitlist: ['waitlist'],

  userProfile: (userId: string) => ['users', userId],
  userMaps: (userId: string) => ['maps', userId],

  integration: ['settings', 'integration'],
  openai: ['settings', 'integration', 'openai'],
  openaiStatus: ['settings', 'integration', 'openai', 'status'],
  languages: ['languages'],

  templates: ['templates'],
}
