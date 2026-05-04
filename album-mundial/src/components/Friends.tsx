'use client'
import { useState, useEffect, useCallback } from 'react'
import { GROUPS, TEAM_FULL, TEAM_ISO, PLAYERS } from '@/lib/data'
import type { StickerState } from '@/lib/data'

interface Profile {
  id: string
  name: string
  email: string
  avatar_url?: string
  figuritas?: StickerState
}

interface PendingFriend {
  friendshipId: string
  id: string
  name: string
  email: string
}

interface Match {
  team: string
  num: number
  playerName: string
  type: 'give' | 'receive' // give: vos tenés repetida, él le falta / receive: él tiene repetida, te falta a vos
  friendName: string
  friendId: string
}

interface FriendsProps {
  myState: StickerState
  onClose: () => void
  onMatchCount?: (count: number) => void
}

export default function Friends({ myState, onClose, onMatchCount }: FriendsProps) {
  const [friends, setFriends] = useState<Profile[]>([])
  const [pendingReceived, setPendingReceived] = useState<PendingFriend[]>([])
  const [pendingSent, setPendingSent] = useState<Profile[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'matches'|'friends'|'search'>('matches')

  const stateKey = (t: string, n: number) => `${t}_${n}`

  const loadFriends = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/friends')
    const data = await res.json()
    setFriends(data.friends || [])
    setPendingReceived(data.pendingReceived || [])
    setPendingSent(data.pendingSent || [])

    // Calcular matches
    const allMatches: Match[] = []
    ;(data.friends || []).forEach((friend: Profile) => {
      if (!friend.figuritas) return
      const friendState = friend.figuritas

      // Mis repetidas que a él le faltan → puedo darle
      GROUPS.forEach(g => {
        Object.entries(g.teams).forEach(([team, count]) => {
          Array.from({length: count}, (_, i) => i + 1).forEach(n => {
            const myVal = myState[stateKey(team, n)] || 0
            const friendVal = friendState[stateKey(team, n)] || 0
            const playerName = PLAYERS[team]?.[n] || `${team} ${n}`

            // Yo tengo repetida y a él le falta
            if (myVal >= 2 && friendVal === 0) {
              allMatches.push({ team, num: n, playerName, type: 'give', friendName: friend.name, friendId: friend.id })
            }
            // Él tiene repetida y a mí me falta
            if (friendVal >= 2 && myVal === 0) {
              allMatches.push({ team, num: n, playerName, type: 'receive', friendName: friend.name, friendId: friend.id })
            }
          })
        })
      })
    })
    setMatches(allMatches)
    onMatchCount?.(allMatches.length)
    setLoading(false)
  }, [myState])

  useEffect(() => { loadFriends() }, [loadFriends])

  const handleSearch = async () => {
    if (!searchQ.trim()) return
    setSearching(true)
    const res = await fetch(`/api/profiles?q=${encodeURIComponent(searchQ)}`)
    const data = await res.json()
    setSearchResults(data.profiles || [])
    setSearching(false)
  }

  const sendRequest = async (addressee_id: string) => {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', addressee_id })
    })
    setSearchResults(r => r.filter(p => p.id !== addressee_id))
    loadFriends()
  }

  const acceptFriend = async (friendship_id: string) => {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', friendship_id })
    })
    loadFriends()
  }

  const rejectFriend = async (friendship_id: string) => {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', friendship_id })
    })
    loadFriends()
  }

  const givingMatches = matches.filter(m => m.type === 'give')
  const receivingMatches = matches.filter(m => m.type === 'receive')

  const iso = (team: string) => TEAM_ISO[team]

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 text-base">👥 Amigos</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {[
          { key: 'matches', label: `🎯 Matches${matches.length > 0 ? ` (${matches.length})` : ''}` },
          { key: 'friends', label: `👥 Amigos${friends.length > 0 ? ` (${friends.length})` : ''}` },
          { key: 'search', label: '🔍 Buscar' },
        ].map(t => (
          <button key={t.key} onClick={() => setView(t.key as typeof view)}
            className={`flex-1 py-3 text-xs font-semibold transition border-b-2 ${
              view === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* MATCHES */}
        {view === 'matches' && (
          <div className="p-4 flex flex-col gap-4">
            {loading && <p className="text-sm text-center text-gray-400 py-8">Calculando matches...</p>}

            {!loading && friends.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-sm font-semibold text-gray-700">Todavía no tenés amigos</p>
                <p className="text-xs text-gray-400 mt-1">Buscalos en la pestaña "Buscar"</p>
              </div>
            )}

            {!loading && friends.length > 0 && matches.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-sm font-semibold text-gray-700">No hay matches por ahora</p>
                <p className="text-xs text-gray-400 mt-1">Los matches aparecen cuando podés darle o pedirle una figurita a un amigo</p>
              </div>
            )}

            {givingMatches.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📤 Podés darle a un amigo ({givingMatches.length})</h3>
                <div className="flex flex-col gap-2">
                  {givingMatches.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                      {iso(m.team) && (
                        <img src={`https://flagicons.lipis.dev/flags/4x3/${iso(m.team)}.svg`}
                          className="w-8 h-6 object-cover rounded-sm flex-shrink-0" alt={m.team}
                          onError={e => (e.currentTarget.style.display='none')} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900">{m.team} {m.num} — {m.playerName}</div>
                        <div className="text-xs text-green-700">Para <span className="font-semibold">{m.friendName}</span></div>
                      </div>
                      <span className="text-green-600 text-lg">✓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {receivingMatches.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📥 Podés pedirle a un amigo ({receivingMatches.length})</h3>
                <div className="flex flex-col gap-2">
                  {receivingMatches.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                      {iso(m.team) && (
                        <img src={`https://flagicons.lipis.dev/flags/4x3/${iso(m.team)}.svg`}
                          className="w-8 h-6 object-cover rounded-sm flex-shrink-0" alt={m.team}
                          onError={e => (e.currentTarget.style.display='none')} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900">{m.team} {m.num} — {m.playerName}</div>
                        <div className="text-xs text-blue-700"><span className="font-semibold">{m.friendName}</span> la tiene repetida</div>
                      </div>
                      <span className="text-blue-500 text-lg">↓</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AMIGOS */}
        {view === 'friends' && (
          <div className="p-4 flex flex-col gap-4">
            {/* Solicitudes recibidas */}
            {pendingReceived.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Solicitudes recibidas ({pendingReceived.length})</h3>
                <div className="flex flex-col gap-2">
                  {pendingReceived.map(p => (
                    <div key={p.friendshipId} className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                      <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center text-sm font-bold text-amber-800">
                        {p.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400 truncate">{p.email}</div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => acceptFriend(p.friendshipId)}
                          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg">
                          Aceptar
                        </button>
                        <button onClick={() => rejectFriend(p.friendshipId)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">
                          No
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amigos aceptados */}
            {friends.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Mis amigos ({friends.length})</h3>
                <div className="flex flex-col gap-2">
                  {friends.map(f => {
                    const fTotal = Object.values(f.figuritas || {}).filter(v => v >= 1).length
                    const fRep = Object.values(f.figuritas || {}).reduce((a, v) => a + Math.max(0, v-1), 0)
                    const myMatchCount = matches.filter(m => m.friendId === f.id).length
                    return (
                      <div key={f.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                          {f.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{f.name}</div>
                          <div className="text-xs text-gray-400">{fTotal} figuritas · {fRep} repetidas</div>
                        </div>
                        {myMatchCount > 0 && (
                          <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">
                            {myMatchCount} match{myMatchCount !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Solicitudes enviadas */}
            {pendingSent.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Solicitudes enviadas</h3>
                <div className="flex flex-col gap-2">
                  {pendingSent.map(p => p && (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 opacity-60">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                        {p.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-700">{p.name}</div>
                        <div className="text-xs text-gray-400">Pendiente...</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-sm font-semibold text-gray-700">Todavía no tenés amigos</p>
                <p className="text-xs text-gray-400 mt-1">Buscalos por nombre o email</p>
                <button onClick={() => setView('search')} className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl">
                  Buscar amigos
                </button>
              </div>
            )}
          </div>
        )}

        {/* BUSCAR */}
        {view === 'search' && (
          <div className="p-4 flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Nombre, apellido o email..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400"
                autoFocus
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:bg-gray-300"
              >
                {searching ? '...' : 'Buscar'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {searchResults.map(p => {
                  const isFriend = friends.some(f => f.id === p.id)
                  const isPendingSent = pendingSent.some(f => f?.id === p.id)
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                        {p.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400 truncate">{p.email}</div>
                      </div>
                      {isFriend ? (
                        <span className="text-xs text-green-600 font-semibold">✓ Amigo</span>
                      ) : isPendingSent ? (
                        <span className="text-xs text-gray-400">Pendiente</span>
                      ) : (
                        <button onClick={() => sendRequest(p.id)}
                          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg">
                          + Agregar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {searchResults.length === 0 && searchQ && !searching && (
              <p className="text-sm text-center text-gray-400 py-4">No se encontraron usuarios</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
