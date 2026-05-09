import { NextRequest, NextResponse } from 'next/server'
import { parseAllStickers } from '@/lib/parseSticker'

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()
    if (!image) return NextResponse.json({ error: 'no image' }, { status: 400 })

    const apiKey = process.env.GOOGLE_VISION_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'no api key configured' }, { status: 500 })

    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [{ type: 'TEXT_DETECTION', maxResults: 50 }]
          }]
        })
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    const data = await res.json()
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text ||
                     data.responses?.[0]?.textAnnotations?.[0]?.description || ''

    const stickers = parseAllStickers(fullText)
    return NextResponse.json({ stickers, raw: fullText })

  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
