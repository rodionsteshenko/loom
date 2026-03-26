import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import type { World, WorldSection, CoherenceIssue } from '../types'

const SECTIONS: { key: WorldSection; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'History' },
  { key: 'geography', label: 'Geography' },
  { key: 'factions', label: 'Factions' },
  { key: 'religion', label: 'Religion' },
  { key: 'key_figures', label: 'Key Figures' },
]

export default function WorldDetail() {
  const { worldId } = useParams<{ worldId: string }>()
  const [world, setWorld] = useState<World | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorldSection>('overview')
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`/api/worlds/${worldId}`)
      .then(res => { if (!res.ok) throw new Error('World not found'); return res.json() })
      .then(data => { setWorld(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [worldId])

  const handleRefine = async () => {
    if (!refinePrompt.trim() || !world) return
    setRefining(true)
    setError(null)
    try {
      const res = await fetch(`/api/worlds/${worldId}/sections/${activeTab}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: refinePrompt }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Update failed')
      const updated = await res.json()
      setWorld(updated)
      setRefinePrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setRefining(false)
    }
  }

  const handleValidate = async () => {
    setValidating(true)
    setValidationResult(null)
    try {
      const res = await fetch(`/api/worlds/${worldId}/validate`, { method: 'POST' })
      const result = await res.json()
      setValidationResult(result)
    } catch {
      setError('Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const handleFinalize = async () => {
    try {
      const res = await fetch(`/api/worlds/${worldId}/finalize`, { method: 'PATCH' })
      const updated = await res.json()
      setWorld(updated)
    } catch {
      setError('Failed to finalize world')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading world...</div>
      </div>
    )
  }

  if (!world) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error || 'World not found'}</div>
          <Link to="/" className="text-purple-400">← Back</Link>
        </div>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    generating: 'bg-yellow-600 text-yellow-100',
    draft: 'bg-amber-700 text-amber-100',
    validated: 'bg-emerald-700 text-emerald-100',
    active: 'bg-purple-600 text-purple-100',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-purple-400 hover:text-purple-300 font-bold text-sm">Loom</Link>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[world.status]}`}>
              {world.status}
            </span>
            {world.status !== 'active' && (
              <>
                <button
                  onClick={handleValidate}
                  disabled={validating}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm rounded-lg transition"
                >
                  {validating ? 'Validating...' : 'Validate'}
                </button>
                {validationResult?.can_finalize && (
                  <button
                    onClick={handleFinalize}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition"
                  >
                    Finalize
                  </button>
                )}
              </>
            )}
            <Link
              to={`/characters?world=${world.id}`}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition"
            >
              Characters
            </Link>
            <Link
              to={`/campaigns?world=${world.id}`}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition"
            >
              Campaigns
            </Link>
            <Link
              to={`/characters/new?world=${world.id}`}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition"
            >
              + New Character
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mb-6">{error}</div>
        )}

        {/* Hero: Title + Concept Images */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-100 mb-2">{world.name}</h1>
          {world.tagline && <p className="text-gray-400 text-lg mb-1">{world.tagline}</p>}
          <div className="flex gap-2 text-xs text-gray-500 mb-6">
            {world.overview?.genre && <span className="bg-gray-800 px-2 py-0.5 rounded">{world.overview.genre}</span>}
            {world.overview?.tone && <span className="bg-gray-800 px-2 py-0.5 rounded">{world.overview.tone}</span>}
            {world.overview?.era && <span className="bg-gray-800 px-2 py-0.5 rounded">{world.overview.era}</span>}
          </div>

          {/* Concept Images */}
          {world.concept_images && world.concept_images.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {world.concept_images.map((img, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-gray-700/50">
                  <img src={img.url} alt={img.subject} className="w-full h-auto" />
                  <div className="bg-gray-800/50 px-3 py-2 text-xs text-gray-400 capitalize">{img.type}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => { setActiveTab(s.key); setRefinePrompt('') }}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === s.key
                  ? 'text-purple-300 border-b-2 border-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Section Content */}
        <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-6 mb-6">
          <SectionContent world={world} section={activeTab} />
        </div>

        {/* Refine Prompt */}
        {world.status !== 'active' && (
          <div className="flex gap-3 mb-8">
            <input
              value={refinePrompt}
              onChange={e => setRefinePrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRefine()}
              disabled={refining}
              placeholder={`Refine ${SECTIONS.find(s => s.key === activeTab)?.label}... (e.g., "make it darker" or "add a rebel faction")`}
              className="flex-1 bg-gray-800/60 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
            <button
              onClick={handleRefine}
              disabled={refining || !refinePrompt.trim()}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition whitespace-nowrap"
            >
              {refining ? 'Updating...' : 'Update'}
            </button>
          </div>
        )}

        {/* Validation Report */}
        {validationResult && (
          <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Validation Report</h3>

            {/* Structural */}
            <div className="mb-4">
              <div className={`text-sm font-medium mb-2 ${validationResult.structural.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                Structure: {validationResult.structural.valid ? 'Valid' : `${validationResult.structural.errors.length} issues`}
              </div>
              {validationResult.structural.errors.map((e: string, i: number) => (
                <div key={i} className="text-sm text-red-300 ml-4 mb-1">- {e}</div>
              ))}
              {validationResult.structural.warnings.map((w: string, i: number) => (
                <div key={i} className="text-sm text-yellow-300 ml-4 mb-1">- {w}</div>
              ))}
            </div>

            {/* Coherence */}
            {validationResult.coherence?.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-300 mb-2">Coherence Check</div>
                {validationResult.coherence.map((issue: CoherenceIssue, i: number) => (
                  <div key={i} className={`text-sm ml-4 mb-1 ${
                    issue.severity === 'error' ? 'text-red-300' :
                    issue.severity === 'warning' ? 'text-yellow-300' : 'text-blue-300'
                  }`}>
                    [{issue.severity}] {issue.message}
                  </div>
                ))}
              </div>
            )}

            {validationResult.can_finalize && (
              <div className="mt-4 text-emerald-400 text-sm font-medium">
                World is ready to finalize.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Section Content Renderers ───

function SectionContent({ world, section }: { world: World; section: WorldSection }) {
  switch (section) {
    case 'overview':
      return (
        <div className="space-y-4">
          <div className="space-y-3">
            {(world.overview?.description || '').split(/\n\n+/).filter((p: string) => p.trim()).map((p: string, i: number) => (
              <p key={i} className="text-gray-300 leading-relaxed">{p.trim()}</p>
            ))}
          </div>
          {world.overview?.themes && (
            <div className="flex gap-2 flex-wrap">
              {world.overview.themes.map((t, i) => (
                <span key={i} className="bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full text-sm">{t}</span>
              ))}
            </div>
          )}
        </div>
      )

    case 'history':
      return (
        <div className="space-y-6">
          {world.history?.creation_myth && (
            <div>
              <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">Creation Myth</h4>
              <div className="space-y-3">
                {(world.history.creation_myth || '').split(/\n\n+/).filter((p: string) => p.trim()).map((p: string, i: number) => (
                  <p key={i} className="text-gray-300 leading-relaxed">{p.trim()}</p>
                ))}
              </div>
            </div>
          )}
          {world.history?.timeline && (
            <div>
              <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">Timeline</h4>
              <div className="space-y-4 border-l-2 border-purple-800/50 pl-6">
                {world.history.timeline.map((event, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-8 top-1 w-3 h-3 rounded-full bg-purple-600 border-2 border-gray-900" />
                    <div className="text-xs text-purple-400 mb-1">{event.year_label} — {event.era}</div>
                    <div className="text-gray-200 font-medium">{event.name}</div>
                    <p className="text-gray-400 text-sm mt-1">{event.description}</p>
                    {event.impact && <p className="text-gray-500 text-xs mt-1 italic">Impact: {event.impact}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )

    case 'geography':
      return (
        <div className="space-y-6">
          {world.geography?.overview && (
            <p className="text-gray-300 leading-relaxed">{world.geography.overview}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {world.geography?.regions?.map((region, i) => (
              <div key={i} className="bg-gray-900/40 border border-gray-700/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-gray-100 font-medium">{region.name}</h4>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{region.type}</span>
                </div>
                <p className="text-gray-400 text-sm mb-2">{region.description}</p>
                {region.notable_features?.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Features: {region.notable_features.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )

    case 'factions':
      return (
        <div className="space-y-4">
          {world.factions?.map((faction, i) => (
            <div key={i} className="bg-gray-900/40 border border-gray-700/30 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-gray-100 font-medium text-lg">{faction.name}</h4>
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{faction.type}</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">{faction.description}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div><span className="text-gray-500">Goals:</span> <span className="text-gray-300">{faction.goals}</span></div>
                <div><span className="text-gray-500">Methods:</span> <span className="text-gray-300">{faction.methods}</span></div>
                <div><span className="text-gray-500">Leader:</span> <span className="text-gray-300">{faction.leader}</span></div>
                {faction.territory && <div><span className="text-gray-500">Territory:</span> <span className="text-gray-300">{faction.territory}</span></div>}
              </div>
              {(faction.allies?.length > 0 || faction.enemies?.length > 0) && (
                <div className="mt-2 text-xs text-gray-500">
                  {faction.allies?.length > 0 && <span className="text-emerald-400">Allies: {faction.allies.join(', ')}</span>}
                  {faction.allies?.length > 0 && faction.enemies?.length > 0 && ' | '}
                  {faction.enemies?.length > 0 && <span className="text-red-400">Enemies: {faction.enemies.join(', ')}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )

    case 'religion':
      return (
        <div className="space-y-6">
          {world.religion?.overview && (
            <p className="text-gray-300 leading-relaxed">{world.religion.overview}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {world.religion?.deities_or_forces?.map((deity, i) => (
              <div key={i} className="bg-gray-900/40 border border-gray-700/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-gray-100 font-medium">{deity.name}</h4>
                  {deity.symbol && <span className="text-xs text-gray-500">({deity.symbol})</span>}
                </div>
                <div className="text-purple-400 text-sm mb-2">{deity.domain}</div>
                <p className="text-gray-400 text-sm">{deity.description}</p>
                {deity.followers && <p className="text-gray-500 text-xs mt-2">Followers: {deity.followers}</p>}
              </div>
            ))}
          </div>
        </div>
      )

    case 'key_figures':
      return (
        <div className="space-y-4">
          {world.key_figures?.map((figure, i) => (
            <div key={i} className="bg-gray-900/40 border border-gray-700/30 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="text-gray-100 font-medium text-lg">{figure.name}</h4>
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{figure.role}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${figure.alive ? 'bg-emerald-900/50 text-emerald-300' : 'bg-gray-800 text-gray-500'}`}>
                  {figure.alive ? 'Alive' : 'Deceased'}
                </span>
              </div>
              {figure.title && <div className="text-purple-400 text-sm mb-2">{figure.title}</div>}
              <p className="text-gray-400 text-sm">{figure.description}</p>
            </div>
          ))}
        </div>
      )

    default:
      return <div className="text-gray-500">Unknown section</div>
  }
}
