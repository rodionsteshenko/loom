import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

interface Campaign {
  id: string
  name: string
  world: string
  world_id?: string
  premise: string
  art_style?: string
  intro_image_url?: string
  status?: string
  character_id?: string
  party?: string[]
}

export default function CampaignSettings() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining] = useState(false)
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const navigate = useNavigate()

  const isDraft = !campaign?.status || campaign.status === 'draft'

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}`)
      .then(res => { if (!res.ok) throw new Error('Campaign not found'); return res.json() })
      .then(data => { setCampaign(data); setLoading(false) })
      .catch(err => { setError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false) })
  }, [campaignId])

  const handleRefine = async () => {
    if (!refinePrompt.trim()) return
    setRefining(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/refine`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: refinePrompt }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Refinement failed')
      setCampaign(await res.json())
      setRefinePrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed')
    } finally {
      setRefining(false)
    }
  }

  const handleFinalize = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/finalize`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to finalize')
      setCampaign(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize')
    }
  }

  const handleRegenerateImage = async () => {
    setRegeneratingImage(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate_intro_image: true }),
      })
      if (!res.ok) throw new Error('Failed to regenerate image')
      const data = await res.json()
      setCampaign(data.campaign)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate')
    } finally {
      setRegeneratingImage(false)
    }
  }

  const handleApplyWrapUp = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/wrap-up/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_character: true, approved_world: true }),
      })
      if (!res.ok) throw new Error('Failed to apply wrap-up')
      const data = await res.json()
      setCampaign(data.campaign)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-purple-400">Loading...</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">Campaign not found</div>
          <Link to="/campaigns" className="text-purple-400 hover:underline">Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950">
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={campaign.world_id ? `/campaigns?world=${campaign.world_id}` : '/campaigns'} className="text-gray-400 hover:text-purple-300 text-sm">
            ← Back
          </Link>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              campaign.status === 'completed' ? 'bg-emerald-600/80 text-emerald-100' :
              campaign.status === 'active' ? 'bg-purple-600/80 text-purple-100' :
              'bg-amber-700/80 text-amber-100'
            }`}>
              {campaign.status || 'draft'}
            </span>
            {isDraft && (
              <button
                onClick={handleFinalize}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition"
              >
                Finalize
              </button>
            )}
            {campaign.status === 'active' && (
              <button
                onClick={() => navigate(`/play/${campaign.id}`)}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition"
              >
                Play
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mb-6">{error}</div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left — Intro Image */}
          <div className="lg:w-1/3 lg:sticky lg:top-24 lg:self-start">
            {campaign.intro_image_url ? (
              <div className="relative group">
                <img src={campaign.intro_image_url} alt={campaign.name} className="w-full rounded-lg border border-gray-700" />
                <button
                  onClick={handleRegenerateImage}
                  disabled={regeneratingImage}
                  className="absolute bottom-3 right-3 px-3 py-2 bg-black/70 hover:bg-black/90 disabled:opacity-50 text-white text-sm rounded-lg backdrop-blur transition-colors opacity-0 group-hover:opacity-100"
                >
                  {regeneratingImage ? '⏳ Generating...' : '🔄 Regenerate'}
                </button>
              </div>
            ) : (
              <div className="w-full aspect-video bg-gray-800 rounded-lg flex flex-col items-center justify-center border border-gray-700 gap-3">
                <span className="text-4xl">📜</span>
                <button
                  onClick={handleRegenerateImage}
                  disabled={regeneratingImage}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg transition"
                >
                  {regeneratingImage ? 'Generating...' : '🎨 Generate Image'}
                </button>
              </div>
            )}
          </div>

          {/* Right — Campaign Details */}
          <div className="lg:w-2/3 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-100 mb-1">{campaign.name}</h1>
              <p className="text-gray-500 text-sm">{campaign.world}</p>
            </div>

            <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Premise</h2>
              <p className="text-gray-300 leading-relaxed whitespace-pre-line">{campaign.premise}</p>
            </div>

            <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Details</h2>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-500">World:</span> <span className="text-gray-300">{campaign.world}</span></div>
                {campaign.art_style && <div><span className="text-gray-500">Art Style:</span> <span className="text-gray-300">{campaign.art_style}</span></div>}
                {campaign.party && <div><span className="text-gray-500">Party Size:</span> <span className="text-gray-300">{campaign.party.length} member{campaign.party.length !== 1 ? 's' : ''}</span></div>}
                {campaign.world_id && (
                  <Link to={`/worlds/${campaign.world_id}`} className="text-purple-400 hover:text-purple-300 text-sm block mt-2">View World →</Link>
                )}
              </div>
            </div>

            {/* Refine prompt — only in draft mode */}
            {isDraft && (
              <div className="flex gap-3">
                <input
                  value={refinePrompt}
                  onChange={e => setRefinePrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRefine()}
                  disabled={refining}
                  placeholder="Refine this campaign... (e.g., 'make it more political' or 'add a mystery element')"
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

            {/* Campaign wrap-up — shown after completion */}
            {(campaign as any).wrap_up && (
              <div className="space-y-6">
                <div className="h-px bg-gradient-to-r from-transparent via-purple-700 to-transparent" />
                <h2 className="text-xl font-bold text-emerald-400">Campaign Complete</h2>

                {/* Summary */}
                {(campaign as any).wrap_up.campaign_summary && (
                  <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Campaign Journal</h3>
                    <p className="text-gray-300 leading-relaxed whitespace-pre-line">{(campaign as any).wrap_up.campaign_summary}</p>
                  </div>
                )}

                {/* Character updates */}
                {(campaign as any).wrap_up.character_updates && (
                  <div className="bg-gray-800/30 border border-emerald-700/30 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Character Updates</h3>
                    <div className="space-y-2 text-sm">
                      {(campaign as any).wrap_up.character_updates.xp_award > 0 && (
                        <div className="text-yellow-400">+{(campaign as any).wrap_up.character_updates.xp_award} XP</div>
                      )}
                      {(campaign as any).wrap_up.character_updates.items_to_add?.length > 0 && (
                        <div><span className="text-gray-500">Items gained:</span> <span className="text-green-400">{(campaign as any).wrap_up.character_updates.items_to_add.join(', ')}</span></div>
                      )}
                      {(campaign as any).wrap_up.character_updates.new_relationships?.length > 0 && (
                        <div><span className="text-gray-500">New relationships:</span> <span className="text-blue-400">{(campaign as any).wrap_up.character_updates.new_relationships.map((r: any) => `${r.name} (${r.type})`).join(', ')}</span></div>
                      )}
                      {(campaign as any).wrap_up.character_updates.backstory_addition && (
                        <div className="mt-3">
                          <span className="text-gray-500">Backstory addition:</span>
                          <p className="text-gray-300 mt-1 italic">{(campaign as any).wrap_up.character_updates.backstory_addition}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* World updates */}
                {(campaign as any).wrap_up.world_updates && (
                  <div className="bg-gray-800/30 border border-cyan-700/30 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3">World Updates</h3>
                    <div className="space-y-2 text-sm">
                      {(campaign as any).wrap_up.world_updates.timeline_event && (
                        <div>
                          <span className="text-gray-500">New historical event:</span>
                          <span className="text-gray-300 ml-1">{(campaign as any).wrap_up.world_updates.timeline_event.name}</span>
                          <p className="text-gray-400 text-xs mt-1">{(campaign as any).wrap_up.world_updates.timeline_event.description}</p>
                        </div>
                      )}
                      {(campaign as any).wrap_up.world_updates.faction_changes?.length > 0 && (
                        <div>
                          <span className="text-gray-500">Faction changes:</span>
                          {(campaign as any).wrap_up.world_updates.faction_changes.map((c: any, i: number) => (
                            <div key={i} className="text-gray-300 ml-4 text-xs">• {c.faction}: {c.change}</div>
                          ))}
                        </div>
                      )}
                      {(campaign as any).wrap_up.world_updates.npc_changes?.length > 0 && (
                        <div>
                          <span className="text-gray-500">NPC changes:</span>
                          {(campaign as any).wrap_up.world_updates.npc_changes.map((c: any, i: number) => (
                            <div key={i} className="text-gray-300 ml-4 text-xs">• {c.name}: {c.change}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Apply button */}
                {!(campaign as any).wrap_up_applied && (
                  <button
                    onClick={handleApplyWrapUp}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition"
                  >
                    Apply Updates to Character & World
                  </button>
                )}
                {(campaign as any).wrap_up_applied && (
                  <div className="text-center text-emerald-400 text-sm py-3">Updates applied to character and world.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
