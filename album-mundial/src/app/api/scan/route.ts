import { NextRequest, NextResponse } from 'next/server'

const TEAMS = [
  'MEX','RSA','KOR','CZE','CAN','BIH','QAT','SUI','BRA','MAR','HAI','SCO',
  'USA','PAR','AUS','TUR','GER','CUW','CIV','ECU','NED','JPN','SWE','TUN',
  'BEL','EGV','IRN','NZL','ESP','CPV','KSA','URU','FRA','SEN','IRQ','NOR',
  'ARG','ALG','AUT','JOR','POR','COD','UZB','COL','ENG','CRO','GHA','PAN',
  'FWC','OO','CC'
]

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
            features: [{ type: 'TEXT_DETECTION', maxResults: 10 }]
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

    // Buscar código de figurita en el texto
    const upper = fullText.toUpperCase().replace(/[^A-Z0-9\s\n]/g, ' ')

    for (const team of TEAMS) {
      const patterns = [
        new RegExp(`\\b${team}\\s*(\\d{1,2})\\b`),
        new RegExp(`${team}\\D{0,2}(\\d{1,2})`),
      ]
      for (const pat of patterns) {
        const m = upper.match(pat)
        if (m) {
          return NextResponse.json({ text: `${team} ${m[1]}`, raw: fullText })
        }
      }
    }

    return NextResponse.json({ text: 'NONE', raw: fullText })

  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
