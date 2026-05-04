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

  const friendIds = friendships
    .filter(f => f.status === 'accepted')
    .map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)

  const pendingReceived = friendships
    .filter(f => f.status === 'pending' && f.addressee_id === user.id)
    .map(f => f.requester_id)

  const pendingSent = friendships
    .filter(f => f.status === 'pending' && f.requester_id === user.id)
    .map(f => f.addressee_id)

  // Obtener perfiles
  const allIds = [...friendIds, ...pendingReceived, ...pendingSent]
  let profiles: {id: string, email: string, name: string}[] = []
  if (allIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, email, name').in('id', allIds)
    profiles = data || []
  }

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))

  return NextResponse.json({
    friends: friendIds.map(id => ({ ...profileMap[id], friendship_id: friendships.find(f => (f.requester_id === id || f.addressee_id === id) && f.status === 'accepted')?.id })),
    pendingReceived: pendingReceived.map(id => ({ ...profileMap[id], friendship_id: friendships.find(f => f.requester_id === id)?.id })),
    pendingSent: pendingSent.map(id => profileMap[id]),
  })
}

// POST — enviar solicitud, aceptar, o buscar usuario
export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Buscar usuario por email
  if (body.action === 'search') {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name')
      .ilike('email', `%${body.email}%`)
      .neq('id', user.id)
      .limit(5)
    return NextResponse.json({ results: data || [] })
  }

  // Enviar solicitud
  if (body.action === 'request') {
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: body.addressee_id,
      status: 'pending'
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // Aceptar solicitud
  if (body.action === 'accept') {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', body.friendship_id)
      .eq('addressee_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // Eliminar amistad
  if (body.action === 'remove') {
    await supabase.from('friendships').delete().eq('id', body.friendship_id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
