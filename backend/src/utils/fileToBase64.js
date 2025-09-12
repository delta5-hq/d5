import readStreamToBuffer from './readStreamToBuffer'

const fileToBase64 = async file => {
  const data = Buffer.from(await readStreamToBuffer(file.read())).toString('base64')
  return {...file.toJSON(), data}
}

export default fileToBase64
