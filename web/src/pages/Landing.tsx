import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { World } from '../types'

export default function Landing() {
  const [worlds, setWorlds] = useState<World[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/worlds')
      .then(res => res.json())
      .then(data => { setWorlds(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const statusColors: Record<string, string> = {
    generating: 'bg-yellow-600/80 text-yellow-100',
    draft: 'bg-amber-700/80 text-amber-100',
    validated: 'bg-emerald-700/80 text-emerald-100',
    active: 'bg-purple-600/80 text-purple-100',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 relative overflow-hidden">
      {/* Atmospheric background layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/15 via-transparent to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 tracking-widest uppercase">Loom</div>
          <div className="flex gap-4 text-sm">
            <Link to="/characters" className="text-gray-400 hover:text-purple-300 transition-colors">Characters</Link>
            <Link to="/campaigns" className="text-gray-400 hover:text-purple-300 transition-colors">Campaigns</Link>
          </div>
        </nav>

        {/* Hero */}
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
          <div className="inline-block mb-6">
            <div className="text-6xl sm:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-br from-purple-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Loom
              </span>
            </div>
          </div>
          <p className="text-gray-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
            Build worlds. Create characters. Play adventures.
            <br />
            <span className="text-gray-500">AI-powered D&D storytelling.</span>
          </p>

          <div className="mt-10">
            <Link
              to="/worlds/new"
              className="inline-flex items-center gap-3 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-lg font-medium transition-all hover:shadow-lg hover:shadow-purple-600/25 hover:-translate-y-0.5"
            >
              Create a World
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
        </div>

        {/* Your Worlds */}
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-semibold text-gray-200">Your Worlds</h2>
            {worlds.length > 0 && (
              <Link to="/worlds" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                View all
              </Link>
            )}
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="text-gray-500">Loading worlds...</div>
            </div>
          ) : worlds.length === 0 ? (
            <div
              onClick={() => navigate('/worlds/new')}
              className="group cursor-pointer border-2 border-dashed border-gray-700 hover:border-purple-600/50 rounded-2xl p-16 text-center transition-all hover:bg-purple-900/5"
            >
              <div className="text-5xl mb-4 opacity-60 group-hover:opacity-100 transition-opacity">
                🌍
              </div>
              <p className="text-gray-400 text-lg mb-2">No worlds yet</p>
              <p className="text-gray-500 text-sm mb-6">Every great adventure starts with a world.</p>
              <span className="inline-block px-6 py-2 bg-purple-600/20 text-purple-300 rounded-lg text-sm group-hover:bg-purple-600/30 transition-colors">
                Create Your First World
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {worlds.map(world => (
                <Link
                  key={world.id}
                  to={`/worlds/${world.id}`}
                  className="group bg-gray-800/40 border border-gray-700/50 hover:border-purple-600/40 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-purple-900/20 hover:-translate-y-0.5"
                >
                  {/* Thumbnail */}
                  <div className="h-40 bg-gray-900 relative overflow-hidden">
                    {world.concept_images?.[0]?.url ? (
                      <img
                        src={world.concept_images[0].url}
                        alt={world.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                        <span className="text-4xl opacity-40">🌍</span>
                      </div>
                    )}
                    {/* Status badge */}
                    <div className={`absolute top-3 right-3 px-2 py-0.5 rounded text-xs font-medium ${statusColors[world.status] || 'bg-gray-700 text-gray-300'}`}>
                      {world.status}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-gray-100 group-hover:text-purple-300 transition-colors">
                      {world.name}
                    </h3>
                    {world.tagline && (
                      <p className="text-gray-500 text-sm mt-1 line-clamp-2">{world.tagline}</p>
                    )}
                    <div className="flex gap-2 mt-3 text-xs text-gray-500">
                      {world.overview?.genre && <span className="bg-gray-800 px-2 py-0.5 rounded">{world.overview.genre}</span>}
                      {world.overview?.tone && <span className="bg-gray-800 px-2 py-0.5 rounded">{world.overview.tone.split(',')[0]}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="max-w-6xl mx-auto px-6 pb-20">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mb-16" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to="/characters"
              className="group flex items-center gap-5 bg-gray-800/30 border border-gray-700/40 hover:border-purple-600/30 rounded-xl p-6 transition-all hover:bg-gray-800/50"
            >
              <div className="text-4xl opacity-70 group-hover:opacity-100 transition-opacity">
                🎭
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-200 group-hover:text-purple-300 transition-colors">
                  Characters
                </h3>
                <p className="text-gray-500 text-sm mt-0.5">Browse and create D&D characters</p>
              </div>
            </Link>

            <Link
              to="/campaigns"
              className="group flex items-center gap-5 bg-gray-800/30 border border-gray-700/40 hover:border-purple-600/30 rounded-xl p-6 transition-all hover:bg-gray-800/50"
            >
              <div className="text-4xl opacity-70 group-hover:opacity-100 transition-opacity">
                📜
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-200 group-hover:text-purple-300 transition-colors">
                  Campaigns
                </h3>
                <p className="text-gray-500 text-sm mt-0.5">Continue your adventures</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-6xl mx-auto px-6 pb-8 text-center">
          <p className="text-gray-600 text-xs">Powered by GPT-5.4 & Gemini</p>
        </div>
      </div>
    </div>
  )
}
