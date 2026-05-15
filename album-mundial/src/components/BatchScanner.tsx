'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { PLAYERS, TEAM_FULL, TEAM_ISO } from '@/lib/data'
import type { StickerState } from '@/lib/data'
import { parseStickerText } from '@/lib/parseSticker'

interface ScannedItem { team: string; num: number }

interface BatchScannerProps {
  state: StickerState
  onConfirm: (stickers: ScannedItem[]) => void
  onClose: () => void
}

async function callVision(base64: string): Promise<string> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return (data.text || 'NONE').trim().toUpperCase()
}

function captureFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d')!.drawImage(video, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
}

export default function BatchScanner({ state, onConfirm, onClose }: BatchScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const busyRef = useRef(false)

  const [scanned, setScanned] = useState<ScannedItem[]>([])
  const [status, setStatus] = useState('Iniciando cámara...')
  const [flashKey, setFlashKey] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [reviewing, setReviewing] = useState(false)

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }, [])

  const addSticker = useCallback((team: string, num: number) => {
    setScanned(prev => {
      if (prev.some(s => s.team === team && s.num === num)) return prev
      return [...prev, { team, num }]
    })
    setFlashKey(k => k + 1)
  }, [])

  const autoScan = useCallback(async () => {
    if (busyRef.current || !videoRef.current?.videoWidth) return
    busyRef.current = true
    setAttempts(a => a + 1)
    try {
      const base64 = captureFrame(videoRef.current!)
      const text = await callVision(base64)
      if (text && text !== 'NONE') {
        const parsed = parseStickerText(text)
        if (parsed) addSticker(parsed.team, parsed.num)
      }
    } catch {}
    busyRef.current = false
  }, [addSticker])

  const startCamera = useCallback(async () => {
    busyRef.current = false
    const constraints = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 } } },
      { video: { facingMode: 'environment' } },
      { video: { facingMode: { ideal: 'environment' } } },
      { video: true },
    ]
    for (const c of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c)
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('Mostrá el reverso de cada figurita una por una')
        setTimeout(() => {
          autoScan()
          intervalRef.current = setInterval(autoScan, 2500)
        }, 1500)
        return
      } catch {}
    }
    setStatus('No se pudo acceder a la cámara')
  }, [autoScan])

  // Arranca/reinicia cámara cada vez que se sale de la pantalla de revisión
  useEffect(() => {
    if (!reviewing) {
      startCamera()
    }
    return () => stopCamera()
  }, [reviewing, startCamera, stopCamera])

  const removeSticker = (idx: number) => setScanned(prev => prev.filter((_, i) => i !== idx))

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">📷 Escaneo rápido</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        {!reviewing ? (
          <>
            {/* Cámara */}
            <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

              {/* Marco de escaneo */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute" style={{ top: '6%', right: '4%', width: '44%', height: '18%' }}>
                  <div className="absolute inset-0" style={{
                    border: '2.5px solid #22c55e',
                    borderRadius: 10,
                    boxShadow: '0 0 0 2000px rgba(0,0,0,0.5)'
                  }} />
                  <div className="absolute top-0 left-0 w-5 h-5 border-l-[3px] border-t-[3px] border-green-400 rounded-tl-lg" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-r-[3px] border-b-[3px] border-green-400 rounded-br-lg" />
                </div>
                <div className="absolute text-white/80 text-xs font-medium bg-black/50 px-2 py-1 rounded-lg" style={{ top: '26%', right: '4%' }}>
                  Código aquí ↗
                </div>
              </div>

              {/* Flash verde al detectar */}
              {flashKey > 0 && (
                <div key={flashKey} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-green-500/90 text-white font-bold text-lg px-6 py-3 rounded-2xl shadow-lg" style={{ animation: 'fadeOut 1.2s forwards' }}>
                    ✓ Detectada
                  </div>
                </div>
              )}

              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/80 text-xs">Intento {attempts}</span>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-2">
              <p className="text-xs text-center text-gray-500">{status}</p>

              {/* Chips de figuritas detectadas */}
              {scanned.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {scanned.map((s, i) => {
                    const iso = TEAM_ISO[s.team]
                    return (
                      <button
                        key={i}
                        onClick={() => removeSticker(i)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-red-100 hover:text-red-600 transition"
                        title="Tocar para quitar"
                      >
                        {iso && <img src={`https://flagicons.lipis.dev/flags/4x3/${iso}.svg`} className="w-4 h-3 object-cover rounded-sm" alt="" onError={e => (e.currentTarget.style.display='none')} />}
                        {s.team} {s.num} <span className="text-gray-400">✕</span>
                      </button>
                    )
                  })}
                </div>
              )}

              <button
                onClick={() => { stopCamera(); setReviewing(true) }}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition"
              >
                {scanned.length > 0
                  ? `Listo — revisar ${scanned.length} figurita${scanned.length !== 1 ? 's' : ''}`
                  : 'Listo'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {scanned.length} figurita{scanned.length !== 1 ? 's' : ''} para guardar
              </span>
              <button
                onClick={() => setReviewing(false)}
                className="text-xs text-gray-400 underline"
              >
                Seguir escaneando
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {scanned.length === 0 && (
                <p className="text-sm text-center text-gray-400 py-8">No hay figuritas escaneadas</p>
              )}
              {scanned.map((s, i) => {
                const playerName = PLAYERS[s.team]?.[s.num] || `${s.team} ${s.num}`
                const iso = TEAM_ISO[s.team]
                const current = state[`${s.team}_${s.num}`] || 0
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50">
                    {iso && (
                      <img
                        src={`https://flagicons.lipis.dev/flags/4x3/${iso}.svg`}
                        className="w-8 h-6 object-cover rounded-sm flex-shrink-0"
                        alt={s.team}
                        onError={e => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900">{s.team} {s.num} — {TEAM_FULL[s.team] || s.team}</div>
                      <div className="text-xs text-gray-400 truncate">{playerName}</div>
                    </div>
                    {current > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                        {current === 1 ? 'ya tenés' : `×${current - 1} rep`}
                      </span>
                    )}
                    <button onClick={() => removeSticker(i)} className="text-gray-300 hover:text-red-400 transition text-lg leading-none flex-shrink-0">✕</button>
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => onConfirm(scanned)}
                disabled={scanned.length === 0}
                className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition disabled:bg-gray-300"
              >
                {scanned.length > 0
                  ? `Guardar ${scanned.length} figurita${scanned.length !== 1 ? 's' : ''}`
                  : 'Nada para guardar'}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeOut {
          0% { opacity: 1; transform: scale(1); }
          70% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.9); }
        }
      `}</style>
    </div>
  )
}
