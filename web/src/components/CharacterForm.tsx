import { useState } from 'react'
import type { CharacterFormData } from '../types'
import { RACES, CLASSES, ALIGNMENTS } from '../types'

interface Props {
  onGenerate: (data: CharacterFormData) => void
  isGenerating: boolean
  worldName?: string
}

export default function CharacterForm({ onGenerate, isGenerating, worldName }: Props) {
  const [formData, setFormData] = useState<CharacterFormData>({
    prompt: '',
    race: '',
    class: '',
    level: 1,
    alignment: '',
    art_style: '',
    custom_style: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.prompt.trim()) return
    onGenerate(formData)
  }

  const formatAlignment = (alignment: string) => {
    return alignment.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-6">
      {worldName && (
        <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg px-4 py-3 text-sm">
          <span className="text-gray-400">Creating character in </span>
          <span className="text-purple-300 font-medium">{worldName}</span>
          <span className="text-gray-500 ml-2">(art style inherited from world)</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-purple-300 mb-2">
          Character Concept *
        </label>
        <textarea
          value={formData.prompt}
          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
          placeholder="A battle-scarred half-orc who secretly writes poetry..."
          className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
          rows={3}
          required
        />
        <p className="text-gray-500 text-xs mt-1">Describe your character concept, personality, or backstory hook</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">Race</label>
          <select
            value={formData.race}
            onChange={(e) => setFormData({ ...formData, race: e.target.value })}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
          >
            <option value="">Any (AI decides)</option>
            {RACES.filter(r => r).map(race => (
              <option key={race} value={race}>{race}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">Class</label>
          <select
            value={formData.class}
            onChange={(e) => setFormData({ ...formData, class: e.target.value })}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
          >
            <option value="">Any (AI decides)</option>
            {CLASSES.filter(c => c).map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">Level</label>
          <input
            type="number"
            min={1}
            max={20}
            value={formData.level}
            onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">Alignment</label>
          <select
            value={formData.alignment}
            onChange={(e) => setFormData({ ...formData, alignment: e.target.value })}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
          >
            <option value="">Any (AI decides)</option>
            {ALIGNMENTS.filter(a => a).map(alignment => (
              <option key={alignment} value={alignment}>{formatAlignment(alignment)}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isGenerating || !formData.prompt.trim()}
        className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </>
        ) : (
          <>Generate Character</>
        )}
      </button>
    </form>
  )
}
