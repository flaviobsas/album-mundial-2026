'use client'
import { useState } from 'react'
import type { User } from '@supabase/supabase-js'

interface OnboardingProps {
  user: User
  onComplete: () => void
}

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [name, setName] = useState(user.user_metadata?.full_name || '')
  const [email, setEmail] = useState(user.email || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          avatar_url: user.user_metadata?.avatar_url || null
        })
      })
      if (!res.ok) throw new Error('Error al guardar')
      onComplete()
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm flex flex-col gap-5">
        <div className="text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-xl font-bold text-gray-900">¡Bienvenido al Álbum!</h1>
          <p className="text-sm text-gray-500 mt-1">Completá tu perfil para poder buscar amigos e intercambiar figuritas</p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nombre y apellido</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Flavio Smurra"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              type="email"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500 text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition disabled:bg-gray-300"
        >
          {saving ? 'Guardando...' : 'Comenzar →'}
        </button>
      </div>
    </div>
  )
}
