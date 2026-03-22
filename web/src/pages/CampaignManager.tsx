import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Campaign, Character } from '../types'

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    world: '',
    premise: ''
  })
  
  // Party selection (support multiple for future multiplayer)
  const [selectedParty, setSelectedParty] = useState<string[]>(() => {
    const preselected = searchParams.get('character')
    return preselected ? [preselected] : []
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/campaigns').then(r => r.json()),
      fetch('/api/characters').then(r => r.json())
    ])
      .then(([camps, chars]) => {
        setCampaigns(camps)
        setCharacters(chars)
        setLoading(false)
        if (searchParams.get('character')) {
          setShowForm(true)
        }
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [searchParams])

  const toggleCharacter = (id: string) => {
    setSelectedParty(prev => 
      prev.includes(id) 
        ? prev.filter(c => c !== id)
        : [...prev, id]
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
      // All fields optional - AI will generate missing ones based on character
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name || undefined,
          world: formData.world || undefined,
          premise: formData.premise || undefined,
          character_id: selectedParty[0],
          party: selectedParty,
          auto_generate: !formData.name || !formData.world || !formData.premise
        })
      })

      if (!res.ok) throw new Error(await res.text())
      
      const campaign = await res.json()
      navigate(`/play/${campaign.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
      setCreating(false)
    }
  }

  const getCharacter = (id: string) => characters.find(c => c.id === id)
  
  const getPartyNames = (camp: Campaign) => {
    const party = camp.party || [camp.character_id]
    return party.map(id => {
      const char = getCharacter(id)
      return char ? char.name : id
    }).join(', ')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading campaigns...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-purple-800/50 bg-black/30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              📜 Campaigns
            </h1>
            <p className="text-gray-400 text-sm mt-1">Your adventures await</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
            >
              + New Campaign
            </button>
            <Link 
              to="/characters"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Characters
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

        {/* Create Campaign Form */}
        {showForm && (
          <div className="bg-gray-800/50 border border-purple-700 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Create New Campaign</h2>
            <form onSubmit={handleCreate} className="space-y-6">
              <p className="text-gray-400 text-sm">
                All fields are optional. Select a character and we'll craft a campaign around their story.
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
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm mb-1">
                    World Setting <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.world}
                    onChange={e => setFormData({ ...formData, world: e.target.value })}
                    placeholder="Auto-generated from character"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">
                  Premise <span className="text-gray-500">(optional)</span>
                </label>
                <textarea
                  value={formData.premise}
                  onChange={e => setFormData({ ...formData, premise: e.target.value })}
                  placeholder="Auto-generated based on character's backstory, motivation, and wounds..."
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Party Selection */}
              <div>
                <label className="block text-gray-300 text-sm mb-3">
                  Select Party Members 
                  <span className="text-gray-500 ml-2">
                    ({selectedParty.length} selected)
                  </span>
                </label>
                
                {characters.length === 0 ? (
                  <div className="bg-gray-700/50 rounded-lg p-6 text-center">
                    <p className="text-gray-400 mb-3">No characters yet</p>
                    <Link 
                      to="/"
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      Create a character first
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {characters.map(char => {
                      const isSelected = selectedParty.includes(char.id)
                      const isPrimary = selectedParty[0] === char.id
                      
                      return (
                        <div
                          key={char.id}
                          onClick={() => toggleCharacter(char.id)}
                          className={`relative bg-gray-700/50 border-2 rounded-lg p-3 cursor-pointer transition ${
                            isSelected 
                              ? 'border-purple-500 bg-purple-900/30' 
                              : 'border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          {isPrimary && (
                            <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                              Lead
                            </div>
                          )}
                          
                          {char.image_url ? (
                            <img 
                              src={char.image_url} 
                              alt={char.name}
                              className="w-full h-20 object-cover rounded mb-2"
                            />
                          ) : (
                            <div className="w-full h-20 bg-gray-600 rounded mb-2 flex items-center justify-center text-3xl">
                              🧙
                            </div>
                          )}
                          
                          <p className="text-white font-medium text-sm truncate">
                            {char.name}
                          </p>
                          <p className="text-gray-400 text-xs truncate">
                            Lvl {char.level} {char.race} {char.class}
                          </p>
                          
                          {isSelected && (
                            <div className="absolute top-2 left-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                
                <p className="text-gray-500 text-xs mt-2">
                  First selected character is the party lead. Click to toggle selection.
                </p>
              </div>

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
                  onClick={() => {
                    setShowForm(false)
                    setSelectedParty([])
                  }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Campaign List */}
        {campaigns.length === 0 && !showForm ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📜</div>
            <p className="text-gray-400 text-lg">No campaigns yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-block mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
            >
              Start Your First Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map(camp => (
              <div
                key={camp.id}
                onClick={() => navigate(`/play/${camp.id}`)}
                className="bg-gray-800/50 border border-gray-700 hover:border-purple-500 rounded-lg p-6 cursor-pointer transition"
              >
                <h3 className="text-xl font-bold text-white">{camp.name}</h3>
                <p className="text-purple-400 text-sm">{camp.world}</p>
                <p className="text-gray-400 mt-2 line-clamp-2">{camp.premise}</p>
                
                {/* Party display */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-gray-500 text-sm">Party:</span>
                    <span className="text-gray-300 text-sm">{getPartyNames(camp)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {(camp.party || [camp.character_id]).slice(0, 4).map((id, i) => {
                        const char = getCharacter(id)
                        return char?.image_url ? (
                          <img 
                            key={id}
                            src={char.image_url}
                            alt={char.name}
                            className="w-8 h-8 rounded-full border-2 border-gray-800 object-cover"
                            style={{ zIndex: 4 - i }}
                          />
                        ) : (
                          <div 
                            key={id}
                            className="w-8 h-8 rounded-full border-2 border-gray-800 bg-gray-600 flex items-center justify-center text-sm"
                            style={{ zIndex: 4 - i }}
                          >
                            🧙
                          </div>
                        )
                      })}
                    </div>
                    <span className="text-gray-500 text-sm">
                      {camp.sessions.length} session{camp.sessions.length !== 1 ? 's' : ''}
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
