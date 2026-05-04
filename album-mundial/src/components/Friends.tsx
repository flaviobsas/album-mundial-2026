'use client'
import { useState, useEffect } from 'react'
import { TEAM_FULL, TEAM_ISO, PLAYERS } from '@/lib/data'
import type { Match } from '@/app/api/matches/route'

interface Friend { id: string; email: string; name: string; friendship_id: string }

export default function Friends({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'matches'|'friends'>('matches')
  const [matches, setMatches] = useState<Match[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingReceived, setPendingReceived] = useState<Friend[]>([])
  const [pendingSent, setPendingSent] = useState<{id:string,email:string,name:string}[]>([])
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResults, setSearchResults] = useState<{id:string,email:string,name:string}[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [matchRes, friendRes] = await Promise.all([
      fetch('/api/matches').then(r => r.json()),
      fetch('/api/friends').then(r => r.json()),
    ])
    setMatches(matchRes.matches || [])
    setFriends(friendRes.friends || [])
    setPendingReceived(friendRes.pendingReceived || [])
    setPendingSent(friendRes.pendingSent || [])
    setLoading(false)
  }

  async function search() {
    if (!searchEmail.trim()) return
    setSearching(true)
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', email: searchEmail })
    })
    const data = await res.json()
    setSearchResults(data.results || [])
    setSearching(false)
  }

  async function sendRequest(addressee_id: string) {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request', addressee_id })
    })
    setSearchResults([])
    setSearchEmail('')
    loadAll()
  }

  async function accept(friendship_id: string) {
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', friendship_id })
    })
    loadAll()
  }

  async function remove(friendship_id: string) {
    if (!confirm('¿Eliminar este amigo?')) return
    await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', friendship_id })
    })
    loadAll()
  }

  const totalMatches = matches.reduce((a, m) => a + m.iCanGive.length + m.theyCanGive.length, 0)

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 text-base">👥 Amigos & Matches</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab('matches')}
          className={`flex-1 py-3 text-sm font-semibold transition ${tab === 'matches' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'}`}
        >
          🎯 Matches {totalMatches > 0 && <span className="ml-1 bg-green-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{totalMatches}</span>}
        </button>
        <button
          onClick={() => setTab('friends')}
          className={`flex-1 py-3 text-sm font-semibold transition ${tab === 'friends' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400'}`}
        >
          👤 Amigos {pendingReceived.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingReceived.length}</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
          </div>
        ) : tab === 'matches' ? (
          <MatchesTab matches={matches} friends={friends} />
        ) : (
          <FriendsTab
            friends={friends}
            pendingReceived={pendingReceived}
            pendingSent={pendingSent}
            searchEmail={searchEmail}
            setSearchEmail={setSearchEmail}
            searchResults={searchResults}
            searching={searching}
            onSearch={search}
            onSendRequest={sendRequest}
            onAccept={accept}
            onRemove={remove}
          />
        )}
      </div>
    </div>
  )
}

function MatchesTab({ matches, friends }: { matches: Match[], friends: Friend[] }) {
  const hasMatches = matches.some(m => m.iCanGive.length > 0 || m.theyCanGive.length > 0)

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3 px-8 text-center">
        <div className="text-4xl">👥</div>
        <p className="text-gray-500 text-sm">Agregá amigos para ver los matches automáticos</p>
      </div>
    )
  }

  if (!hasMatches) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3 px-8 text-center">
        <div className="text-4xl">🔍</div>
        <p className="text-gray-500 text-sm">No hay matches todavía — seguí completando el álbum</p>
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {matches.map(match => {
        if (match.iCanGive.length === 0 && match.theyCanGive.length === 0) return null
        return (
          <div key={match.friendId} className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 text-sm">{match.friendName}</div>
                <div className="text-xs text-gray-400">{match.friendEmail}</div>
              </div>
              <div className="flex gap-2">
                {match.iCanGive.length > 0 && (
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-lg">
                    ↑ {match.iCanGive.length} le doy
                  </span>
                )}
                {match.theyCanGive.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">
                    ↓ {match.theyCanGive.length} me da
                  </span>
                )}
              </div>
            </div>

            {match.iCanGive.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="text-xs font-semibold text-green-700 mb-2">📤 Yo le puedo dar:</div>
                <div className="flex flex-wrap gap-1.5">
                  {match.iCanGive.map(({ team, num }) => (
                    <StickerChip key={`${team}_${num}`} team={team} num={num} color="green" />
                  ))}
                </div>
              </div>
            )}

            {match.theyCanGive.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="text-xs font-semibold text-blue-700 mb-2">📥 Él/ella me puede dar:</div>
                <div className="flex flex-wrap gap-1.5">
                  {match.theyCanGive.map(({ team, num }) => (
                    <StickerChip key={`${team}_${num}`} team={team} num={num} color="blue" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StickerChip({ team, num, color }: { team: string; num: number; color: 'green'|'blue' }) {
  const iso = TEAM_ISO[team]
  const player = PLAYERS[team]?.[num]
  const cls = color === 'green'
    ? 'bg-green-50 border-green-200 text-green-800'
    : 'bg-blue-50 border-blue-200 text-blue-800'

  return (
    <div className={`flex items-center gap-1 border rounded-lg px-2 py-1 text-xs font-semibold ${cls}`}>
      {iso && <img src={`https://flagicons.lipis.dev/flags/4x3/${iso}.svg`} className="w-4 h-3 object-cover rounded-sm" alt="" onError={e => (e.currentTarget.style.display='none')} />}
      <span>{team} {num}</span>
      {player && <span className="text-[10px] opacity-70 hidden sm:inline">· {player}</span>}
    </div>
  )
}

function FriendsTab({
  friends, pendingReceived, pendingSent,
  searchEmail, setSearchEmail, searchResults, searching,
  onSearch, onSendRequest, onAccept, onRemove
}: {
  friends: Friend[]
  pendingReceived: Friend[]
  pendingSent: {id:string,email:string,name:string}[]
  searchEmail: string
  setSearchEmail: (v: string) => void
  searchResults: {id:string,email:string,name:string}[]
  searching: boolean
  onSearch: () => void
  onSendRequest: (id: string) => void
  onAccept: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Buscar amigo */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agregar amigo</div>
        <div className="flex gap-2">
          <input
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            placeholder="Email del amigo..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
          />
          <button
            onClick={onSearch}
            disabled={searching}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:bg-gray-300"
          >
            {searching ? '...' : 'Buscar'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
            {searchResults.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">{r.name || r.email}</div>
                  <div className="text-xs text-gray-400">{r.email}</div>
                </div>
                <button onClick={() => onSendRequest(r.id)} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg font-semibold">
                  Agregar
                </button>
              </div>
            ))}
          </div>
        )}

        {searchResults.length === 0 && searchEmail && !searching && (
          <p className="text-xs text-gray-400 mt-2 text-center">No se encontraron usuarios con ese email</p>
        )}
      </div>

      {/* Solicitudes recibidas */}
      {pendingReceived.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Solicitudes recibidas</div>
          <div className="flex flex-col gap-2">
            {pendingReceived.map(f => (
              <div key={f.id} className="flex items-center justify-between border border-red-100 bg-red-50 rounded-xl px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{f.name || f.email}</div>
                  <div className="text-xs text-gray-400">{f.email}</div>
                </div>
                <button onClick={() => onAccept(f.friendship_id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-semibold">
                  Aceptar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solicitudes enviadas */}
      {pendingSent.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Solicitudes enviadas</div>
          <div className="flex flex-col gap-2">
            {pendingSent.map(f => (
              <div key={f.id} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{f.name || f.email}</div>
                  <div className="text-xs text-gray-400">{f.email}</div>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Pendiente</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amigos */}
      {friends.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mis amigos</div>
          <div className="flex flex-col gap-2">
            {friends.map((f: Friend) => (
              <div key={f.id} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{f.name || f.email}</div>
                  <div className="text-xs text-gray-400">{f.email}</div>
                </div>
                <button onClick={() => onRemove(f.friendship_id)} className="text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
          <div className="text-4xl">👥</div>
          <p className="text-gray-500 text-sm">Buscá amigos por email para empezar a hacer matches</p>
        </div>
      )}
    </div>
  )
}
