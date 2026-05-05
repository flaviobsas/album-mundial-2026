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
  const [view, setView] = useState<'friends'|'search'>('friends')
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null)

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
          { key: 'friends', label: `👥 Amigos${friends.length > 0 ? ` (${friends.length})` : ''}${pendingReceived.length > 0 ? ` 🔴` : ''}` },
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
            {loading && <p className="text-sm text-center text-gray-400 py-8">Cargando...</p>}
            {!loading && friends.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Mis amigos ({friends.length})</h3>
                <div className="flex flex-col gap-2">
                  {friends.map(f => {
                    const fTotal = Object.values(f.figuritas || {}).filter(v => v >= 1).length
                    const fRep = Object.values(f.figuritas || {}).reduce((a, v) => a + Math.max(0, v-1), 0)
                    const myMatchCount = matches.filter(m => m.friendId === f.id).length
                    const isExpanded = expandedFriendId === f.id
                    const friendGive = isExpanded ? matches.filter(m => m.friendId === f.id && m.type === 'give') : []
                    const friendReceive = isExpanded ? matches.filter(m => m.friendId === f.id && m.type === 'receive') : []
                    return (
                      <div key={f.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 bg-gray-50 px-3 py-2.5 text-left"
                          onClick={() => setExpandedFriendId(isExpanded ? null : f.id)}
                        >
                          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                            {f.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-gray-900 truncate">{f.name}</div>
                            <div className="text-xs text-gray-400">{fTotal} figuritas · {fRep} repetidas</div>
                          </div>
                          {myMatchCount > 0 && (
                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0">
                              {myMatchCount} 🎯
                            </span>
                          )}
                          <span className="text-gray-300 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gray-200 bg-white px-3 py-3 flex flex-col gap-3">
                            {myMatchCount === 0 && (
                              <p className="text-xs text-gray-400 text-center py-1">Sin matches con {f.name}</p>
                            )}
                            {friendGive.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">📤 Podés darle ({friendGive.length})</p>
                                <div className="flex flex-col gap-1.5">
                                  {friendGive.map((m, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-green-50 rounded-lg px-2.5 py-2">
                                      {iso(m.team) && (
                                        <img src={`https://flagicons.lipis.dev/flags/4x3/${iso(m.team)}.svg`}
                                          className="w-6 h-4 object-cover rounded-sm flex-shrink-0" alt={m.team}
                                          onError={e => (e.currentTarget.style.display = 'none')} />
                                      )}
                                      <span className="text-xs font-semibold text-gray-800 flex-shrink-0">{m.team} {m.num}</span>
                                      <span className="text-xs text-gray-500 truncate">{m.playerName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {friendReceive.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">📥 Te puede dar ({friendReceive.length})</p>
                                <div className="flex flex-col gap-1.5">
                                  {friendReceive.map((m, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-blue-50 rounded-lg px-2.5 py-2">
                                      {iso(m.team) && (
                                        <img src={`https://flagicons.lipis.dev/flags/4x3/${iso(m.team)}.svg`}
                                          className="w-6 h-4 object-cover rounded-sm flex-shrink-0" alt={m.team}
                                          onError={e => (e.currentTarget.style.display = 'none')} />
                                      )}
                                      <span className="text-xs font-semibold text-gray-800 flex-shrink-0">{m.team} {m.num}</span>
                                      <span className="text-xs text-gray-500 truncate">{m.playerName}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
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
          <div className="p-4 flex flex-col gap-3">
            <p className="text-xs text-gray-500">Buscá por nombre, apellido o email. Tu amigo recibirá una solicitud que debe aceptar.</p>
            <div className="relative">
              <input
                value={searchQ}
                onChange={e => {
                  setSearchQ(e.target.value)
                  if (e.target.value.length >= 2) {
                    clearTimeout((window as unknown as {_searchTimeout: ReturnType<typeof setTimeout>})._searchTimeout)
                    ;(window as unknown as {_searchTimeout: ReturnType<typeof setTimeout>})._searchTimeout = setTimeout(() => {
                      handleSearch()
                    }, 400)
                  } else {
                    setSearchResults([])
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Ej: Federico García o fede@gmail.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 pr-10"
                autoFocus
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {searchResults.map(p => {
                  const isFriend = friends.some(f => f.id === p.id)
                  const isPendingSent = pendingSent.some(f => f?.id === p.id)
                  const isPendingReceived = pendingReceived.some(f => f.id === p.id)
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-3 shadow-sm">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-600 flex-shrink-0">
                        {p.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400 truncate">{p.email}</div>
                      </div>
                      {isFriend ? (
                        <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-lg">✓ Amigo</span>
                      ) : isPendingReceived ? (
                        <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-lg">Te mandó solicitud</span>
                      ) : isPendingSent ? (
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">Solicitud enviada</span>
                      ) : (
                        <button
                          onClick={() => sendRequest(p.id)}
                          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition"
                        >
                          + Agregar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {searchResults.length === 0 && searchQ.length >= 2 && !searching && (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">No se encontraron usuarios con ese nombre o email</p>
              </div>
            )}

            {searchQ.length < 2 && (
              <div className="text-center py-6 text-gray-300 text-4xl">🔍</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
