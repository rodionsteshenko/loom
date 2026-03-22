import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Character } from '../types'

export default function CharacterGallery() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/characters')
      .then(res => res.json())
      .then(data => {
        setCharacters(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading characters...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-purple-800/50 bg-black/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              🎭 Character Gallery
            </h1>
            <p className="text-gray-400 text-sm mt-1">Select a character to play</p>
          </div>
          <div className="flex gap-3">
            <Link 
              to="/"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
            >
              + Create New
            </Link>
            <Link 
              to="/campaigns"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Campaigns
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mb-6">
            {error}
          </div>
        )}

        {characters.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🧙‍♂️</div>
            <p className="text-gray-400 text-lg">No characters yet</p>
            <Link 
              to="/"
              className="inline-block mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
            >
              Create Your First Character
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map(char => (
              <div
                key={char.id}
                onClick={() => navigate(`/characters/${char.id}`)}
                className="bg-gray-800/50 border border-gray-700 hover:border-purple-500 rounded-lg overflow-hidden cursor-pointer transition group"
              >
                {char.image_url ? (
                  <div className="h-48 overflow-hidden relative">
                    <img 
                      src={char.image_url} 
                      alt={char.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    {char.type === 'npc' && (
                      <div className="absolute top-2 right-2 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">
                        NPC
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-48 bg-gray-700 flex items-center justify-center relative">
                    <span className="text-6xl">🧙</span>
                    {char.type === 'npc' && (
                      <div className="absolute top-2 right-2 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">
                        NPC
                      </div>
                    )}
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-xl font-bold text-white">{char.name}</h3>
                  <p className="text-purple-400">
                    Level {char.level} {char.race} {char.class}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {char.alignment?.replace('_', ' ')}
                  </p>
                  {char.backstory && (
                    <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                      {char.backstory.substring(0, 100)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
