const COMMAND_SEPARATOR = /\s/

export const matchesCommand = (title, command) => {
  if (!title || !command) return false
  if (!title.startsWith(command)) return false

  const nextCharacter = title.charAt(command.length)

  return !nextCharacter || COMMAND_SEPARATOR.test(nextCharacter)
}
