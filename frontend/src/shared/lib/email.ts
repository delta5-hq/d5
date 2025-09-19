const regex = /^[^ @]+@[-a-zA-Z0-9._]{1,254}\.[a-z]{2,20}$/

const notRegex = /^[A-Za-z]{3,9}:\/\//

export const isEmail = (candidateMail: string): boolean => !notRegex.test(candidateMail) && regex.test(candidateMail)
