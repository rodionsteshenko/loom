import { BrowserRouter, Routes, Route, Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import CharacterForm from './components/CharacterForm'
import GeneratingOverlay from './components/GeneratingOverlay'
import Landing from './pages/Landing'
import WorldBuilder from './pages/WorldBuilder'
import WorldDetail from './pages/WorldDetail'
import CharacterGallery from './pages/CharacterGallery'
import CharacterDetail from './pages/CharacterDetail'
import CampaignManager from './pages/CampaignManager'
import CampaignSettings from './pages/CampaignSettings'
import GamePlay from './pages/GamePlay'
import type { CharacterFormData } from './types'

import type { World } from './types'

function CharacterCreator() {
  const [searchParams] = useSearchParams()
  const worldId = searchParams.get('world')
  const [world, setWorld] = useState<World | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (worldId) {
      fetch(`/api/worlds/${worldId}`)
        .then(res => res.json())
        .then(setWorld)
        .catch(() => setError('Failed to load world'))
    }
  }, [worldId])

  const handleGenerate = async (formData: CharacterFormData) => {
    if (!worldId) {
      setError('A world is required to create a character. Go to a world page and click "Create Character".')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, world_id: worldId })
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const result = await response.json()
      // Redirect to the character detail page (side-by-side layout)
      navigate(`/characters/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950">
      {isGenerating && (
        <GeneratingOverlay
          message="Creating your character..."
          subtitle="Generating stats, backstory, personality, and portrait"
        />
      )}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={worldId ? `/worlds/${worldId}` : '/'} className="text-gray-400 hover:text-purple-300 text-sm">
            ← Back{world ? ` to ${world.name}` : ''}
          </Link>
          <div className="flex gap-3">
            <Link to="/characters" className="text-gray-400 hover:text-purple-300 text-sm">Gallery</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Create a Character</h1>
          {!worldId && (
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg px-4 py-3 text-amber-200 text-sm mt-4">
              Characters must belong to a world. <Link to="/" className="text-purple-300 underline">Create or select a world</Link> first.
            </div>
          )}
        </div>

        <CharacterForm
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          worldName={world?.name}
        />

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mt-4">
            {error}
          </div>
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/worlds/new" element={<WorldBuilder />} />
        <Route path="/worlds/:worldId" element={<WorldDetail />} />
        <Route path="/characters/new" element={<CharacterCreator />} />
        <Route path="/characters" element={<CharacterGallery />} />
        <Route path="/characters/:characterId" element={<CharacterDetail />} />
        <Route path="/campaigns" element={<CampaignManager />} />
        <Route path="/campaigns/:campaignId/settings" element={<CampaignSettings />} />
        <Route path="/play/:campaignId" element={<GamePlay />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
