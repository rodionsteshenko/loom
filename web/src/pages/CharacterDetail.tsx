import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import type { Character } from '../types'

export default function CharacterDetail() {
  const { characterId } = useParams<{ characterId: string }>()
  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/characters')
      .then(res => res.json())
      .then((chars: Character[]) => {
        const found = chars.find(c => c.id === characterId)
        if (found) {
          setCharacter(found)
        } else {
          setError('Character not found')
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [characterId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading character...</div>
      </div>
    )
  }

  if (error || !character) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error || 'Character not found'}</div>
          <Link to="/characters" className="text-purple-400 hover:text-purple-300">
            ← Back to Gallery
          </Link>
        </div>
      </div>
    )
  }

  const statMod = (val: number) => {
    const mod = Math.floor((val - 10) / 2)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-purple-800/50 bg-black/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/characters" className="text-purple-400 hover:text-purple-300 flex items-center gap-2">
            ← Back to Gallery
          </Link>
          <button
            onClick={() => navigate(`/campaigns?character=${character.id}`)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
          >
            Play as {character.name.split(' ')[0]}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          {/* Portrait */}
          <div className="md:w-1/3">
            {character.image_url ? (
              <img 
                src={character.image_url} 
                alt={character.name}
                className="w-full rounded-lg shadow-2xl border border-purple-700"
              />
            ) : (
              <div className="w-full aspect-square bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                <span className="text-8xl">🧙</span>
              </div>
            )}
          </div>
          
          {/* Basic Info */}
          <div className="md:w-2/3">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-white">{character.name}</h1>
              {character.type === 'npc' && (
                <span className="bg-amber-600 text-white text-sm font-bold px-3 py-1 rounded">NPC</span>
              )}
            </div>
            <p className="text-xl text-purple-400 mb-4">
              Level {character.level} {character.race} {character.class}
              {character.subclass && ` (${character.subclass})`}
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <span className="text-gray-500">Alignment:</span>
                <span className="text-gray-300 ml-2">{character.alignment?.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-gray-500">Background:</span>
                <span className="text-gray-300 ml-2">{character.background}</span>
              </div>
              {character.origin && (
                <div>
                  <span className="text-gray-500">Origin:</span>
                  <span className="text-gray-300 ml-2">{character.origin}</span>
                </div>
              )}
              {character.archetype && (
                <div>
                  <span className="text-gray-500">Archetype:</span>
                  <span className="text-gray-300 ml-2">{character.archetype}</span>
                </div>
              )}
            </div>

            {/* Stats */}
            {character.stats && (
              <div className="grid grid-cols-6 gap-2 mb-6">
                {Object.entries(character.stats).map(([stat, val]) => (
                  <div key={stat} className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 uppercase">{stat}</div>
                    <div className="text-2xl font-bold text-white">{val}</div>
                    <div className="text-sm text-purple-400">{statMod(val)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Combat Stats */}
            <div className="flex gap-6 text-sm">
              {character.hp && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-2">
                  <span className="text-red-400">HP:</span>
                  <span className="text-white font-bold ml-2">{character.hp.current}/{character.hp.max}</span>
                </div>
              )}
              {character.armor_class && (
                <div className="bg-blue-900/30 border border-blue-800 rounded-lg px-4 py-2">
                  <span className="text-blue-400">AC:</span>
                  <span className="text-white font-bold ml-2">{character.armor_class}</span>
                </div>
              )}
              {character.movement_speed && (
                <div className="bg-green-900/30 border border-green-800 rounded-lg px-4 py-2">
                  <span className="text-green-400">Speed:</span>
                  <span className="text-white font-bold ml-2">{character.movement_speed} ft</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details Sections */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Physical Description */}
          {character.physical_description && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-bold text-purple-400 mb-3">Physical Description</h2>
              <p className="text-gray-300 leading-relaxed">{character.physical_description}</p>
            </div>
          )}

          {/* Personality */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold text-purple-400 mb-3">Personality</h2>
            {character.traits && character.traits.length > 0 && (
              <div className="mb-3">
                <span className="text-gray-500 text-sm">Traits: </span>
                <span className="text-gray-300">{character.traits.join(', ')}</span>
              </div>
            )}
            {character.values && character.values.length > 0 && (
              <div className="mb-3">
                <span className="text-gray-500 text-sm">Values: </span>
                <span className="text-gray-300">{character.values.join(', ')}</span>
              </div>
            )}
            {character.flaws && character.flaws.length > 0 && (
              <div>
                <span className="text-gray-500 text-sm">Flaws: </span>
                <span className="text-gray-300">{character.flaws.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Backstory */}
          {character.backstory && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 md:col-span-2">
              <h2 className="text-lg font-bold text-purple-400 mb-3">Backstory</h2>
              <p className="text-gray-300 leading-relaxed whitespace-pre-line">{character.backstory}</p>
            </div>
          )}

          {/* Motivation & Goals */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold text-purple-400 mb-3">Motivation & Goals</h2>
            {character.motivation && (
              <div className="mb-3">
                <span className="text-gray-500 text-sm">Motivation: </span>
                <span className="text-gray-300">{character.motivation}</span>
              </div>
            )}
            {character.want && (
              <div className="mb-3">
                <span className="text-gray-500 text-sm">Want: </span>
                <span className="text-gray-300">{character.want}</span>
              </div>
            )}
            {character.need && (
              <div>
                <span className="text-gray-500 text-sm">Need: </span>
                <span className="text-gray-300">{character.need}</span>
              </div>
            )}
          </div>

          {/* Inner Conflict */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold text-purple-400 mb-3">Inner Conflict</h2>
            {character.wound && (
              <div className="mb-3">
                <span className="text-gray-500 text-sm">Wound: </span>
                <span className="text-gray-300">{character.wound}</span>
              </div>
            )}
            {character.lie_they_believe && (
              <div className="mb-3">
                <span className="text-gray-500 text-sm">Lie They Believe: </span>
                <span className="text-gray-300">{character.lie_they_believe}</span>
              </div>
            )}
            {character.fear && (
              <div>
                <span className="text-gray-500 text-sm">Fear: </span>
                <span className="text-gray-300">{character.fear}</span>
              </div>
            )}
          </div>

          {/* Skills & Abilities */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold text-purple-400 mb-3">Skills & Languages</h2>
            {character.skills && character.skills.length > 0 && (
              <div className="mb-3">
                <span className="text-gray-500 text-sm">Skills: </span>
                <span className="text-gray-300">{character.skills.join(', ')}</span>
              </div>
            )}
            {character.languages && character.languages.length > 0 && (
              <div>
                <span className="text-gray-500 text-sm">Languages: </span>
                <span className="text-gray-300">{character.languages.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Voice & Mannerisms */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-bold text-purple-400 mb-3">Voice & Mannerisms</h2>
            {character.voice && (
              <div className="mb-3">
                <span className="text-gray-500 text-sm">Voice: </span>
                <span className="text-gray-300">{character.voice}</span>
              </div>
            )}
            {character.mannerisms && (
              <div>
                <span className="text-gray-500 text-sm">Mannerisms: </span>
                <span className="text-gray-300">{character.mannerisms}</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
