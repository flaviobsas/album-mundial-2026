import { GROUPS } from '@/lib/data'

const teamLimits: Record<string, number> = {}
GROUPS.forEach(g => {
  Object.entries(g.teams as Record<string, number>).forEach(([team, count]) => {
    teamLimits[team] = count
  })
})

const TEAMS = Object.keys(teamLimits)

export function parseAllStickers(text: string): { team: string; num: number }[] {
  const upper = text.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ')
  const results = new Map<string, { team: string; num: number }>()
  for (const team of TEAMS) {
    const patterns = [
      new RegExp(`\\b${team}\\s*(\\d{1,2})\\b`, 'g'),
      new RegExp(`${team}\\D{0,2}(\\d{1,2})`, 'g'),
    ]
    for (const pat of patterns) {
      let m: RegExpExecArray | null
      while ((m = pat.exec(upper)) !== null) {
        const num = parseInt(m[1])
        if (num >= 1 && num <= teamLimits[team]) {
          const key = `${team}_${num}`
          if (!results.has(key)) results.set(key, { team, num })
        }
      }
    }
  }
  return Array.from(results.values())
}

export function parseStickerText(text: string): { team: string; num: number } | null {
  const upper = text.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ')
  for (const team of TEAMS) {
    const patterns = [
      new RegExp(`\\b${team}\\s*(\\d{1,2})\\b`),
      new RegExp(`${team}\\D{0,2}(\\d{1,2})`),
    ]
    for (const pat of patterns) {
      const m = upper.match(pat)
      if (m) {
        const num = parseInt(m[1])
        if (num >= 1 && num <= teamLimits[team]) return { team, num }
      }
    }
  }
  return null
}
