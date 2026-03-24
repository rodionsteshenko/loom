import { useState, useEffect } from 'react'

interface Props {
  message: string
  subtitle?: string
}

export default function GeneratingOverlay({ message, subtitle }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-6">
          <svg className="animate-spin h-12 w-12 mx-auto text-purple-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <p className="text-gray-200 text-xl font-medium mb-2">{message}</p>
        {subtitle && <p className="text-gray-400 text-sm mb-4">{subtitle}</p>}
        <p className="text-gray-500 text-sm font-mono">{formatTime(elapsed)}</p>
      </div>
    </div>
  )
}
