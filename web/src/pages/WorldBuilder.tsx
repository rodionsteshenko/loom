import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GeneratingOverlay from '../components/GeneratingOverlay'

const SCENE_ART_STYLES = [
  { value: 'oil-painting', label: 'Oil Painting' },
  { value: 'classic-fantasy', label: 'Classic Fantasy' },
  { value: 'dark-fantasy', label: 'Dark Fantasy' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'storybook', label: 'Storybook' },
  { value: 'art-nouveau', label: 'Art Nouveau' },
  { value: 'digital-art', label: 'Digital Art' },
  { value: 'concept-art', label: 'Concept Art' },
  { value: 'realistic', label: 'Photorealistic' },
  { value: 'comic-book', label: 'Comic Book' },
  { value: 'anime', label: 'Anime' },
  { value: 'pixel-art', label: 'Pixel Art' },
  { value: 'noir', label: 'Film Noir' },
  { value: 'gothic', label: 'Gothic' },
  { value: 'eldritch', label: 'Eldritch Horror' },
]

export default function WorldBuilder() {
  const [prompt, setPrompt] = useState('')
  const [artStyle, setArtStyle] = useState('oil-painting')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState('')
  const navigate = useNavigate()

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setGenerating(true)
    setError(null)
    setStep('Building your world...')

    try {
      const response = await fetch('/api/worlds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, art_style: artStyle }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'World generation failed')
      }

      const world = await response.json()
      navigate(`/worlds/${world.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'World generation failed')
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950">
      {generating && (
        <GeneratingOverlay
          message="Building your world..."
          subtitle="Generating lore, geography, factions, religion, and concept images"
        />
      )}
      <nav className="max-w-3xl mx-auto px-6 py-6">
        <Link to="/" className="text-gray-400 hover:text-purple-300 transition-colors text-sm">
          ← Back
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-100 mb-3">Create a World</h1>
          <p className="text-gray-400 text-lg">
            Describe the world you want to build. The AI will generate lore, geography, factions, religion, and key figures.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-8">
          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              World Concept
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={generating}
              placeholder="A dying world where ancient machines are waking up, steampunk cities built on the ruins of a magical civilization, three great guilds fight for control of the last working factories..."
              className="w-full h-40 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50"
            />
            <p className="text-gray-500 text-xs mt-2">
              Be as detailed or as brief as you want. Include tone, genre, key conflicts, or just a vibe.
            </p>
          </div>

          {/* Art Style */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Art Style
            </label>
            <p className="text-gray-500 text-xs mb-3">
              This style applies to all images in this world — concept art, character portraits, and scene images.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {SCENE_ART_STYLES.map(style => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setArtStyle(style.value)}
                  disabled={generating}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    artStyle === style.value
                      ? 'bg-purple-600 text-white border border-purple-500'
                      : 'bg-gray-800/60 text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-300'
                  } disabled:opacity-50`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={generating || !prompt.trim()}
            className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded-xl text-lg font-medium transition-all hover:shadow-lg hover:shadow-purple-600/25"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {step}
              </span>
            ) : (
              'Generate World'
            )}
          </button>

          {generating && (
            <p className="text-center text-gray-500 text-sm">
              This takes about 30-60 seconds. We're generating lore, geography, factions, and concept images.
            </p>
          )}
        </form>
      </main>
    </div>
  )
}
