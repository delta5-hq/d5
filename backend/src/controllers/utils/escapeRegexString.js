const escapeRegexString = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default escapeRegexString
