'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { GROUPS, PLAYERS } from '@/lib/data'
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

export default function Scanner({ state, onDetect, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState('Iniciando cámara...')
  const [statusType, setStatusType] = useState<'idle'|'processing'|'success'|'error'>('idle')
  const [scanning, setScanning] = useState(false)
  const [lastRead, setLastRead] = useState('')

  const parseText = (text: string): ScanResult | null => {
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
        setStatus('Enfocá el código y tocá Capturar')
        setStatusType('idle')
        return
      } catch {}
    }
    setStatus('No se pudo acceder a la cámara')
    setStatusType('error')
  }, [])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [startCamera])

  const capture = useCallback(async () => {
    if (scanning || !videoRef.current) return
    const video = videoRef.current
    if (!video.videoWidth) return

    setScanning(true)
    setStatus('Analizando...')
    setStatusType('processing')
    setLastRead('')

    try {
      // Capturar frame completo — Google Vision puede ver todo
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')!.drawImage(video, 0, 0)
      const base64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      })

      if (!res.ok) {
        const err = await res.text()
        setStatus(`Error ${res.status}`)
        setLastRead(err.slice(0, 80))
        setStatusType('error')
        setScanning(false)
        return
      }

      const data = await res.json()
      if (data.error) {
        setStatus('Error al procesar')
        setLastRead(data.error.slice(0, 80))
        setStatusType('error')
        setScanning(false)
        return
      }

      const text = (data.text || '').trim().toUpperCase()
      setLastRead(`Leyó: "${text}"`)

      if (text && text !== 'NONE') {
        const parsed = parseText(text)
        if (parsed) {
          setStatus('¡Detectado!')
          setStatusType('success')
          setTimeout(() => onDetect(parsed.team, parsed.num), 300)
          return
        }
      }

      setStatus('No detecté el código — reintentá')
      setStatusType('error')
    } catch (e) {
      setStatus('Error de conexión')
      setLastRead(String(e).slice(0, 80))
      setStatusType('error')
    }

    setScanning(false)
  }, [scanning, onDetect])

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

          {/* Marco esquina superior derecha — donde está el código */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute" style={{ top: '6%', right: '4%', width: '44%', height: '18%' }}>
              <div className="absolute inset-0 rounded-xl" style={{
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
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          <p className={`text-sm text-center font-medium ${
            statusType === 'success' ? 'text-green-600' :
            statusType === 'error'   ? 'text-red-500' :
            statusType === 'processing' ? 'text-amber-600' : 'text-gray-500'
          }`}>{status}</p>

          {lastRead && (
            <p className="text-xs text-center text-gray-400 bg-gray-50 rounded-lg p-2 break-all">{lastRead}</p>
          )}

          <button
            onClick={capture}
            disabled={scanning}
            className="w-full py-4 bg-gray-900 text-white rounded-xl text-base font-bold hover:bg-gray-700 active:scale-95 transition disabled:bg-gray-300 disabled:text-gray-500"
          >
            {scanning ? '⏳ Procesando...' : '📷 Capturar'}
          </button>

          <p className="text-xs text-center text-gray-400">
            Mostrá el reverso de la figurita con el código en la zona verde
          </p>
        </div>
      </div>
    </div>
  )
}
