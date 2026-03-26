import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Character, World } from '../types'

export default function CharacterGallery() {
  const [allCharacters, setAllCharacters] = useState<Character[]>([])
  const [world, setWorld] = useState<World | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const worldId = searchParams.get('world')
  const navigate = useNavigate()

  useEffect(() => {
    const fetches: Promise<any>[] = [
      fetch('/api/characters').then(r => r.json()),
    ]
    if (worldId) {
      fetches.push(fetch(`/api/worlds/${worldId}`).then(r => r.json()))
    }

    Promise.all(fetches)
      .then(([chars, w]) => {
        setAllCharacters(chars)
        if (w) setWorld(w)
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [worldId])

  // Filter by world if world context is set
  const characters = worldId
    ? allCharacters.filter(c => c.world_id === worldId)
    : allCharacters

  // Characters from other worlds (for potential import)
  const otherCharacters = worldId
    ? allCharacters.filter(c => c.world_id && c.world_id !== worldId)
    : []

  const orphanCharacters = worldId
    ? allCharacters.filter(c => !c.world_id)
    : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading characters...</div>
      </div>
    )
  }

  const createLink = worldId ? `/characters/new?world=${worldId}` : '/'
  const backLink = worldId ? `/worlds/${worldId}` : '/'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950">
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/" className="text-purple-400 hover:text-purple-300 font-bold text-sm">Loom</Link>
              {world && <><span className="text-gray-700">|</span><Link to={backLink} className="text-gray-400 hover:text-purple-300 text-sm">← {world.name}</Link></>}
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mt-1">
              {world ? `${world.name} — Characters` : 'All Characters'}
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              to={createLink}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition text-sm"
            >
              + Create New
            </Link>
            {worldId && (
              <Link
                to="/characters"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition text-sm"
              >
                All Characters
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mb-6">{error}</div>
        )}

        {characters.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🧙‍♂️</div>
            <p className="text-gray-400 text-lg">
              {worldId ? `No characters in ${world?.name || 'this world'} yet` : 'No characters yet'}
            </p>
            <Link
              to={createLink}
              className="inline-block mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
            >
              Create Your First Character
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map(char => (
              <CharacterCard key={char.id} character={char} onClick={() => navigate(`/characters/${char.id}`)} />
            ))}
          </div>
        )}

        {/* Other world characters — potential import candidates */}
        {worldId && (otherCharacters.length > 0 || orphanCharacters.length > 0) && (
          <div className="mt-12">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-8" />
            <h2 className="text-lg font-semibold text-gray-400 mb-4">Characters from other worlds</h2>
            <p className="text-gray-500 text-sm mb-6">
              These characters belong to other worlds. Importing them would require adapting their art style and backstory to fit {world?.name || 'this world'}.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
              {[...otherCharacters, ...orphanCharacters].map(char => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  onClick={() => navigate(`/characters/${char.id}`)}
                  dimmed
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function CharacterCard({ character: char, onClick, dimmed }: { character: Character; onClick: () => void; dimmed?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800/50 border border-gray-700 hover:border-purple-500 rounded-lg overflow-hidden cursor-pointer transition group ${dimmed ? 'opacity-70' : ''}`}
    >
      {char.image_url ? (
        <div className="h-48 overflow-hidden relative">
          <img
            src={char.image_url}
            alt={char.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
          {char.type === 'npc' && (
            <div className="absolute top-2 right-2 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">NPC</div>
          )}
        </div>
      ) : (
        <div className="h-48 bg-gray-700 flex items-center justify-center relative">
          <span className="text-6xl">🧙</span>
          {char.type === 'npc' && (
            <div className="absolute top-2 right-2 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">NPC</div>
          )}
        </div>
      )}
      <div className="p-4">
        <h3 className="text-xl font-bold text-white">{char.name}</h3>
        <p className="text-purple-400">
          Level {char.level} {char.race} {char.class}
        </p>
        <p className="text-gray-500 text-sm mt-1">
          {char.alignment?.replace(/_/g, ' ')}
        </p>
        {char.backstory && (
          <p className="text-gray-400 text-sm mt-2 line-clamp-2">
            {char.backstory.substring(0, 100)}...
          </p>
        )}
      </div>
    </div>
  )
}
