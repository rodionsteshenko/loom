import type { Character } from '../types'

interface Props {
  character: Character
}

function StatBlock({ stats }: { stats: Character['stats'] }) {
  const statNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  return (
    <div className="grid grid-cols-6 gap-2 text-center">
      {statNames.map(stat => (
        <div key={stat} className="bg-gray-900 rounded-lg p-2">
          <div className="text-xs text-gray-500 font-medium">{stat}</div>
          <div className="text-xl font-bold text-purple-300">{stats[stat]}</div>
          <div className="text-xs text-gray-400">{getModifier(stats[stat])}</div>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-700 pt-4">
      <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  )
}

function formatAlignment(alignment: string) {
  return alignment.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function CharacterPreview({ character }: Props) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">{character.name}</h2>
        <p className="text-purple-300">
          Level {character.level} {character.race} {character.class}
          {character.subclass && ` (${character.subclass})`}
        </p>
        <p className="text-gray-400 text-sm">
          {formatAlignment(character.alignment)}
          {character.background && ` • ${character.background}`}
        </p>
      </div>

      {/* Stats */}
      <StatBlock stats={character.stats} />

      {/* Combat Stats */}
      {(character.hp || character.armor_class) && (
        <div className="flex gap-4 text-sm">
          {character.hp && (
            <span className="bg-red-900/50 text-red-300 px-3 py-1 rounded">
              HP: {character.hp.current}/{character.hp.max}
            </span>
          )}
          {character.armor_class && (
            <span className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded">
              AC: {character.armor_class}
            </span>
          )}
          {character.movement_speed && (
            <span className="bg-green-900/50 text-green-300 px-3 py-1 rounded">
              Speed: {character.movement_speed}ft
            </span>
          )}
        </div>
      )}

      {/* Physical Description */}
      <Section title="Physical Description">
        <p className="text-gray-300 text-sm leading-relaxed">{character.physical_description}</p>
      </Section>

      {/* Personality */}
      {((character.traits?.length ?? 0) > 0 || (character.flaws?.length ?? 0) > 0) && (
        <Section title="Personality">
          {(character.traits?.length ?? 0) > 0 && (
            <div className="mb-2">
              <span className="text-gray-500 text-xs">Traits: </span>
              <span className="text-gray-300 text-sm">{character.traits?.join(', ')}</span>
            </div>
          )}
          {(character.flaws?.length ?? 0) > 0 && (
            <div>
              <span className="text-gray-500 text-xs">Flaws: </span>
              <span className="text-gray-300 text-sm">{character.flaws?.join(', ')}</span>
            </div>
          )}
        </Section>
      )}

      {/* Psychology */}
      {(character.want || character.need || character.wound) && (
        <Section title="Psychology">
          <div className="space-y-2 text-sm">
            {character.want && (
              <div><span className="text-purple-400">Want:</span> <span className="text-gray-300">{character.want}</span></div>
            )}
            {character.need && (
              <div><span className="text-purple-400">Need:</span> <span className="text-gray-300">{character.need}</span></div>
            )}
            {character.wound && (
              <div><span className="text-purple-400">Wound:</span> <span className="text-gray-300">{character.wound}</span></div>
            )}
            {character.lie_they_believe && (
              <div><span className="text-purple-400">Lie:</span> <span className="text-gray-300">{character.lie_they_believe}</span></div>
            )}
          </div>
        </Section>
      )}

      {/* Backstory */}
      <Section title="Backstory">
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{character.backstory}</p>
      </Section>

      {/* Skills & Languages */}
      {((character.skills?.length ?? 0) > 0 || (character.languages?.length ?? 0) > 0) && (
        <Section title="Skills & Languages">
          {(character.skills?.length ?? 0) > 0 && (
            <div className="mb-2">
              <span className="text-gray-500 text-xs">Skills: </span>
              <span className="text-gray-300 text-sm">{character.skills?.join(', ')}</span>
            </div>
          )}
          {(character.languages?.length ?? 0) > 0 && (
            <div>
              <span className="text-gray-500 text-xs">Languages: </span>
              <span className="text-gray-300 text-sm">{character.languages?.join(', ')}</span>
            </div>
          )}
        </Section>
      )}

      {/* Download Button */}
      <div className="pt-4 border-t border-gray-700">
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${character.name.toLowerCase().replace(/\s+/g, '_')}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          💾 Download JSON
        </button>
      </div>
    </div>
  )
}
