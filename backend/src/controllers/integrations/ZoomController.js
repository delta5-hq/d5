import fetch from 'node-fetch'

function jsonToUrlEncoded(json) {
  const urlSearchParams = new URLSearchParams()
  for (const key in json) {
    urlSearchParams.append(key, json[key])
  }
  return urlSearchParams.toString()
}

function checkFormat(str) {
  // format "Name: Text"
  const textRegex = /^[A-Za-z\s]+:\s.+/
  const timecodeRegex = /^[0-9]+:[0-9]+:[0-9]+.[0-9]+ --> [0-9]+:[0-9]+:[0-9]+.[0-9]+$/

  return textRegex.test(str) && !timecodeRegex.test(str)
}

const extractTextFromVTT = vttText => {
  const lines = vttText.split('\n')
  const textLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // Ignore lines that contain a timecode or are empty
    if (line && checkFormat(line)) {
      textLines.push(`${line.trim()}\n\n`)
    }
  }
  return textLines.join('')
}

const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2'

const ZoomController = {
  auth: async ctx => {
    const body = await ctx.request.json()
    const authorization = ctx.headers.authorization
    const apiKey = authorization?.split(' ')[1]

    if (!authorization || !apiKey) {
      ctx.throw(401, 'Unauthrorized')
    }

    const authUrl = `https://zoom.us/oauth/token?${jsonToUrlEncoded(body)}`

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authorization,
      },
      body,
    }
    try {
      const response = await fetch(authUrl, requestOptions)

      if (!response.ok) {
        ctx.throw(response.status, response.statusText)
      }

      const data = await response.json()

      ctx.body = data
    } catch (e) {
      console.error(e)
      ctx.throw(500, e.message)
    }
  },
  getRecordings: async ctx => {
    const meetingId = ctx.params.id
    const apiKey = ctx.headers.authorization.split(' ')[1]

    if (!apiKey) {
      ctx.throw(404, 'Zoom Api Key is required')
    }

    if (!meetingId) {
      ctx.throw(404, 'Meeting ID is required')
    }

    const apiUrl = `${ZOOM_API_BASE_URL}/meetings/${meetingId}/recordings`
    const requestOptions = {
      method: 'GET',
      headers: {
        Authorization: ctx.headers.authorization,
      },
    }

    try {
      const response = await fetch(apiUrl, requestOptions)

      if (!response.ok) {
        ctx.throw(response.status, data.message)
      }

      const data = await response.json()
      const {recording_files} = data
      const transcriptFilesData = recording_files.filter(recording => recording.file_type === 'TRANSCRIPT')

      const transcriptions = await Promise.all(
        transcriptFilesData.map(async ({download_url}) => {
          const response = await fetch(download_url, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          })

          const vttText = await response.text()
          return extractTextFromVTT(vttText)
        }),
      )

      ctx.body = transcriptions
    } catch (e) {
      console.error(e)
      ctx.throw(500, e.message)
    }
  },
}

export default ZoomController
