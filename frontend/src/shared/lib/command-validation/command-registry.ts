import { BUILTIN_COMMAND_ALIASES } from '../builtin-command-aliases'

export const D5_COMMANDS = BUILTIN_COMMAND_ALIASES

export type D5Command = (typeof D5_COMMANDS)[number]

export function isValidCommand(text: string): boolean {
  return D5_COMMANDS.some(cmd => text === cmd)
}

export function getAllCommands(): readonly string[] {
  return D5_COMMANDS
}
