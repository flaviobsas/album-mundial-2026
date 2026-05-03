'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { GROUPS, PLAYERS } from '@/lib/data'
import type { StickerState } from '@/lib/data'

interface ScanResult { team: string; num: number }

interface ScannerProps {
  state: StickerState
  onConfirm: (team: string, num: number) => void
  onClose: () => void
}

export default function Scanner({ state, onConfirm, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const scanningRef = useRef(false)

  const [status, setStatus] = useState('Iniciando cámara...')
  const [statusType, setStatusType] = useState<'idle'|'processing'|'success'|'error'>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [attempts, setAttempts] = useState(0)

  const setMsg = (msg: string, type: typeof statusType) => {
    setStatus(msg); setStatusType(type)
  }

  const parseResult = (text: string): ScanResult | null => {
    const m = text.match(/\b([A-Z]{2,3})\s*(\d{1,2})\b/)
    if (!m) return null
    const team = m[1], num = parseInt(m[2])
    if (!PLAYERS[team]) return null
    const groupEntry = GROUPS.flatMap(g => Object.entries(g.teams)).find(([t]) => t === team)
    if (!groupEntry || num < 1 || num > groupEntry[1]) return null
    return { team, num }
  }

  const captureAndScan = useCallback(async () => {
    if (scanningRef.current || !videoRef.current) return
    const video = videoRef.current
    if (!video.videoWidth || !video.videoHeight) return

    scanningRef.current = true
    setAttempts(a => a + 1)

    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')!
    ctx.filter = 'contrast(1.3) brightness(1.1)'
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1]

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      })
      const data = await res.json()
      const text = (data.text || '').trim().toUpperCase()

      if (text && text !== 'NONE') {
        const parsed = parseResult(text)
        if (parsed) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setResult(parsed)
          setMsg('¡Figurita detectada!', 'success')
        }
      }
    } catch {}

    scanningRef.current = false
  }, [])

  const startCamera = useCallback(async () => {
    const constraints = [
      { video: { facingMode: { exact: 'environment' } } },
      { video: { facingMode: 'environment' } },
      { video: { facingMode: { ideal: 'environment' } } },
      { video: true }
    ]
    for (const c of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c)
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setMsg('Apuntá al número de la figurita', 'idle')
        intervalRef.current = setInterval(captureAndScan, 2500)
        return
      } catch {}
    }
    setMsg('No se pudo acceder a la cámara', 'error')
  }, [captureAndScan])

  useEffect(() => {
    startCamera()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [startCamera])

  const handleManual = () => {
    setMsg('Escaneando...', 'processing')
    captureAndScan()
  }

  const handleConfirm = () => {
    if (!result) return
    onConfirm(result.team, result.num)
    setResult(null)
    setMsg('Apuntá al número de la figurita', 'idle')
    scanningRef.current = false
    intervalRef.current = setInterval(captureAndScan, 2500)
  }

  const handleRetry = () => {
    setResult(null)
    setMsg('Apuntá al número de la figurita', 'idle')
    scanningRef.current = false
    intervalRef.current = setInterval(captureAndScan, 2500)
  }

  const playerName = result ? (PLAYERS[result.team]?.[result.num] || '') : ''
  const k = result ? `${result.team}_${result.num}` : ''
  const v = k ? (state[k] || 0) : 0
  const subText = v === 0 ? 'No la tenés — se marcará como tengo'
    : v === 1 ? 'Ya la tenés — se marcará como repetida x1'
    : `Ya tenés ${v-1} repetida${v > 2 ? 's' : ''} — quedará x${v}`

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">📷 Escanear figurita</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
        </div>

        {/* Video */}
        <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {/* Marco */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: 160, height: 200 }}>
              <div className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.8)', borderRadius: 12 }} />
              {/* Esquinas verdes */}
              <div className="absolute top-0 left-0 w-6 h-6 border-l-[3px] border-t-[3px] border-green-400 rounded-tl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-r-[3px] border-b-[3px] border-green-400 rounded-br-lg" />
            </div>
          </div>
          {/* Hint */}
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 text-white/90 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-dot" />
            Intento {attempts} · Escaneando...
          </div>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          {/* Status */}
          <p className={`text-sm text-center font-medium ${
            statusType === 'success' ? 'text-green-600' :
            statusType === 'error' ? 'text-red-600' :
            statusType === 'processing' ? 'text-amber-600' : 'text-gray-500'
          }`}>{status}</p>

          {/* Resultado */}
          {result && (
            <div className="rounded-xl border border-gray-200 overflow-hidden animate-pop">
              <div className="px-4 py-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Figurita detectada</div>
                <div className="text-base font-bold text-gray-900">{result.team} {result.num}{playerName ? ` — ${playerName}` : ''}</div>
                <div className="text-xs text-gray-500 mt-0.5">{subText}</div>
              </div>
              <div className="flex border-t border-gray-100">
                <button onClick={handleConfirm} className="flex-1 py-3 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition">✓ Confirmar</button>
                <button onClick={handleRetry} className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition border-l border-gray-100">↺ Seguir</button>
              </div>
            </div>
          )}

          {/* Botón manual */}
          {!result && (
            <button onClick={handleManual} className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition">
              📷 Capturar ahora
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
