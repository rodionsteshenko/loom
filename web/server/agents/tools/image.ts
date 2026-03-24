import fs from 'fs'
import path from 'path'

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview'

function getGeminiKey(): string {
  return process.env.GEMINI_API_KEY || ''
}

/**
 * Generate an image using the Gemini API and save it to disk.
 * Returns the file path on success, null on failure.
 */
export async function generateImage(opts: {
  prompt: string
  outputPath: string
  resolution?: '1K' | '2K' | '4K'
  aspectRatio?: 'square' | 'landscape' | 'portrait'
}): Promise<string | null> {
  const { prompt, outputPath, resolution = '1K', aspectRatio = 'square' } = opts

  const aspectPrefix = aspectRatio === 'landscape'
    ? 'WIDESCREEN 16:9 aspect ratio, horizontal composition. '
    : aspectRatio === 'portrait'
    ? 'PORTRAIT 9:16 aspect ratio, vertical composition. '
    : 'SQUARE 1:1 aspect ratio. '

  const apiKey = getGeminiKey()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set — cannot generate images')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: aspectPrefix + prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { imageSize: resolution },
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  const parts = json.candidates?.[0]?.content?.parts
  if (!parts) throw new Error('No candidates in Gemini response')

  const imagePart = parts.find((p: any) => p.inlineData)
  if (!imagePart) {
    // Log any text response for debugging
    const textPart = parts.find((p: any) => p.text)
    if (textPart) console.log('Gemini text response:', textPart.text)
    throw new Error('No image in Gemini response')
  }

  // Decode base64 image and save as PNG
  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')

  // Ensure output directory exists
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(outputPath, imageBuffer)
  return outputPath
}
