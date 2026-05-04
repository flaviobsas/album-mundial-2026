'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { GROUPS } from '@/lib/data'
import type { StickerState } from '@/lib/data'

interface ScanResult { team: string; num: number }
interface ScannerProps {
  state: StickerState
  onDetect: (team: string, num: number) => void
  onClose: () => void
}

const TEAMS = [
  'MEX','RSA','KOR','CZE','CAN','BIH','QAT','SUI','BRA','MAR','HAI','SCO',
  'USA','PAR','AUS','TUR','GER','CUW','CIV','ECU','NED','JPN','SWE','TUN',
  'BEL','EGV','IRN','NZL','ESP','CPV','KSA','URU','FRA','SEN','IRQ','NOR',
  'ARG','ALG','AUT','JOR','POR','COD','UZB','COL','ENG','CRO','GHA','PAN',
  'FWC','OO','CC'
]

function parseText(text: string): ScanResult | null {
  const upper = text.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ')
  for (const team of TEAMS) {
    const patterns = [
      new RegExp(`\\b${team}\\s*(\\d{1,2})\\b`),
      new RegExp(`${team}\\D{0,2}(\\d{1,2})`),
    ]
    for (const pat of patterns) {
      const m = upper.match(pat)
      if (m) {
        const num = parseInt(m[1])
        const groupEntry = GROUPS.flatMap(g => Object.entries(g.teams)).find(([t]) => t === team)
        if (groupEntry && num >= 1 && num <= groupEntry[1]) return { team, num }
      }
    }
  }
  return null
}

async function callVision(base64: string): Promise<string> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 })
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

export default function Scanner({ onDetect, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const busyRef = useRef(false)

  const [status, setStatus] = useState('Iniciando cámara...')
  const [statusType, setStatusType] = useState<'idle'|'processing'|'success'|'error'>('idle')
  const [attempts, setAttempts] = useState(0)
  const [manualBusy, setManualBusy] = useState(false)

  const stopInterval = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  const handleDetected = useCallback((result: ScanResult) => {
    stopInterval()
    setStatus('¡Detectado!')
    setStatusType('success')
    setTimeout(() => onDetect(result.team, result.num), 250)
  }, [onDetect])

  // Escaneo automático silencioso
  const autoScan = useCallback(async () => {
    if (busyRef.current || !videoRef.current?.videoWidth) return
    busyRef.current = true
    setAttempts(a => a + 1)
    try {
      const base64 = captureFrame(videoRef.current!)
      const text = await callVision(base64)
      if (text && text !== 'NONE') {
        const parsed = parseText(text)
        if (parsed) { handleDetected(parsed); return }
      }
    } catch {}
    busyRef.current = false
  }, [handleDetected])

  // Captura manual con feedback
  const manualCapture = useCallback(async () => {
    if (manualBusy || !videoRef.current?.videoWidth) return
    setManualBusy(true)
    setStatus('Analizando...')
    setStatusType('processing')
    stopInterval()
    try {
      const base64 = captureFrame(videoRef.current!)
      const text = await callVision(base64)
      if (text && text !== 'NONE') {
        const parsed = parseText(text)
        if (parsed) { handleDetected(parsed); return }
        setStatus(`Leyó "${text}" — no coincide. Reintentá.`)
      } else {
        setStatus('No detecté código. Reintentá.')
      }
      setStatusType('error')
    } catch (e) {
      setStatus(`Error: ${e}`)
      setStatusType('error')
    }
    setManualBusy(false)
    // Reanudar automático
    intervalRef.current = setInterval(autoScan, 2500)
  }, [manualBusy, autoScan, handleDetected])

  const startCamera = useCallback(async () => {
    const constraints = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 } } },
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
        setStatus('Escaneando automáticamente...')
        setStatusType('idle')
        // Primer escaneo después de 1.5s para que la cámara enfoque
        setTimeout(() => {
          autoScan()
          intervalRef.current = setInterval(autoScan, 2500)
        }, 1500)
        return
      } catch {}
    }
    setStatus('No se pudo acceder a la cámara')
    setStatusType('error')
  }, [autoScan])

  useEffect(() => {
    startCamera()
    return () => {
      stopInterval()
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [startCamera])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">📷 Escanear figurita</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        {/* Video */}
        <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

          {/* Marco esquina superior derecha */}
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

          {/* Indicador de intento */}
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80 text-xs">Intento {attempts}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          <p className={`text-sm text-center font-medium ${
            statusType === 'success'    ? 'text-green-600' :
            statusType === 'error'      ? 'text-red-500' :
            statusType === 'processing' ? 'text-amber-600' : 'text-gray-500'
          }`}>{status}</p>

          <button
            onClick={manualCapture}
            disabled={manualBusy}
            className="w-full py-4 bg-gray-900 text-white rounded-xl text-base font-bold hover:bg-gray-700 active:scale-95 transition disabled:bg-gray-300"
          >
            {manualBusy ? '⏳ Procesando...' : '📷 Capturar ahora'}
          </button>

          <p className="text-xs text-center text-gray-400">
            Mostrá el reverso con el código en la zona verde
          </p>
        </div>
      </div>
    </div>
  )
}
