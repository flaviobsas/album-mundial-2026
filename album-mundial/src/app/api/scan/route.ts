import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()
    if (!image) return NextResponse.json({ error: 'no image' }, { status: 400 })

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: image }
          },
          {
            type: 'text',
            text: `Look at this photo of a Panini World Cup 2026 sticker.
Find the sticker code printed on it. It's a 2-3 letter country code + number, examples: ARG17, MEX3, BRA14, FRA20, ESP11, GER10, ENG18, POR15, NED7, BEL2, URU10, COL20, ECU9, USA16, CAN3, MAR4, SEN15, GHA14, CIV17, QAT20, KOR18, JPN12, AUS2, SCO11, CRO9, SUI9, TUN14, NOR15, SWE19, IRN18, NZL17, CZE12, PAR17, RSA20, KSA16, CPV16, COD16, UZB16, BIH18, CUW14, HAI12, TUR20, AUT20, ALG15, JOR15, IRQ9, FWC5, OO1.
Reply ONLY with code and number separated by space, example: "ARG 17"
If you cannot see a sticker code clearly, reply: "NONE"`
          }
        ]
      }]
    })

    const text = (msg.content[0] as { text: string }).text.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim()
    return NextResponse.json({ text })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
