import { COMMAND_TO_QUERYTYPE_MAP, type CommandQuery } from '../command-querytype-mapper'
import { BUILTIN_COMMAND_ALIASES } from '../builtin-command-aliases'

export const D5_COMMANDS = BUILTIN_COMMAND_ALIASES

export type D5Command = (typeof D5_COMMANDS)[number]

export function isValidCommand(text: string): boolean {
  return text in COMMAND_TO_QUERYTYPE_MAP
}

export function getAllCommands(): readonly CommandQuery[] {
  return D5_COMMANDS
}
