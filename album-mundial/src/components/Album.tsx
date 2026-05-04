'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { GROUPS, TEAM_FULL, TEAM_ISO, TEAM_GRAD, PLAYERS } from '@/lib/data'
import type { StickerState } from '@/lib/data'
import Scanner from './Scanner'
import StickerCard from './StickerCard'

const GROUP_COLORS: Record<string, { bg: string; text: string; bar: string; border: string }> = {
  'Grupo A': { bg:'#fef2f2', text:'#991b1b', bar:'#ef4444', border:'#fca5a5' },
  'Grupo B': { bg:'#fff7ed', text:'#9a3412', bar:'#f97316', border:'#fdba74' },
  'Grupo C': { bg:'#fefce8', text:'#854d0e', bar:'#eab308', border:'#fde047' },
  'Grupo D': { bg:'#f0fdf4', text:'#14532d', bar:'#22c55e', border:'#86efac' },
  'Grupo E': { bg:'#ecfdf5', text:'#064e3b', bar:'#10b981', border:'#6ee7b7' },
  'Grupo F': { bg:'#ecfeff', text:'#164e63', bar:'#06b6d4', border:'#67e8f9' },
  'Grupo G': { bg:'#eff6ff', text:'#1e3a8a', bar:'#3b82f6', border:'#93c5fd' },
  'Grupo H': { bg:'#f5f3ff', text:'#4c1d95', bar:'#8b5cf6', border:'#c4b5fd' },
  'Grupo I': { bg:'#fdf4ff', text:'#701a75', bar:'#d946ef', border:'#e879f9' },
  'Grupo J': { bg:'#fff1f2', text:'#881337', bar:'#f43f5e', border:'#fda4af' },
  'Grupo K': { bg:'#fff7ed', text:'#7c2d12', bar:'#fb923c', border:'#fed7aa' },
  'Grupo L': { bg:'#f0fdf4', text:'#1a2e05', bar:'#65a30d', border:'#a3e635' },
  'Especiales': { bg:'#f8fafc', text:'#334155', bar:'#64748b', border:'#cbd5e1' },
}

interface ScannedResult { team: string; num: number }

export default function Album({ user }: { user: User }) {
  const supabase = createClient()
  const [state, setState] = useState<StickerState>({})
  const [saveStatus, setSaveStatus] = useState<'saved'|'saving'|'error'>('saved')
  const [editMode, setEditMode] = useState(false)
  const [curFilter, setCurFilter] = useState<'all'|'tengo'|'falta'|'repetida'>('all')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showScanner, setShowScanner] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [repPopover, setRepPopover] = useState<{ team: string; num: number } | null>(null)
  const [scannedResult, setScannedResult] = useState<ScannedResult | null>(null)
  // Carga rápida
  const [showQuickLoad, setShowQuickLoad] = useState(false)
  const [quickTeam, setQuickTeam] = useState('')
  const [quickNums, setQuickNums] = useState('')
  const saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    fetch('/api/figuritas')
      .then(r => r.json())
      .then(d => { if (d.state) setState(d.state) })
  }, [])

  const saveOne = useCallback(async (team: string, num: number, valor: number) => {
    setSaveStatus('saving')
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        await fetch('/api/figuritas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team, num, valor })
        })
        setSaveStatus('saved')
      } catch { setSaveStatus('error') }
    }, 400)
  }, [])

  const stateKey = (t: string, n: number) => `${t}_${n}`

  const toggleSticker = (team: string, num: number) => {
    if (!editMode) return
    const k = stateKey(team, num)
    const v = state[k] || 0
    const newVal = v === 0 ? 1 : 0
    if (newVal === 0) {
      setState(s => { const n2 = { ...s }; delete n2[k]; return n2 })
    } else {
      setState(s => ({ ...s, [k]: newVal }))
    }
    saveOne(team, num, newVal)
  }

  const handleRepBtn = (team: string, num: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editMode) return
    const k = stateKey(team, num)
    const v = state[k] || 0
    const rep = v - 1
    if (rep === 0) {
      const newVal = 2
      setState(s => ({ ...s, [k]: newVal }))
      saveOne(team, num, newVal)
    } else {
      setRepPopover({ team, num })
    }
  }

  const changeRep = (delta: number) => {
    if (!repPopover) return
    const { team, num } = repPopover
    const k = stateKey(team, num)
    const v = state[k] || 0
    const rep = Math.max(0, v - 1)
    const newRep = Math.max(0, Math.min(5, rep + delta))
    const newVal = newRep + 1
    setState(s => ({ ...s, [k]: newVal }))
    saveOne(team, num, newVal)
  }

  // Scanner: cuando detecta cierra el scanner y muestra la figurita
  const handleScanDetect = (team: string, num: number) => {
    setShowScanner(false)
    setScannedResult({ team, num })
  }

  // Confirmar figurita escaneada
  const handleScanConfirm = () => {
    if (!scannedResult) return
    const { team, num } = scannedResult
    const k = stateKey(team, num)
    const v = state[k] || 0
    const newVal = v === 0 ? 1 : v + 1
    setState(s => ({ ...s, [k]: newVal }))
    saveOne(team, num, newVal)
    setScannedResult(null)
    setShowScanner(true) // vuelve al scanner
  }

  const handleScanCancel = () => {
    setScannedResult(null)
    setShowScanner(true) // vuelve al scanner
  }

  // Carga rápida
  const handleQuickLoad = () => {
    if (!quickTeam || !quickNums) return
    const nums = quickNums.split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 1 && n <= 20)
    if (nums.length === 0) return
    const updates: Record<string, number> = {}
    nums.forEach(num => {
      const k = stateKey(quickTeam, num)
      const v = state[k] || 0
      updates[k] = v === 0 ? 1 : v + 1
      saveOne(quickTeam, num, updates[k])
    })
    setState(s => ({ ...s, ...updates }))
    setQuickNums('')
  }

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const total = GROUPS.reduce((a, g) => a + Object.values(g.teams).reduce((b, c) => b + c, 0), 0)
  const tengo = Object.values(state).filter(v => v >= 1).length
  const repetidas = Object.values(state).reduce((a, v) => a + Math.max(0, v - 1), 0)

  const isVisible = (team: string, num: number) => {
    const k = stateKey(team, num)
    const v = state[k] || 0
    const isTengo = v >= 1
    const isRep = v >= 2
    if (curFilter === 'tengo' && !isTengo) return false
    if (curFilter === 'falta' && isTengo) return false
    if (curFilter === 'repetida' && !isRep) return false
    if (search) {
      const q = search.toUpperCase().replace(/\s/g, '')
      const teamName = (TEAM_FULL[team] || '').toUpperCase().replace(/\s/g, '')
      if (!`${team}${num}`.includes(q) && !teamName.includes(q) && !team.includes(q)) return false
    }
    return true
  }

  const repCount = repPopover ? Math.max(0, (state[stateKey(repPopover.team, repPopover.num)] || 1) - 1) : 0

  // Figurita escaneada — datos
  const scanTeam = scannedResult?.team || ''
  const scanNum = scannedResult?.num || 0
  const scanPlayer = scanTeam && scanNum ? (PLAYERS[scanTeam]?.[scanNum] || '') : ''
  const scanGrad = scanTeam ? (TEAM_GRAD[scanTeam] || '') : ''
  const scanIso = scanTeam ? (TEAM_ISO[scanTeam] || null) : null
  const scanV = scannedResult ? (state[stateKey(scanTeam, scanNum)] || 0) : 0
  const scanStatus = scanV === 0 ? '✅ Se marcará como tengo'
    : scanV === 1 ? '🔁 Ya la tenés — quedará como repetida x1'
    : `🔁 Ya tenés ${scanV-1} repetida${scanV > 2 ? 's' : ''} — quedará x${scanV}`

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Álbum Copa 2026 🏆</h1>
            <p className={`text-xs mt-0.5 ${saveStatus === 'saved' ? 'text-green-600' : saveStatus === 'error' ? 'text-red-500' : 'text-amber-500'}`}>
              {saveStatus === 'saved' ? '● Guardado' : saveStatus === 'saving' ? '● Guardando...' : '● Error al guardar'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Total', val: total, cls: 'text-gray-900' },
              { label: 'Tengo', val: tengo, cls: 'text-green-600' },
              { label: 'Falta', val: total - tengo, cls: 'text-red-500' },
              { label: 'Rep.', val: repetidas, cls: 'text-amber-500' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-center min-w-[60px]">
                <div className={`text-lg font-bold ${s.cls}`}>{s.val}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Ej: ARG 17, Messi, Brasil..."
            className="flex-1 min-w-[150px] text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs bg-gray-100 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-200">✕</button>
          )}
          {(['all','tengo','falta','repetida'] as const).map(f => (
            <button key={f} onClick={() => setCurFilter(f)}
              className={`text-xs px-3 py-2 rounded-lg border font-medium transition ${
                curFilter === f
                  ? f === 'all' ? 'bg-gray-100 border-gray-400 text-gray-900'
                  : f === 'tengo' ? 'bg-green-50 border-green-400 text-green-700'
                  : f === 'falta' ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-amber-50 border-amber-400 text-amber-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {f === 'all' ? 'Todas' : f === 'tengo' ? 'Tengo' : f === 'falta' ? 'Me falta' : 'Repetidas'}
            </button>
          ))}
        </div>
      </div>

      {/* Groups */}
      <div className="px-3 pt-3 flex flex-col gap-3">
        {GROUPS.map(g => {
          const gc = GROUP_COLORS[g.name] || GROUP_COLORS['Especiales']
          const gid = g.name.replace(/\s/g, '')
          const teamEntries = Object.entries(g.teams)
          const hasVisible = teamEntries.some(([team, count]) =>
            Array.from({ length: count }, (_, i) => i + 1).some(n => isVisible(team, n))
          )
          if ((search || curFilter !== 'all') && !hasVisible) return null
          const gTotal = teamEntries.reduce((a, [, c]) => a + c, 0)
          const gHave = teamEntries.reduce((a, [team, count]) =>
            a + Array.from({ length: count }, (_, i) => i + 1).filter(n => (state[stateKey(team, n)] || 0) >= 1).length, 0)
          const pct = Math.round(gHave / gTotal * 100)

          return (
            <div key={g.name} className="rounded-xl border overflow-hidden" style={{ borderColor: gc.border }}>
              <button
                onClick={() => setCollapsed(c => ({ ...c, [gid]: !c[gid] }))}
                className="w-full flex items-center justify-between px-4 py-2.5"
                style={{ background: gc.bg }}
              >
                <span className="text-sm font-semibold" style={{ color: gc.text }}>{g.name}</span>
                <span className="text-xs" style={{ color: gc.text }}>{gHave}/{gTotal}</span>
              </button>
              <div className="h-1 bg-gray-100">
                <div className="h-1 transition-all" style={{ width: `${pct}%`, background: gc.bar }} />
              </div>

              {!collapsed[gid] && (
                <div className="flex flex-wrap gap-4 p-3 justify-center">
                  {teamEntries.map(([team, count]) => {
                    const nums = Array.from({ length: count }, (_, i) => i + 1)
                    const visibleNums = nums.filter(n => isVisible(team, n))
                    if ((search || curFilter !== 'all') && visibleNums.length === 0) return null
                    const iso = TEAM_ISO[team]
                    const grad = TEAM_GRAD[team] || 'linear-gradient(135deg,#374151,#1f2937)'

                    return (
                      <div key={team} className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {iso && <img src={`https://flagicons.lipis.dev/flags/4x3/${iso}.svg`} className="w-4 h-3 rounded-sm object-cover" alt={team} onError={e => (e.currentTarget.style.display='none')} />}
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{team} — {TEAM_FULL[team]}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-start">
                          {nums.map(n => {
                            if ((search || curFilter !== 'all') && !isVisible(team, n)) return null
                            const k = stateKey(team, n)
                            const v = state[k] || 0
                            return (
                              <StickerCard
                                key={n}
                                team={team}
                                num={n}
                                valor={v}
                                editMode={editMode}
                                onClick={() => toggleSticker(team, n)}
                                onRepClick={(e) => handleRepBtn(team, n, e)}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around px-4 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setEditMode(e => !e)}
          className={`flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition ${editMode ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={editMode ? '#b45309' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span className={`text-[10px] font-semibold ${editMode ? 'text-amber-700' : 'text-gray-500'}`}>Editar</span>
        </button>

        <button
          onClick={() => setShowScanner(true)}
          className="w-14 h-14 rounded-full bg-gray-900 flex items-center justify-center shadow-lg hover:bg-gray-700 transition -mt-5"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </button>

        <div className="relative">
          <button onClick={() => setShowMenu(m => !m)} className="flex flex-col items-center gap-1 px-5 py-2 rounded-xl hover:bg-gray-50 transition">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span className="text-[10px] font-semibold text-gray-500">Menú</span>
          </button>
          {showMenu && (
            <div className="absolute bottom-14 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
              <button onClick={() => { setShowQuickLoad(true); setShowMenu(false) }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 font-medium text-gray-900">⚡ Carga rápida</button>
              <div className="h-px bg-gray-100" />
              <button onClick={() => { exportTengo(); setShowMenu(false) }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50">📩 Compartir las que tengo</button>
              <button onClick={() => { exportFaltantes(); setShowMenu(false) }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50">📩 Compartir faltantes</button>
              <button onClick={() => { exportRepetidas(); setShowMenu(false) }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50">📩 Compartir repetidas</button>
              <div className="h-px bg-gray-100" />
              <button onClick={logout} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 text-gray-500">Cerrar sesión</button>
              <div className="h-px bg-gray-100" />
              <button onClick={() => { if (confirm('¿Reiniciar todo el álbum?') && confirm('¿Estás seguro?')) resetAll(); setShowMenu(false) }} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50">Reiniciar álbum</button>
            </div>
          )}
        </div>
      </nav>

      {showMenu && <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />}

      {/* Rep Popover */}
      {repPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRepPopover(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 flex flex-col items-center gap-3 min-w-[200px]" onClick={e => e.stopPropagation()}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Repetidas</div>
            <div className="text-sm font-semibold text-gray-900 text-center max-w-[160px] truncate">
              {repPopover.team} {repPopover.num}{PLAYERS[repPopover.team]?.[repPopover.num] ? ' — ' + PLAYERS[repPopover.team][repPopover.num] : ''}
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => changeRep(-1)} className="w-12 h-12 rounded-xl border border-red-200 bg-red-50 text-red-700 text-2xl font-bold hover:bg-red-100 transition">−</button>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-gray-900">{repCount}</span>
                <span className="text-xs text-gray-400">repetidas</span>
              </div>
              <button onClick={() => changeRep(+1)} className="w-12 h-12 rounded-xl border border-green-200 bg-green-50 text-green-700 text-2xl font-bold hover:bg-green-100 transition">+</button>
            </div>
            <button onClick={() => setRepPopover(null)} className="text-xs text-gray-400 border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50">Listo</button>
          </div>
        </div>
      )}

      {/* Carga rápida */}
      {showQuickLoad && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowQuickLoad(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-md p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base">⚡ Carga rápida de sobre</h3>
              <button onClick={() => setShowQuickLoad(false)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
            </div>
            <p className="text-xs text-gray-500">Seleccioná el equipo y escribí los números separados por coma. Ej: <span className="font-mono bg-gray-100 px-1 rounded">3, 7, 15, 17</span></p>
            
            {/* Selector de equipo */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Equipo</label>
              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
                {Object.keys(PLAYERS).map(team => {
                  const iso = TEAM_ISO[team]
                  return (
                    <button
                      key={team}
                      onClick={() => setQuickTeam(team)}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-xs font-bold transition ${
                        quickTeam === team
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 hover:border-gray-400 text-gray-600'
                      }`}
                    >
                      {iso && <img src={`https://flagicons.lipis.dev/flags/4x3/${iso}.svg`} className="w-6 h-4 object-cover rounded-sm" alt={team} onError={e => (e.currentTarget.style.display='none')} />}
                      <span>{team}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Input de números */}
            {quickTeam && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Números de {TEAM_FULL[quickTeam] || quickTeam}
                </label>
                <input
                  value={quickNums}
                  onChange={e => setQuickNums(e.target.value)}
                  placeholder="Ej: 3, 7, 15, 17"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 font-mono"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleQuickLoad() }}
                />
              </div>
            )}

            <button
              onClick={handleQuickLoad}
              disabled={!quickTeam || !quickNums}
              className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition disabled:bg-gray-200 disabled:text-gray-400"
            >
              ✓ Marcar figuritas
            </button>
          </div>
        </div>
      )}

      {/* Figurita escaneada — modal de confirmación */}
      {scannedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-xs flex flex-col shadow-2xl">
            {/* Carta grande */}
            <div className="relative flex flex-col items-center justify-end overflow-hidden" style={{
              height: 220,
              background: scanGrad,
            }}>
              {scanIso && (
                <img
                  src={`https://flagicons.lipis.dev/flags/4x3/${scanIso}.svg`}
                  className="absolute top-4 left-1/2 -translate-x-1/2 object-cover rounded"
                  style={{ width: 48, height: 34 }}
                  alt={scanTeam}
                  onError={e => (e.currentTarget.style.display='none')}
                />
              )}
              <div className="absolute top-4 right-4 text-white text-4xl font-black" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{scanNum}</div>
              <div className="relative z-10 w-full flex flex-col items-center gap-1 pb-4 pt-8"
                style={{ background: 'linear-gradient(0deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.6) 60%,transparent 100%)' }}>
                <span className="text-white font-black text-2xl leading-none" style={{ textShadow: '0 1px 5px rgba(0,0,0,0.6)' }}>{scanNum}</span>
                <span className="text-white font-bold text-base text-center px-4">{scanPlayer || scanTeam}</span>
                <div className="flex items-center gap-2 mt-1">
                  {scanIso && <img src={`https://flagicons.lipis.dev/flags/4x3/${scanIso}.svg`} className="object-cover rounded-sm" style={{ width: 20, height: 14 }} alt="" />}
                  <span className="text-white/80 font-bold text-sm uppercase">{scanTeam} — {TEAM_FULL[scanTeam]}</span>
                </div>
              </div>
            </div>

            {/* Info y acciones */}
            <div className="p-4 flex flex-col gap-3">
              <p className={`text-sm text-center font-medium ${scanV === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {scanStatus}
              </p>
              <div className="flex gap-2">
                <button onClick={handleScanCancel} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  ✕ Cancelar
                </button>
                <button onClick={handleScanConfirm} className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition">
                  ✓ Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner */}
      {showScanner && (
        <Scanner state={state} onDetect={handleScanDetect} onClose={() => setShowScanner(false)} />
      )}
    </div>
  )

  function exportRepetidas() {
    const flags: Record<string, string> = {
      MEX:'🇲🇽',RSA:'🇿🇦',KOR:'🇰🇷',CZE:'🇨🇿',CAN:'🇨🇦',BIH:'🇧🇦',QAT:'🇶🇦',SUI:'🇨🇭',
      BRA:'🇧🇷',MAR:'🇲🇦',HAI:'🇭🇹',SCO:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',USA:'🇺🇸',PAR:'🇵🇾',AUS:'🇦🇺',TUR:'🇹🇷',
      GER:'🇩🇪',CUW:'🇨🇼',CIV:'🇨🇮',ECU:'🇪🇨',NED:'🇳🇱',JPN:'🇯🇵',SWE:'🇸🇪',TUN:'🇹🇳',
      BEL:'🇧🇪',EGV:'🇪🇬',IRN:'🇮🇷',NZL:'🇳🇿',ESP:'🇪🇸',CPV:'🇨🇻',KSA:'🇸🇦',URU:'🇺🇾',
      FRA:'🇫🇷',SEN:'🇸🇳',IRQ:'🇮🇶',NOR:'🇳🇴',ARG:'🇦🇷',ALG:'🇩🇿',AUT:'🇦🇹',JOR:'🇯🇴',
      POR:'🇵🇹',COD:'🇨🇩',UZB:'🇺🇿',COL:'🇨🇴',ENG:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',CRO:'🇭🇷',GHA:'🇬🇭',PAN:'🇵🇦',
      FWC:'🏆',OO:'📋',CC:'⭐'
    }
    const lines: string[] = ['🏆 *Mis figuritas repetidas - Copa del Mundo 2026*\n']
    let total = 0
    GROUPS.forEach(g => {
      const rep: string[] = []
      Object.entries(g.teams).forEach(([team, count]) => {
        Array.from({length: count}, (_, i) => i + 1).forEach(n => {
          const v = state[stateKey(team, n)] || 0
          if (v >= 2) {
            const cant = v - 1
            const flag = flags[team] || ''
            const player = PLAYERS[team]?.[n] ? ` (${PLAYERS[team][n]})` : ''
            rep.push(`${flag} ${team} ${n}${player} x${cant}`)
            total += cant
          }
        })
      })
      if (rep.length) lines.push(`*${g.name}*\n${rep.join('\n')}`)
    })
    if (total === 0) { alert('No tenés figuritas repetidas todavía.'); return }
    lines.push(`\n_Total: ${total} repetida${total !== 1 ? 's' : ''}_`)
    const text = lines.join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      if (/android|iphone|ipad/i.test(navigator.userAgent)) {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      } else {
        alert('✓ Texto copiado. Podés pegarlo en WhatsApp.')
      }
    })
  }

  function exportFaltantes() {
    const flags: Record<string, string> = {
      MEX:'🇲🇽',RSA:'🇿🇦',KOR:'🇰🇷',CZE:'🇨🇿',CAN:'🇨🇦',BIH:'🇧🇦',QAT:'🇶🇦',SUI:'🇨🇭',
      BRA:'🇧🇷',MAR:'🇲🇦',HAI:'🇭🇹',SCO:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',USA:'🇺🇸',PAR:'🇵🇾',AUS:'🇦🇺',TUR:'🇹🇷',
      GER:'🇩🇪',CUW:'🇨🇼',CIV:'🇨🇮',ECU:'🇪🇨',NED:'🇳🇱',JPN:'🇯🇵',SWE:'🇸🇪',TUN:'🇹🇳',
      BEL:'🇧🇪',EGV:'🇪🇬',IRN:'🇮🇷',NZL:'🇳🇿',ESP:'🇪🇸',CPV:'🇨🇻',KSA:'🇸🇦',URU:'🇺🇾',
      FRA:'🇫🇷',SEN:'🇸🇳',IRQ:'🇮🇶',NOR:'🇳🇴',ARG:'🇦🇷',ALG:'🇩🇿',AUT:'🇦🇹',JOR:'🇯🇴',
      POR:'🇵🇹',COD:'🇨🇩',UZB:'🇺🇿',COL:'🇨🇴',ENG:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',CRO:'🇭🇷',GHA:'🇬🇭',PAN:'🇵🇦',
      FWC:'🏆',OO:'📋',CC:'⭐'
    }
    const lines: string[] = ['🏆 *Me faltan estas figuritas - Copa del Mundo 2026*\n']
    let total = 0
    GROUPS.forEach(g => {
      const falt: string[] = []
      Object.entries(g.teams).forEach(([team, count]) => {
        const nums = Array.from({length: count}, (_, i) => i + 1)
          .filter(n => !(state[stateKey(team, n)]))
        if (nums.length) {
          falt.push(`${flags[team] || ''} ${team}: ${nums.join(', ')}`)
          total += nums.length
        }
      })
      if (falt.length) lines.push(`*${g.name}*\n${falt.join('\n')}`)
    })
    if (total === 0) { alert('¡Tenés el álbum completo! 🎉'); return }
    lines.push(`\n_Me faltan ${total} figurita${total !== 1 ? 's' : ''}_`)
    const text = lines.join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      if (/android|iphone|ipad/i.test(navigator.userAgent)) {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      } else {
        alert('✓ Texto copiado. Podés pegarlo en WhatsApp.')
      }
    })
  }

  function exportTengo() {
    const flags: Record<string, string> = {
      MEX:'🇲🇽',RSA:'🇿🇦',KOR:'🇰🇷',CZE:'🇨🇿',CAN:'🇨🇦',BIH:'🇧🇦',QAT:'🇶🇦',SUI:'🇨🇭',
      BRA:'🇧🇷',MAR:'🇲🇦',HAI:'🇭🇹',SCO:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',USA:'🇺🇸',PAR:'🇵🇾',AUS:'🇦🇺',TUR:'🇹🇷',
      GER:'🇩🇪',CUW:'🇨🇼',CIV:'🇨🇮',ECU:'🇪🇨',NED:'🇳🇱',JPN:'🇯🇵',SWE:'🇸🇪',TUN:'🇹🇳',
      BEL:'🇧🇪',EGV:'🇪🇬',IRN:'🇮🇷',NZL:'🇳🇿',ESP:'🇪🇸',CPV:'🇨🇻',KSA:'🇸🇦',URU:'🇺🇾',
      FRA:'🇫🇷',SEN:'🇸🇳',IRQ:'🇮🇶',NOR:'🇳🇴',ARG:'🇦🇷',ALG:'🇩🇿',AUT:'🇦🇹',JOR:'🇯🇴',
      POR:'🇵🇹',COD:'🇨🇩',UZB:'🇺🇿',COL:'🇨🇴',ENG:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',CRO:'🇭🇷',GHA:'🇬🇭',PAN:'🇵🇦',
      FWC:'🏆',OO:'📋',CC:'⭐'
    }
    const lines: string[] = ['🏆 *Mis figuritas - Copa del Mundo 2026*\n']
    let total = 0
    GROUPS.forEach(g => {
      const tengoList: string[] = []
      Object.entries(g.teams).forEach(([team, count]) => {
        const nums = Array.from({length: count}, (_, i) => i + 1)
          .filter(n => (state[stateKey(team, n)] || 0) >= 1)
        if (nums.length) {
          tengoList.push(`${flags[team] || ''} ${team}: ${nums.join(', ')}`)
          total += nums.length
        }
      })
      if (tengoList.length) lines.push(`*${g.name}*\n${tengoList.join('\n')}`)
    })
    if (total === 0) { alert('Todavía no tenés ninguna figurita.'); return }
    lines.push(`\n_Total: ${total} figurita${total !== 1 ? 's' : ''}_`)
    const text = lines.join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      if (/android|iphone|ipad/i.test(navigator.userAgent)) {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      } else {
        alert('✓ Texto copiado. Podés pegarlo en WhatsApp.')
      }
    })
  }

  async function resetAll() {
    setState({})
    await fetch('/api/figuritas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true })
    })
  }
}
