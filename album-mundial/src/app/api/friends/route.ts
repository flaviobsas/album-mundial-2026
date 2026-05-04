import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

// GET — listar amigos y solicitudes pendientes
export async function GET() {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Amigos aceptados
  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, status, requester_id, addressee_id')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  if (!friendships) return NextResponse.json({ friends: [], pending: [] })

  const accepted = friendships.filter(f => f.status === 'accepted')
  const pending = friendships.filter(f => f.status === 'pending')

  // Obtener IDs de amigos
  const friendIds = accepted.map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  )
  const pendingReceivedIds = pending
    .filter(f => f.addressee_id === user.id)
    .map(f => ({ id: f.requester_id, friendshipId: f.id }))
  const pendingSentIds = pending
    .filter(f => f.requester_id === user.id)
    .map(f => f.addressee_id)

  // Obtener perfiles
  const allIds = [...friendIds, ...pendingReceivedIds.map(p => p.id), ...pendingSentIds]
  let profiles: Record<string, {id:string;name:string;email:string;avatar_url:string}> = {}
  if (allIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', allIds)
    profileData?.forEach(p => { profiles[p.id] = p })
  }

  // Obtener figuritas de amigos
  const friendFiguritas: Record<string, Record<string, number>> = {}
  if (friendIds.length > 0) {
    const { data: figs } = await supabase
      .from('figuritas')
      .select('user_id, team, num, valor')
      .in('user_id', friendIds)
    figs?.forEach(f => {
      if (!friendFiguritas[f.user_id]) friendFiguritas[f.user_id] = {}
      friendFiguritas[f.user_id][`${f.team}_${f.num}`] = f.valor
    })
  }

  return NextResponse.json({
    friends: friendIds.map(id => ({
      ...profiles[id],
      figuritas: friendFiguritas[id] || {}
    })),
    pendingReceived: pendingReceivedIds.map(p => ({
      ...profiles[p.id],
      friendshipId: p.friendshipId,
    })),
    pendingSent: pendingSentIds.map(id => profiles[id]).filter(Boolean)
  })
}

// POST — enviar solicitud o aceptar
export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'request') {
    const { addressee_id } = body
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id, status: 'pending' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'accept') {
    const { friendship_id } = body
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendship_id)
      .eq('addressee_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'reject') {
    const { friendship_id } = body
    await supabase.from('friendships').delete().eq('id', friendship_id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
