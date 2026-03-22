import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ART_STYLES } from '../constants/artStyles'

interface Campaign {
  id: string
  name: string
  world: string
  premise: string
  art_style?: string
  intro_image_url?: string
}

export default function CampaignSettings() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>('oil-painting')

  useEffect(() => {
    const loadCampaign = async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`)
        if (!res.ok) throw new Error('Campaign not found')
        const data = await res.json()
        setCampaign(data)
        setSelectedStyle(data.art_style || 'oil-painting')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign')
      } finally {
        setLoading(false)
      }
    }
    loadCampaign()
  }, [campaignId])

  const handleSave = async (regenerateImage: boolean = false) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Only generate intro image if explicitly requested OR if none exists
      const shouldGenerateImage = regenerateImage || !campaign?.intro_image_url
      
      const res = await fetch(`/api/campaigns/${campaignId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          art_style: selectedStyle,
          generate_intro_image: shouldGenerateImage
        })
      })
      
      if (!res.ok) throw new Error('Failed to save settings')
      
      const data = await res.json()
      setCampaign(data.campaign)
      
      setSuccess(shouldGenerateImage ? 'Saved with image!' : 'Saved!')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-purple-400">Loading...</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">Campaign not found</div>
          <Link to="/campaigns" className="text-purple-400 hover:underline">Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-purple-800/50 bg-black/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/play/${campaignId}`} className="text-gray-400 hover:text-white">←</Link>
            <div>
              <h1 className="text-lg font-semibold text-white">Settings</h1>
              <p className="text-gray-500 text-xs">{campaign.name}</p>
            </div>
          </div>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded text-sm font-medium transition"
          >
            {saving ? 'Saving...' : success || 'Save'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded p-3 text-red-200 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Art Style */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-2">🎨 Art Style</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {ART_STYLES.map(style => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`p-2 rounded border text-left transition ${
                  selectedStyle === style.id
                    ? 'border-purple-500 bg-purple-900/40'
                    : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                }`}
              >
                <div className="text-white text-sm font-medium truncate">{style.name}</div>
                <div className="text-gray-500 text-xs truncate">{style.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Intro Image */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-2">🖼️ Intro Image (Scene 0)</h2>
          <div className="bg-gray-800/30 border border-gray-700 rounded p-4">
            {campaign.intro_image_url ? (
              <div className="space-y-3">
                <img 
                  src={campaign.intro_image_url} 
                  alt="Campaign intro" 
                  className="w-full max-w-md rounded-lg mx-auto"
                />
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded text-sm transition"
                >
                  {saving ? 'Generating...' : '🔄 Regenerate Intro Image'}
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-3">No intro image yet</div>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded transition"
                >
                  {saving ? 'Generating...' : '🎨 Generate Intro Image'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Campaign Info */}
        <section className="bg-gray-800/30 border border-gray-700 rounded p-4">
          <h2 className="text-sm font-medium text-gray-400 mb-3">📜 Campaign Info</h2>
          <div className="grid gap-3 text-sm">
            <div>
              <span className="text-gray-500">World:</span>
              <span className="text-gray-300 ml-2">{campaign.world}</span>
            </div>
            <div>
              <span className="text-gray-500">Premise:</span>
              <p className="text-gray-300 mt-1">{campaign.premise}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
