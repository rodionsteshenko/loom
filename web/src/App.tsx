import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useState } from 'react'
import CharacterForm from './components/CharacterForm'
import CharacterPreview from './components/CharacterPreview'
import PortraitPreview from './components/PortraitPreview'
import CharacterGallery from './pages/CharacterGallery'
import CharacterDetail from './pages/CharacterDetail'
import CampaignManager from './pages/CampaignManager'
import CampaignSettings from './pages/CampaignSettings'
import GamePlay from './pages/GamePlay'
import type { Character, CharacterFormData } from './types'

function CharacterCreator() {
  const [character, setCharacter] = useState<Character | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async (formData: CharacterFormData) => {
    setIsGenerating(true)
    setError(null)
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        throw new Error(await response.text())
      }
      
      const result = await response.json()
      setCharacter(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegeneratePortrait = async () => {
    if (!character) return
    
    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physical_description: character.physical_description,
          name: character.name,
          race: character.race,
          class: character.class,
          art_style: character.art_style
        })
      })
      
      if (!response.ok) throw new Error('Portrait generation failed')
      
      const result = await response.json()
      setCharacter({ ...character, image_url: result.image_url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Portrait generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-purple-800/50 bg-black/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              🎲 Loom Character Creator
            </h1>
            <p className="text-gray-400 text-sm mt-1">AI-powered D&D character generation</p>
          </div>
          <div className="flex gap-3">
            <Link 
              to="/characters"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Gallery
            </Link>
            <Link 
              to="/campaigns"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
            >
              Play
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Form - Full Width */}
        <div className="mb-8">
          <CharacterForm 
            onGenerate={handleGenerate} 
            isGenerating={isGenerating} 
          />
          
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mt-4">
              {error}
            </div>
          )}
        </div>

        {/* Character Preview - Below */}
        {character ? (
          <div className="space-y-6">
            <PortraitPreview 
              imageUrl={character.image_url} 
              name={character.name}
              onRegenerate={handleRegeneratePortrait}
              isGenerating={isGenerating}
            />
            <CharacterPreview character={character} />
          </div>
        ) : (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">🧙‍♂️</div>
            <p className="text-gray-400">Your character will appear here</p>
            <p className="text-gray-500 text-sm mt-2">Fill out the form and click Generate</p>
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
        <Route path="/" element={<CharacterCreator />} />
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
