export const queryKeys = {
  authMe: ['auth', 'me'],
  authPwdTokenCheck: ['auth', 'check-token'],

  waitlist: ['waitlist'],

  userProfile: (userId: string) => ['users', userId],
  userMaps: (userId: string) => ['maps', userId],
}
