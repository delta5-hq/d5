const restoreEnv = originals => {
  Object.entries(originals).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  })
}

const applyEnv = vars => {
  const originals = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]))
  Object.entries(vars).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  })
  return originals
}

export const withEnv = (vars, action) => {
  const originals = applyEnv(vars)
  try {
    return action()
  } finally {
    restoreEnv(originals)
  }
}

export const withEnvAsync = async (vars, action) => {
  const originals = applyEnv(vars)
  try {
    return await action()
  } finally {
    restoreEnv(originals)
  }
}
