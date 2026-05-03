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

const TEAMS = [
  'MEX','RSA','KOR','CZE','CAN','BIH','QAT','SUI','BRA','MAR','HAI','SCO',
  'USA','PAR','AUS','TUR','GER','CUW','CIV','ECU','NED','JPN','SWE','TUN',
  'BEL','EGV','IRN','NZL','ESP','CPV','KSA','URU','FRA','SEN','IRQ','NOR',
  'ARG','ALG','AUT','JOR','POR','COD','UZB','COL','ENG','CRO','GHA','PAN',
  'FWC','OO','CC'
]

export default function Scanner({ state, onConfirm, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const workerRef = useRef<unknown>(null)
  const scanningRef = useRef(false)

  const [status, setStatus] = useState('Cargando OCR...')
  const [statusType, setStatusType] = useState<'idle'|'processing'|'success'|'error'>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lastRead, setLastRead] = useState('')
  const [ocrReady, setOcrReady] = useState(false)

  const parseText = (text: string): ScanResult | null => {
    // Corregir errores comunes de OCR
    let upper = text.toUpperCase()
    upper = upper.replace(/0/g, 'O').replace(/1/g, 'I') // primer pase: números a letras para encontrar el equipo
    
    // Buscar equipo primero
    for (const team of TEAMS) {
      if (upper.includes(team)) {
        // Encontrado el equipo — ahora buscar el número en el texto original
        const numText = text.toUpperCase().replace(/O/g, '0').replace(/I/g, '1').replace(/L/g, '1')
        const patterns = [
          new RegExp(`\\b${team}\\s*(\\d{1,2})\\b`),
          new RegExp(`${team}\\D{0,3}(\\d{1,2})`),
        ]
        for (const pat of patterns) {
          const m = numText.match(pat)
          if (m) {
            const num = parseInt(m[1])
            const groupEntry = GROUPS.flatMap(g => Object.entries(g.teams)).find(([t]) => t === team)
            if (groupEntry && num >= 1 && num <= groupEntry[1]) {
              return { team, num }
            }
          }
        }
      }
    }
    return null
  }

  // Cargar Tesseract desde CDN
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
    script.onload = async () => {
      try {
        const Tesseract = (window as unknown as {Tesseract: {createWorker: (lang: string) => Promise<unknown>}}).Tesseract
        const worker = await Tesseract.createWorker('eng')
        workerRef.current = worker
        setOcrReady(true)
        setStatus('Apuntá al número de la figurita')
        setStatusType('idle')
        // Iniciar cámara
        startCamera()
      } catch {
        setStatus('Error al cargar OCR')
        setStatusType('error')
      }
    }
    document.head.appendChild(script)
    return () => {
      if (workerRef.current) {
        (workerRef.current as {terminate: () => void}).terminate()
      }
    }
  }, [])

  const captureAndScan = useCallback(async () => {
    if (scanningRef.current || !videoRef.current || !workerRef.current) return
    const video = videoRef.current
    if (!video.videoWidth || !video.videoHeight) return

    scanningRef.current = true
    setAttempts(a => a + 1)

    try {
      // Capturar frame — recortar zona central donde está el código
      const canvas = document.createElement('canvas')
      const cw = video.videoWidth, ch = video.videoHeight
      // Recortar el área del marco (zona central)
      const cropW = Math.round(cw * 0.6)
      const cropH = Math.round(ch * 0.5)
      const cropX = Math.round((cw - cropW) / 2)
      const cropY = Math.round((ch - cropH) / 2)
      // Escalar grande para mejor OCR
      canvas.width = cropW * 2
      canvas.height = cropH * 2
      const ctx = canvas.getContext('2d')!
      ctx.filter = 'contrast(2.5) brightness(1.3) grayscale(1)'
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height)

      const worker = workerRef.current as {
        recognize: (img: HTMLCanvasElement) => Promise<{data: {text: string}}>
        setParameters: (params: Record<string, string>) => Promise<void>
      }

      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ',
        tessedit_pageseg_mode: '11', // modo esparso — busca texto en cualquier lugar
      })

      const { data: { text } } = await worker.recognize(canvas)
      setLastRead(text.trim().slice(0, 60))

      const parsed = parseText(text)
      if (parsed) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setResult(parsed)
        setStatus('¡Figurita detectada!')
        setStatusType('success')
      }
    } catch (e) {
      setLastRead(`Error: ${e}`)
    }

    scanningRef.current = false
  }, [])

  const startCamera = useCallback(async () => {
    const constraints = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
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
        // Escanear cada 3 segundos
        intervalRef.current = setInterval(captureAndScan, 3000)
        return
      } catch {}
    }
    setStatus('No se pudo acceder a la cámara')
    setStatusType('error')
  }, [captureAndScan])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const handleManual = () => {
    if (!ocrReady) return
    setStatus('Escaneando...')
    setStatusType('processing')
    captureAndScan()
  }

  const handleConfirm = () => {
    if (!result) return
    onConfirm(result.team, result.num)
    setResult(null)
    setLastRead('')
    setStatus('Apuntá al número de la figurita')
    setStatusType('idle')
    scanningRef.current = false
    if (ocrReady) {
      intervalRef.current = setInterval(captureAndScan, 3000)
    }
  }

  const handleRetry = () => {
    setResult(null)
    setLastRead('')
    setStatus('Apuntá al número de la figurita')
    setStatusType('idle')
    scanningRef.current = false
    if (ocrReady) {
      intervalRef.current = setInterval(captureAndScan, 3000)
    }
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">📷 Escanear figurita</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: '3/4' }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: 160, height: 200 }}>
              <div className="absolute inset-0 rounded-xl" style={{
                boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,255,255,0.8)',
                borderRadius: 12
              }} />
              <div className="absolute top-0 left-0 w-6 h-6 border-l-[3px] border-t-[3px] border-green-400 rounded-tl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-r-[3px] border-b-[3px] border-green-400 rounded-br-lg" />
            </div>
          </div>
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2 text-white/90 text-xs">
            {ocrReady
              ? <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Intento {attempts}</>
              : <><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />Cargando OCR...</>
            }
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2">
          <p className={`text-sm text-center font-medium ${
            statusType === 'success' ? 'text-green-600' :
            statusType === 'error' ? 'text-red-600' :
            statusType === 'processing' ? 'text-amber-600' : 'text-gray-500'
          }`}>{status}</p>

          {lastRead && !result && (
            <p className="text-xs text-center text-gray-400 bg-gray-50 rounded-lg p-2 break-all">
              Leyó: &quot;{lastRead}&quot;
            </p>
          )}

          {result && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Figurita detectada</div>
                <div className="text-base font-bold text-gray-900">
                  {result.team} {result.num}{playerName ? ` — ${playerName}` : ''}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{subText}</div>
              </div>
              <div className="flex border-t border-gray-100">
                <button onClick={handleConfirm} className="flex-1 py-3 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 transition">✓ Confirmar</button>
                <button onClick={handleRetry} className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition border-l border-gray-100">↺ Seguir</button>
              </div>
            </div>
          )}

          {!result && (
            <button
              onClick={handleManual}
              disabled={!ocrReady}
              className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition disabled:bg-gray-300"
            >
              {ocrReady ? '📷 Capturar ahora' : 'Cargando...'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
