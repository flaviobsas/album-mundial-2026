import { createServerSupabase } from '@/lib/supabase-server'
import Album from '@/components/Album'
import Login from '@/components/Login'

export default async function Home() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <Login />
  return <Album user={user} />
}
