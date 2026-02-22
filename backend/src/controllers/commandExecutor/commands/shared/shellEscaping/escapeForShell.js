const escapeSingleQuote = () => "'\\''"

const escapeDoubleQuoteMetachars = text => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

const escapeUnquotedMetachars = text => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\s/g, '\\ ')
    .replace(/[&|;<>()]/g, '\\$&')
}

export const escapeForSingleQuotedContext = text => {
  return text.replace(/'/g, escapeSingleQuote)
}

export const escapeForDoubleQuotedContext = escapeDoubleQuoteMetachars

export const escapeForUnquotedContext = escapeUnquotedMetachars
