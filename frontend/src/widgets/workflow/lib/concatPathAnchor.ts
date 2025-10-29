const remove = /[^a-zA-Z0-9_+-]/g

const urlEncode = (string: string) => encodeURI(String(string).replaceAll(' ', '_').replaceAll(remove, ''))

const concatPathAnchor = (path: string, anchor: string) => `${path}${anchor ? `#${urlEncode(anchor)}` : ''}`

export { concatPathAnchor }
