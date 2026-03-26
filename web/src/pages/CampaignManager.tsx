import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Campaign, Character, World } from '../types'
import GeneratingOverlay from '../components/GeneratingOverlay'

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [world, setWorld] = useState<World | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const worldId = searchParams.get('world')
  const navigate = useNavigate()

  const [formData, setFormData] = useState({ name: '', premise: '', length: 'standard' as 'short' | 'standard' | 'epic' })
  const [selectedParty, setSelectedParty] = useState<string[]>(() => {
    const preselected = searchParams.get('character')
    return preselected ? [preselected] : []
  })

  useEffect(() => {
    const fetches: Promise<any>[] = [
      fetch('/api/campaigns').then(r => r.json()),
      fetch('/api/characters').then(r => r.json()),
    ]
    if (worldId) {
      fetches.push(fetch(`/api/worlds/${worldId}`).then(r => r.json()))
    }

    Promise.all(fetches)
      .then(([camps, chars, w]) => {
        setCampaigns(camps)
        setCharacters(chars)
        if (w) setWorld(w)
        setLoading(false)
        if (searchParams.get('character')) setShowForm(true)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [searchParams, worldId])

  // Characters without a status field are treated as active (backward compat)
  const isUsable = (c: Character) => !c.status || c.status === 'active'

  // Filter characters by world
  const worldCharacters = worldId
    ? characters.filter(c => c.world_id === worldId && isUsable(c))
    : characters.filter(c => isUsable(c))

  const otherCharacters = worldId
    ? characters.filter(c => c.world_id !== worldId && isUsable(c))
    : []

  // Filter campaigns by world
  const filteredCampaigns = worldId
    ? campaigns.filter(c => c.world_id === worldId)
    : campaigns

  const toggleCharacter = (id: string) => {
    setSelectedParty(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedParty.length === 0) {
      setError('Select at least one character for your party')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name || undefined,
          premise: formData.premise || undefined,
          campaign_length: formData.length,
          character_id: selectedParty[0],
          party: selectedParty,
          world_id: worldId || undefined,
          auto_generate: true,
        }),
      })

      if (!res.ok) throw new Error(await res.text())
      const campaign = await res.json()
      navigate(`/campaigns/${campaign.id}/settings`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
      setCreating(false)
    }
  }

  const getCharacter = (id: string) => characters.find(c => c.id === id)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading campaigns...</div>
      </div>
    )
  }

  const backLink = worldId ? `/worlds/${worldId}` : '/'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950">
      {creating && (
        <GeneratingOverlay
          message="Creating your campaign..."
          subtitle="Generating story premise, encounters, and intro image"
        />
      )}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/" className="text-purple-400 hover:text-purple-300 font-bold text-sm">Loom</Link>
              {world && <><span className="text-gray-700">|</span><Link to={backLink} className="text-gray-400 hover:text-purple-300 text-sm">← {world.name}</Link></>}
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mt-1">
              {world ? `${world.name} — Campaigns` : 'Campaigns'}
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition text-sm"
            >
              + New Campaign
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mb-6">{error}</div>
        )}

        {/* Create Campaign Form */}
        {showForm && (
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-100 mb-4">Create New Campaign</h2>
            <form onSubmit={handleCreate} className="space-y-6">
              <p className="text-gray-400 text-sm">
                Select party members and we'll generate a campaign tailored to their stories.
                {world && <span className="text-purple-300"> Campaign will be set in {world.name}.</span>}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">
                    Campaign Name <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Auto-generated from character"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">
                    Premise <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.premise}
                    onChange={e => setFormData({ ...formData, premise: e.target.value })}
                    placeholder="Auto-generated from backstory & world"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Campaign Length */}
              <div>
                <label className="block text-gray-300 text-sm mb-2">Campaign Length</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 'short' as const, label: 'Short', desc: '5-6 scenes', time: '~20 min' },
                    { value: 'standard' as const, label: 'Standard', desc: '8-10 scenes', time: '~45 min' },
                    { value: 'epic' as const, label: 'Epic', desc: '15-20 scenes', time: '~90 min' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, length: opt.value })}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        formData.length === opt.value
                          ? 'border-purple-500 bg-purple-900/20'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">{opt.label}</div>
                      <div className="text-gray-400 text-xs">{opt.desc}</div>
                      <div className="text-gray-500 text-xs">{opt.time}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Party Selection — World Characters */}
              <div>
                <label className="block text-gray-300 text-sm mb-3">
                  {world ? `${world.name} Characters` : 'Select Party Members'}
                  <span className="text-gray-500 ml-2">({selectedParty.length} selected)</span>
                </label>

                {worldCharacters.length === 0 ? (
                  <div className="bg-gray-900/50 rounded-lg p-6 text-center">
                    <p className="text-gray-400 mb-3">
                      {worldId ? `No finalized characters in ${world?.name || 'this world'}` : 'No characters yet'}
                    </p>
                    <Link
                      to={worldId ? `/characters/new?world=${worldId}` : '/'}
                      className="text-purple-400 hover:text-purple-300 underline text-sm"
                    >
                      Create a character first
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {worldCharacters.map(char => (
                      <PartyCard
                        key={char.id}
                        character={char}
                        isSelected={selectedParty.includes(char.id)}
                        isPrimary={selectedParty[0] === char.id}
                        onClick={() => toggleCharacter(char.id)}
                      />
                    ))}
                  </div>
                )}

                <p className="text-gray-500 text-xs mt-2">
                  First selected character is the party lead. Only finalized characters can join campaigns.
                </p>
              </div>

              {/* Other world characters */}
              {worldId && otherCharacters.length > 0 && (
                <div>
                  <label className="block text-gray-500 text-sm mb-3">
                    Characters from other worlds <span className="text-gray-600">(import required)</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 opacity-50">
                    {otherCharacters.slice(0, 4).map(char => (
                      <PartyCard
                        key={char.id}
                        character={char}
                        isSelected={false}
                        isPrimary={false}
                        onClick={() => {}}
                        dimmed
                      />
                    ))}
                  </div>
                  <p className="text-gray-600 text-xs mt-2">
                    These characters would need to be imported and adapted to {world?.name || 'this world'}.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating || selectedParty.length === 0}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition"
                >
                  {creating ? 'Creating...' : 'Start Adventure'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setSelectedParty([]) }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Campaign List */}
        {filteredCampaigns.length === 0 && !showForm ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📜</div>
            <p className="text-gray-400 text-lg">
              {worldId ? `No campaigns in ${world?.name || 'this world'} yet` : 'No campaigns yet'}
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-block mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
            >
              Start Your First Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCampaigns.map(camp => (
              <div
                key={camp.id}
                onClick={() => navigate(`/play/${camp.id}`)}
                className="bg-gray-800/40 border border-gray-700/50 hover:border-purple-500 rounded-xl p-6 cursor-pointer transition"
              >
                {camp.intro_image_url && (
                  <img src={camp.intro_image_url} alt={camp.name} className="w-full h-32 object-cover rounded-lg mb-4" />
                )}
                <h3 className="text-xl font-bold text-white">{camp.name}</h3>
                <p className="text-purple-400 text-sm">{camp.world}</p>
                <p className="text-gray-400 mt-2 line-clamp-2">{camp.premise}</p>

                <div className="mt-4 pt-4 border-t border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {(camp.party || [camp.character_id]).slice(0, 4).map((id, i) => {
                        const char = getCharacter(id)
                        return char?.image_url ? (
                          <img key={id} src={char.image_url} alt={char.name}
                            className="w-8 h-8 rounded-full border-2 border-gray-800 object-cover" style={{ zIndex: 4 - i }} />
                        ) : (
                          <div key={id} className="w-8 h-8 rounded-full border-2 border-gray-800 bg-gray-600 flex items-center justify-center text-sm"
                            style={{ zIndex: 4 - i }}>🧙</div>
                        )
                      })}
                    </div>
                    <span className="text-gray-500 text-sm">
                      {camp.sessions?.length || 0} session{(camp.sessions?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function PartyCard({ character: char, isSelected, isPrimary, onClick, dimmed }: {
  character: Character; isSelected: boolean; isPrimary: boolean; onClick: () => void; dimmed?: boolean
}) {
  return (
    <div
      onClick={dimmed ? undefined : onClick}
      className={`relative bg-gray-900/50 border-2 rounded-lg p-3 transition ${dimmed ? 'cursor-default' : 'cursor-pointer'} ${
        isSelected ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      {isPrimary && (
        <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">Lead</div>
      )}
      {char.image_url ? (
        <img src={char.image_url} alt={char.name} className="w-full h-20 object-cover rounded mb-2" />
      ) : (
        <div className="w-full h-20 bg-gray-700 rounded mb-2 flex items-center justify-center text-3xl">🧙</div>
      )}
      <p className="text-white font-medium text-sm truncate">{char.name}</p>
      <p className="text-gray-400 text-xs truncate">Lvl {char.level} {char.race} {char.class}</p>
      {isSelected && (
        <div className="absolute top-2 left-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>
      )}
    </div>
  )
}
