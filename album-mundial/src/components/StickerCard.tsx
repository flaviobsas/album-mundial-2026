'use client'
import { useEffect, useRef, useState } from 'react'
import { TEAM_ISO, TEAM_GRAD, PLAYERS } from '@/lib/data'

// Mapa de nombres exactos en Wikipedia para los jugadores principales
const WIKI_NAMES: Record<string, string> = {
  ARG_2:'Emiliano Martínez',ARG_4:'Cristian Romero',ARG_5:'Nicolás Otamendi',
  ARG_8:'Enzo Fernández',ARG_9:'Alexis Mac Allister',ARG_10:'Rodrigo De Paul',
  ARG_17:'Lionel Messi',ARG_18:'Lautaro Martínez',ARG_19:'Julián Álvarez',
  BRA_2:'Alisson Becker',BRA_4:'Marquinhos',BRA_5:'Éder Militão',
  BRA_6:'Gabriel Magalhães',BRA_9:'Lucas Paquetá',BRA_10:'Casemiro',
  BRA_14:'Vinícius Júnior',BRA_15:'Rodrygo',BRA_19:'Raphinha',
  FRA_2:'Mike Maignan',FRA_4:'William Saliba',FRA_10:'Eduardo Camavinga',
  FRA_15:'Ousmane Dembélé',FRA_20:'Kylian Mbappé',
  ESP_10:'Rodri',ESP_11:'Pedri',ESP_15:'Lamine Yamal',ESP_17:'Nico Williams',
  ESP_19:'Álvaro Morata',
  GER_6:'Antonio Rüdiger',GER_10:'Joshua Kimmich',GER_11:'Florian Wirtz',
  GER_15:'Jamal Musiala',GER_17:'Kai Havertz',
  ENG_10:'Declan Rice',ENG_11:'Jude Bellingham',ENG_12:'Cole Palmer',
  ENG_16:'Phil Foden',ENG_17:'Bukayo Saka',ENG_18:'Harry Kane',
  POR_4:'Rúben Dias',POR_9:'Bernardo Silva',POR_10:'Bruno Fernandes',
  POR_15:'Cristiano Ronaldo',POR_19:'Pedro Neto',POR_20:'Rafael Leão',
  NED_3:'Virgil van Dijk',NED_12:'Teun Koopmeiners',NED_14:'Frenkie de Jong',
  NED_20:'Cody Gakpo',
  BEL_2:'Thibaut Courtois',BEL_15:'Kevin De Bruyne',BEL_16:'Jérémy Doku',
  BEL_20:'Romelu Lukaku',
  URU_10:'Federico Valverde',URU_17:'Darwin Núñez',URU_14:'Manuel Ugarte',
  COL_14:'James Rodríguez',COL_20:'Luis Díaz',
  MEX_16:'Santiago Giménez',MEX_17:'Raúl Jiménez',MEX_15:'Hirving Lozano',
  NOR_15:'Erling Haaland',NOR_10:'Martin Ødegaard',
  CRO_9:'Luka Modrić',CRO_4:'Joško Gvardiol',
  MAR_4:'Achraf Hakimi',
  SEN_15:'Sadio Mané',SEN_2:'Édouard Mendy',
  EGV_17:'Mohamed Salah',EGV_20:'Omar Marmoush',
  KOR_18:'Son Heung-min',KOR_4:'Kim Min-jae',
  JPN_12:'Takefusa Kubo',
  SWE_19:'Alexander Isak',SWE_20:'Viktor Gyökeres',
  AUT_4:'David Alaba',
  ALG_15:'Riyad Mahrez',ALG_8:'Ismaël Bennacer',
  TUR_14:'Arda Güler',TUR_20:'Kenan Yıldız',
  SCO_6:'Andrew Robertson',SCO_11:'Scott McTominay',
  GHA_10:'Thomas Partey',GHA_14:'Mohammed Kudus',
  CAN_3:'Alphonso Davies',CAN_20:'Jonathan David',
  USA_16:'Christian Pulisic',
  ECU_9:'Moisés Caicedo',ECU_20:'Enner Valencia',
}

const photoCache: Record<string, string | null> = {}

async function fetchWikiPhoto(team: string, num: number): Promise<string | null> {
  const key = `${team}_${num}`
  if (key in photoCache) return photoCache[key]
  const wikiName = WIKI_NAMES[key]
  if (!wikiName) { photoCache[key] = null; return null }
  try {
    const title = encodeURIComponent(wikiName)
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&pithumbsize=200&origin=*`)
    if (!res.ok) { photoCache[key] = null; return null }
    const data = await res.json()
    const pages = data?.query?.pages
    const page = pages ? Object.values(pages)[0] as {thumbnail?: {source: string}} : null
    const url = page?.thumbnail?.source || null
    photoCache[key] = url
    return url
  } catch {
    photoCache[key] = null
    return null
  }
}

interface StickerCardProps {
  team: string
  num: number
  valor: number
  onClick: () => void
  onRepClick: (e: React.MouseEvent) => void
}

export default function StickerCard({ team, num, valor, onClick, onRepClick }: StickerCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoLoaded, setPhotoLoaded] = useState(false)
  const observed = useRef(false)

  const isTengo = valor >= 1
  const isRep = valor >= 2
  const rep = valor - 1
  const iso = TEAM_ISO[team]
  const grad = TEAM_GRAD[team] || 'linear-gradient(135deg,#374151,#1f2937)'
  const playerName = PLAYERS[team]?.[num] || ''

  useEffect(() => {
    const el = ref.current
    if (!el || observed.current) return
    observed.current = true

    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect()
        const url = await fetchWikiPhoto(team, num)
        if (url) setPhotoUrl(url)
      }
    }, { rootMargin: '150px' })

    observer.observe(el)
    return () => observer.disconnect()
  }, [team, num])

  return (
    <div
      ref={ref}
      onClick={onClick}
      title={`${team} ${num}${playerName ? ' — ' + playerName : ''}`}
      className="relative flex flex-col items-center justify-end overflow-hidden transition-all duration-150"
      style={{
        width: 'clamp(70px, calc((100vw - 80px) / 4), 90px)',
        height: 'clamp(98px, calc((100vw - 80px) / 4 * 1.4), 126px)',
        borderRadius: 10,
        background: grad,
        border: isTengo
          ? isRep ? '3px solid #d97706' : '3px solid #16a34a'
          : '2px solid rgba(0,0,0,0.08)',
        boxShadow: isTengo
          ? isRep ? '0 0 0 1px #d97706, 0 3px 10px rgba(217,119,6,0.25)' : '0 0 0 1px #16a34a, 0 3px 10px rgba(22,163,74,0.2)'
          : '0 1px 3px rgba(0,0,0,0.1)',
        filter: isTengo ? 'none' : 'brightness(0.55) saturate(0.15) grayscale(0.4)',
        cursor: 'pointer',
      }}
    >
      {/* Foto de jugador */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt={playerName}
          onLoad={() => setPhotoLoaded(true)}
          onError={() => setPhotoUrl(null)}
          className="absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-300"
          style={{ opacity: photoLoaded ? 1 : 0 }}
        />
      )}

      {/* Badges */}
      {isTengo && !isRep && (
        <span className="absolute top-1 right-1.5 text-green-300 text-xs font-black z-10" style={{ textShadow: '0 0 6px rgba(74,222,128,0.8)' }}>✓</span>
      )}
      {isRep && (
        <span className="absolute top-0 right-0 bg-amber-400 text-black text-[9px] font-black px-1 py-0.5 z-10" style={{ borderRadius: '0 9px 0 6px' }}>x{rep}</span>
      )}
      {isTengo && (
        <button
          onClick={onRepClick}
          className="absolute top-1.5 left-1.5 bg-black/60 text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-amber-500/70 z-10"
          style={{ lineHeight: 1 }}
        >
          {isRep ? `+${rep}` : '+'}
        </button>
      )}
      {!isTengo && (
        <span className="absolute top-1 left-1.5 text-white text-xs font-black z-10" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{num}</span>
      )}

      {/* Banda inferior */}
      <div
        className="relative z-10 w-full flex flex-col items-center gap-0.5 pb-1.5 pt-3"
        style={{ background: 'linear-gradient(0deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.65) 60%,transparent 100%)' }}
      >
        <span className="text-white font-black leading-none" style={{ fontSize: 18, letterSpacing: -1, textShadow: '0 1px 5px rgba(0,0,0,0.6)' }}>{num}</span>
        {playerName && (
          <span className="text-white/90 font-semibold text-center leading-tight" style={{ fontSize: 6.5, maxWidth: 54, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
            {playerName}
          </span>
        )}
        <div className="flex items-center gap-1">
          {iso && <img src={`https://flagicons.lipis.dev/flags/4x3/${iso}.svg`} className="object-cover rounded-sm" style={{ width: 14, height: 10 }} alt="" onError={e => (e.currentTarget.style.display='none')} />}
          <span className="text-white/80 font-bold uppercase" style={{ fontSize: 6.5, letterSpacing: '0.06em' }}>{team}</span>
        </div>
      </div>
    </div>
  )
}
