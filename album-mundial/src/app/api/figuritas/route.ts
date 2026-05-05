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
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            } catch {}
          })
        },
      },
    }
  )
}

export async function GET() {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('figuritas').select('team, num, valor').eq('user_id', user.id)
  const state: Record<string, number> = {}
  data?.forEach((r: { team: string; num: number; valor: number }) => {
    state[`${r.team}_${r.num}`] = r.valor
  })
  return NextResponse.json({ state })
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (body.reset) {
    await supabase.from('figuritas').delete().eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  }
  const { team, num, valor, delta } = body
  if (delta !== undefined) {
    const { data: row } = await supabase
      .from('figuritas')
      .select('valor')
      .eq('user_id', user.id)
      .eq('team', team)
      .eq('num', num)
      .maybeSingle()
    const newValor = Math.max(0, (row?.valor ?? 0) + delta)
    if (newValor === 0) {
      await supabase.from('figuritas').delete().eq('user_id', user.id).eq('team', team).eq('num', num)
    } else {
      await supabase.from('figuritas').upsert(
        { user_id: user.id, team, num, valor: newValor, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,team,num' }
      )
    }
  } else if (valor === 0) {
    await supabase.from('figuritas').delete().eq('user_id', user.id).eq('team', team).eq('num', num)
  } else {
    await supabase.from('figuritas').upsert(
      { user_id: user.id, team, num, valor, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,team,num' }
    )
  }
  return NextResponse.json({ ok: true })
}
