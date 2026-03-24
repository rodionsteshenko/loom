import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import type { Character } from '../types'

export default function CharacterDetail() {
  const { characterId } = useParams<{ characterId: string }>()
  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingPortrait, setGeneratingPortrait] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining] = useState(false)
  const navigate = useNavigate()

  const isDraft = character?.status === 'draft'

  useEffect(() => {
    fetch('/api/characters')
      .then(res => res.json())
      .then((chars: Character[]) => {
        const found = chars.find(c => c.id === characterId)
        if (found) setCharacter(found)
        else setError('Character not found')
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [characterId])

  const handleRegeneratePortrait = async () => {
    if (!character) return
    setGeneratingPortrait(true)
    setError(null)
    try {
      const response = await fetch('/api/generate-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physical_description: character.physical_description,
          name: character.name,
          race: character.race,
          class: character.class,
          art_style: character.art_style,
        }),
      })
      if (!response.ok) throw new Error('Portrait generation failed')
      const result = await response.json()
      setCharacter({ ...character, image_url: result.image_url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Portrait generation failed')
    } finally {
      setGeneratingPortrait(false)
    }
  }

  const handleRefine = async () => {
    if (!refinePrompt.trim() || !character) return
    setRefining(true)
    setError(null)
    try {
      const res = await fetch(`/api/characters/${characterId}/refine`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: refinePrompt }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Refinement failed')
      const updated = await res.json()
      setCharacter(updated)
      setRefinePrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed')
    } finally {
      setRefining(false)
    }
  }

  const handleFinalize = async () => {
    try {
      const res = await fetch(`/api/characters/${characterId}/finalize`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to finalize')
      const updated = await res.json()
      setCharacter(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading character...</div>
      </div>
    )
  }

  if (error && !character) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <Link to="/characters" className="text-purple-400 hover:text-purple-300">← Back to Gallery</Link>
        </div>
      </div>
    )
  }

  if (!character) return null

  const statMod = (val: number) => {
    const mod = Math.floor((val - 10) / 2)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )

  const Field = ({ label, value }: { label: string; value?: string | null }) => {
    if (!value) return null
    return (
      <div className="mb-2">
        <span className="text-gray-500 text-sm">{label}: </span>
        <span className="text-gray-300">{value}</span>
      </div>
    )
  }

  const ProseField = ({ label, value }: { label: string; value?: string | null }) => {
    if (!value) return null
    return (
      <div className="mb-4">
        <div className="text-gray-500 text-sm mb-1">{label}</div>
        <p className="text-gray-300 leading-relaxed whitespace-pre-line">{value}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-purple-800/50 bg-black/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={character.world_id ? `/characters?world=${character.world_id}` : '/characters'} className="text-purple-400 hover:text-purple-300 flex items-center gap-2">← Back</Link>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${character.status === 'active' ? 'bg-purple-600/80 text-purple-100' : 'bg-amber-700/80 text-amber-100'}`}>
              {character.status || 'draft'}
            </span>
            {isDraft && (
              <button
                onClick={handleFinalize}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition"
              >
                Finalize
              </button>
            )}
            {character.status === 'active' && (
              <button
                onClick={() => navigate(`/campaigns?character=${character.id}`)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition"
              >
                Play as {character.name.split(' ')[0]}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mb-6">{error}</div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* LEFT COLUMN — Portrait (1/3) */}
          <div className="lg:w-1/3 lg:sticky lg:top-24 lg:self-start">
            {character.image_url ? (
              <div className="relative group">
                <img
                  src={character.image_url}
                  alt={character.name}
                  className="w-full rounded-lg shadow-2xl border border-purple-700"
                />
                <button
                  onClick={handleRegeneratePortrait}
                  disabled={generatingPortrait}
                  className="absolute bottom-3 right-3 px-3 py-2 bg-black/70 hover:bg-black/90 disabled:opacity-50 text-white text-sm rounded-lg backdrop-blur transition-colors opacity-0 group-hover:opacity-100"
                >
                  {generatingPortrait ? '⏳ Generating...' : '🔄 Regenerate'}
                </button>
              </div>
            ) : (
              <div className="w-full aspect-square bg-gray-800 rounded-lg flex flex-col items-center justify-center border border-gray-700 gap-4">
                <span className="text-8xl">{generatingPortrait ? '⏳' : '🧙'}</span>
                <button
                  onClick={handleRegeneratePortrait}
                  disabled={generatingPortrait}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition"
                >
                  {generatingPortrait ? 'Generating...' : '🎨 Generate Portrait'}
                </button>
              </div>
            )}

            {/* Quick Stats under portrait */}
            <div className="mt-4 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="text-center mb-3">
                <h2 className="text-2xl font-bold text-white">{character.name}</h2>
                <p className="text-purple-400">
                  Level {character.level} {character.race} {character.class}
                  {character.subclass && ` (${character.subclass})`}
                </p>
                <p className="text-gray-500 text-sm">{character.alignment?.replace(/_/g, ' ')}</p>
              </div>

              {/* Stats Grid */}
              {character.stats && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {Object.entries(character.stats).map(([stat, val]) => (
                    <div key={stat} className="bg-gray-900 border border-gray-700 rounded p-2 text-center">
                      <div className="text-xs text-gray-500">{stat}</div>
                      <div className="text-lg font-bold text-white">{val}</div>
                      <div className="text-xs text-purple-400">{statMod(val)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Combat Stats */}
              <div className="flex justify-center gap-3 text-sm">
                {character.hp && (
                  <div className="bg-red-900/30 border border-red-800 rounded px-3 py-1">
                    <span className="text-red-400">HP</span> <span className="text-white font-bold">{character.hp.current}/{character.hp.max}</span>
                  </div>
                )}
                {character.armor_class && (
                  <div className="bg-blue-900/30 border border-blue-800 rounded px-3 py-1">
                    <span className="text-blue-400">AC</span> <span className="text-white font-bold">{character.armor_class}</span>
                  </div>
                )}
                {character.movement_speed && (
                  <div className="bg-green-900/30 border border-green-800 rounded px-3 py-1">
                    <span className="text-green-400">Spd</span> <span className="text-white font-bold">{character.movement_speed}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — All Details (2/3) */}
          <div className="lg:w-2/3 space-y-6">
            {/* Identity */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <Section title="Identity">
                <div className="grid grid-cols-2 gap-x-8">
                  <Field label="Background" value={character.background} />
                  <Field label="Origin" value={character.origin} />
                  <Field label="Archetype" value={character.archetype} />
                  <Field label="Arc Direction" value={character.arc_direction} />
                  <Field label="Height" value={character.height} />
                  <Field label="Weight" value={character.weight} />
                </div>
              </Section>
            </div>

            {/* Physical Description */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <ProseField label="Physical Description" value={character.physical_description} />
            </div>

            {/* Backstory */}
            {character.backstory && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                <ProseField label="Backstory" value={character.backstory} />
                <ProseField label="Childhood" value={character.childhood} />
              </div>
            )}

            {/* Psychology */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <Section title="Psychology">
                <div className="grid grid-cols-2 gap-x-8">
                  <ProseField label="Motivation" value={character.motivation} />
                  <ProseField label="Want" value={character.want} />
                  <ProseField label="Need" value={character.need} />
                  <ProseField label="Fear" value={character.fear} />
                </div>
                <ProseField label="Wound" value={character.wound} />
                <Field label="Lie They Believe" value={character.lie_they_believe} />
              </Section>
            </div>

            {/* Personality */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <Section title="Personality">
                {character.traits && character.traits.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500 text-sm">Traits: </span>
                    <span className="text-gray-300">{character.traits.join(', ')}</span>
                  </div>
                )}
                {character.values && character.values.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500 text-sm">Values: </span>
                    <span className="text-gray-300">{character.values.join(', ')}</span>
                  </div>
                )}
                {character.flaws && character.flaws.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500 text-sm">Flaws: </span>
                    <span className="text-gray-300">{character.flaws.join(', ')}</span>
                  </div>
                )}
                {character.secrets && character.secrets.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500 text-sm">Secrets: </span>
                    <span className="text-gray-300 italic">{character.secrets.join(', ')}</span>
                  </div>
                )}
              </Section>
            </div>

            {/* Voice & Mannerisms */}
            {(character.voice || character.mannerisms) && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                <Section title="Voice & Mannerisms">
                  <ProseField label="Voice" value={character.voice} />
                  <ProseField label="Mannerisms" value={character.mannerisms} />
                </Section>
              </div>
            )}

            {/* Skills & Proficiencies */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <Section title="Skills & Proficiencies">
                {character.skills && character.skills.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500 text-sm">Skills: </span>
                    <span className="text-gray-300">{character.skills.join(', ')}</span>
                  </div>
                )}
                {character.languages && character.languages.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500 text-sm">Languages: </span>
                    <span className="text-gray-300">{character.languages.join(', ')}</span>
                  </div>
                )}
                {character.abilities && character.abilities.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500 text-sm">Abilities: </span>
                    <span className="text-gray-300">{character.abilities.join(', ')}</span>
                  </div>
                )}
                {character.spells_known && character.spells_known.length > 0 && (
                  <div className="mb-2">
                    <span className="text-gray-500 text-sm">Spells: </span>
                    <span className="text-gray-300">{character.spells_known.join(', ')}</span>
                  </div>
                )}
              </Section>
            </div>
            {/* Refine prompt — only in draft mode */}
            {isDraft && (
              <div className="flex gap-3">
                <input
                  value={refinePrompt}
                  onChange={e => setRefinePrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRefine()}
                  disabled={refining}
                  placeholder="Refine this character... (e.g., 'make them more mysterious' or 'change backstory to include a betrayal')"
                  className="flex-1 bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                <button
                  onClick={handleRefine}
                  disabled={refining || !refinePrompt.trim()}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition whitespace-nowrap"
                >
                  {refining ? 'Updating...' : 'Refine'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
