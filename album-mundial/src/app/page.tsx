import { createServerSupabase } from '@/lib/supabase-server'
import Album from '@/components/Album'
import Login from '@/components/Login'

export default async function Home() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <Login />

  // Verificar si tiene perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', user.id)
    .single()

  return <Album user={user} hasProfile={!!profile} userName={profile?.name ?? ''} />
}
