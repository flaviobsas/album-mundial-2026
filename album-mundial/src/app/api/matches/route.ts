import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { GROUPS } from '@/lib/data'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs: CookieToSet[]) {
          cs.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]) } catch {}
          })
        },
      },
    }
  )
}

export interface Match {
  friendId: string
  friendName: string
  friendEmail: string
  // Yo le puedo dar (tengo repetida, a él le falta)
  iCanGive: { team: string; num: number }[]
  // Él me puede dar (él tiene repetida, a mí me falta)
  theyCanGive: { team: string; num: number }[]
}

export async function GET() {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Obtener amigos aceptados
  const { data: friendships } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted')

  if (!friendships || friendships.length === 0) return NextResponse.json({ matches: [] })

  const friendIds = friendships.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)

  // Obtener perfiles de amigos
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, name')
    .in('id', friendIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  // Obtener mis figuritas
  const { data: myFigs } = await supabase
    .from('figuritas')
    .select('team, num, valor')
    .eq('user_id', user.id)

  // Obtener figuritas de todos los amigos
  const { data: friendFigs } = await supabase
    .from('figuritas')
    .select('user_id, team, num, valor')
    .in('user_id', friendIds)

  // Construir sets
  const myState: Record<string, number> = {}
  myFigs?.forEach(f => { myState[`${f.team}_${f.num}`] = f.valor })

  const friendStates: Record<string, Record<string, number>> = {}
  friendIds.forEach(id => { friendStates[id] = {} })
  friendFigs?.forEach(f => { friendStates[f.user_id][`${f.team}_${f.num}`] = f.valor })

  // Calcular todos los códigos posibles
  const allStickers: { team: string; num: number }[] = []
  GROUPS.forEach(g => {
    Object.entries(g.teams).forEach(([team, count]) => {
      for (let i = 1; i <= count; i++) allStickers.push({ team, num: i })
    })
  })

  const matches: Match[] = friendIds.map(friendId => {
    const friendState = friendStates[friendId]
    const profile = profileMap[friendId]

    const iCanGive: { team: string; num: number }[] = []
    const theyCanGive: { team: string; num: number }[] = []

    allStickers.forEach(({ team, num }) => {
      const k = `${team}_${num}`
      const myVal = myState[k] || 0
      const friendVal = friendState[k] || 0

      // Yo tengo repetida y a él le falta
      if (myVal >= 2 && friendVal === 0) iCanGive.push({ team, num })
      // Él tiene repetida y a mí me falta
      if (friendVal >= 2 && myVal === 0) theyCanGive.push({ team, num })
    })

    return {
      friendId,
      friendName: profile?.name || profile?.email || 'Amigo',
      friendEmail: profile?.email || '',
      iCanGive,
      theyCanGive,
    }
  })

  return NextResponse.json({ matches })
}
