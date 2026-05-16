'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { PLAYERS, TEAM_FULL, TEAM_ISO } from '@/lib/data'
import type { StickerState } from '@/lib/data'

interface DetectedSticker {
  team: string
  num: number
  selected: boolean
}

interface BatchScannerProps {
  state: StickerState
  onConfirm: (stickers: { team: string; num: number }[]) => void
  onClose: () => void
}

function captureFrame(video: HTMLVideoElement): string {
  const w = video.videoWidth > 0 ? video.videoWidth : 1280
  const h = video.videoHeight > 0 ? video.videoHeight : 960
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(video, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

export default function BatchScanner({ state, onConfirm, onClose }: BatchScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<'camera' | 'review'>('camera')
  const [detected, setDetected] = useState<DetectedSticker[]>([])
  const [scanning, setScanning] = useState(false)
  const [camStatus, setCamStatus] = useState('Iniciando cámara...')
  const [cameraReady, setCameraReady] = useState(false)
  const [rawText, setRawText] = useState('')

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraReady(false)
    const constraints = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 1920 } } },
      { video: { facingMode: 'environment' } },
      { video: true },
    ]
    for (const c of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c)
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          // Esperar a que el video reporte dimensiones reales (necesario en iOS)
          if (videoRef.current.videoWidth === 0) {
            await new Promise<void>(resolve => {
              const t = setTimeout(resolve, 2000)
              videoRef.current!.addEventListener('loadedmetadata', () => {
                clearTimeout(t); resolve()
              }, { once: true })
            })
          }
        }
        setCamStatus('Poné las figuritas boca abajo y capturá')
        setCameraReady(true)
        return
      } catch {}
    }
    setCamStatus('No se pudo acceder a la cámara')
  }, [])

  useEffect(() => {
    startCamera()
    return () => stopStream()
  }, [startCamera, stopStream])

  const capture = useCallback(async () => {
    if (scanning) return
    if (!videoRef.current) { setCamStatus('Cámara no lista, reintentá'); return }
    setScanning(true)
    setCamStatus('Capturando...')
    try {
      const base64 = captureFrame(videoRef.current)
      setCamStatus('Enviando a analizar...')
      const res = await fetch('/api/scan-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      setCamStatus('Procesando respuesta...')
      const data = await res.json()
      const stickers: { team: string; num: number }[] = data.stickers || []
      const raw: string = data.raw || data.error || '(sin texto)'
      stopStream()
      setRawText(raw)
      setDetected(stickers.map(s => ({ ...s, selected: true })))
      setPhase('review')
    } catch (e) {
      setCamStatus(`Error: ${e instanceof Error ? e.message : e}`)
    }
    setScanning(false)
  }, [scanning, stopStream])

  const retry = () => {
    setDetected([])
    setRawText('')
    setPhase('camera')
    startCamera()
  }

  const toggle = (idx: number) =>
    setDetected(d => d.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s))

  const selectedCount = detected.filter(s => s.selected).length

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">📷 Escanear varias</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        {phase === 'camera' ? (
          <div className="relative bg-black flex-1 min-h-0">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

            {/* Guía visual */}
            {!scanning && (
              <div className="absolute inset-x-4 top-4 bottom-24 border-2 border-dashed border-white/40 rounded-2xl flex items-center justify-center pointer-events-none">
                <span className="text-white/70 text-sm font-medium text-center px-6">
                  Extendé las figuritas boca abajo aquí
                </span>
              </div>
            )}

            {/* Spinner al analizar */}
            {scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                <span className="text-white text-sm font-semibold">{camStatus}</span>
              </div>
            )}

            {/* Botón capturar siempre visible sobre la cámara */}
            <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col items-center gap-2"
              style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>
              {!scanning && (
                <span className="text-white/60 text-xs">{camStatus}</span>
              )}
              <button
                onClick={capture}
                disabled={scanning}
                className="w-full py-4 bg-white text-gray-900 rounded-2xl text-base font-bold active:scale-95 transition disabled:opacity-50"
              >
                {scanning ? '⏳ Procesando...' : '📷 Capturar'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {detected.length === 0 ? 'No se detectaron figuritas' : `${selectedCount} seleccionada${selectedCount !== 1 ? 's' : ''}`}
              </span>
              <button onClick={retry} className="text-xs text-blue-500 underline">Reintentar</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {detected.length === 0 ? (
                <div className="py-4 flex flex-col gap-2">
                  <p className="text-sm text-center text-gray-500">
                    El OCR no encontró códigos de figuritas.<br />
                    <span className="text-xs text-gray-400">Probá mostrar el reverso más cerca o con mejor luz.</span>
                  </p>
                  {rawText ? (
                    <div className="mt-2 bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 font-semibold mb-1 uppercase tracking-wide">Texto detectado por OCR:</p>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">{rawText}</pre>
                    </div>
                  ) : (
                    <p className="text-xs text-center text-gray-400">El OCR no detectó ningún texto en la imagen.</p>
                  )}
                </div>
              ) : (
                detected.map((s, i) => {
                  const playerName = PLAYERS[s.team]?.[s.num] || `${s.team} ${s.num}`
                  const iso = TEAM_ISO[s.team]
                  const current = state[`${s.team}_${s.num}`] || 0
                  return (
                    <button
                      key={i}
                      onClick={() => toggle(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                        s.selected ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'
                      }`}
                    >
                      {iso && (
                        <img src={`https://flagicons.lipis.dev/flags/4x3/${iso}.svg`}
                          className="w-8 h-6 object-cover rounded-sm flex-shrink-0" alt={s.team}
                          onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold ${s.selected ? 'text-white' : 'text-gray-900'}`}>
                          {s.team} {s.num} — {TEAM_FULL[s.team] || s.team}
                        </div>
                        <div className="text-xs text-gray-400 truncate">{playerName}</div>
                      </div>
                      {current > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          s.selected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {current === 1 ? 'ya tenés' : `×${current - 1} rep`}
                        </span>
                      )}
                      <span className={`text-base flex-shrink-0 ${s.selected ? 'text-white' : 'text-gray-300'}`}>
                        {s.selected ? '✓' : '○'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {detected.length > 0 && (
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => onConfirm(detected.filter(s => s.selected).map(({ team, num }) => ({ team, num })))}
                  disabled={selectedCount === 0}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition disabled:bg-gray-300"
                >
                  {selectedCount > 0 ? `Guardar ${selectedCount} figurita${selectedCount !== 1 ? 's' : ''}` : 'Seleccioná al menos una'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
