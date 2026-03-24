import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import type { CampaignWithSession, Choice, RollResult, Session } from '../types'
import GeneratingOverlay from '../components/GeneratingOverlay'

const DIFFICULTY_COLORS: Record<string, string> = {
  trivial: 'text-green-400 border-green-500',
  easy: 'text-blue-400 border-blue-500',
  medium: 'text-yellow-400 border-yellow-500',
  hard: 'text-orange-400 border-orange-500',
  extreme: 'text-red-400 border-red-500',
}

const OUTCOME_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  critical_success: { bg: 'bg-green-900/50', text: 'text-green-300', label: 'CRITICAL SUCCESS!' },
  success: { bg: 'bg-green-800/30', text: 'text-green-400', label: 'Success' },
  partial_success: { bg: 'bg-yellow-800/30', text: 'text-yellow-400', label: 'Partial Success' },
  failure: { bg: 'bg-red-800/30', text: 'text-red-400', label: 'Failure' },
  critical_failure: { bg: 'bg-red-900/50', text: 'text-red-300', label: 'CRITICAL FAILURE!' },
}

// ─── Page model: each session = Scene page + Result page ───

type Page =
  | { type: 'intro' }
  | { type: 'scene'; sessionIndex: number; session: Session }
  | { type: 'result'; sessionIndex: number; session: Session }

function buildPages(sessions: Session[]): Page[] {
  const pages: Page[] = [{ type: 'intro' }]
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    pages.push({ type: 'scene', sessionIndex: i, session: s })
    if (s.state === 'complete' && s.outcome_narrative) {
      pages.push({ type: 'result', sessionIndex: i, session: s })
    }
  }
  return pages
}

// ─── Components ───

function D20Shape({ number, className }: { number: number; className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className || ''}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <polygon points="50,5 95,35 80,90 20,90 5,35" fill="currentColor" className="opacity-20" />
        <polygon points="50,5 95,35 80,90 20,90 5,35" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-80" />
        <line x1="50" y1="5" x2="20" y2="90" stroke="currentColor" strokeWidth="1" className="opacity-30" />
        <line x1="50" y1="5" x2="80" y2="90" stroke="currentColor" strokeWidth="1" className="opacity-30" />
        <line x1="5" y1="35" x2="80" y2="90" stroke="currentColor" strokeWidth="1" className="opacity-20" />
        <line x1="95" y1="35" x2="20" y2="90" stroke="currentColor" strokeWidth="1" className="opacity-20" />
      </svg>
      <span className="absolute text-2xl font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{number}</span>
    </div>
  )
}

function DiceRoll({ rolling, result }: { rolling: boolean; result?: RollResult }) {
  const [displayNum, setDisplayNum] = useState(20)
  useEffect(() => {
    if (!rolling) return
    const interval = setInterval(() => setDisplayNum(Math.floor(Math.random() * 20) + 1), 80)
    return () => clearInterval(interval)
  }, [rolling])

  const finalNum = result?.natural || displayNum
  const isNat20 = result?.natural === 20
  const isNat1 = result?.natural === 1

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`w-20 h-20 transition-all
        ${rolling ? 'text-purple-400 animate-bounce' : ''}
        ${isNat20 ? 'text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.5)]' : ''}
        ${isNat1 ? 'text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.5)]' : ''}
        ${!isNat20 && !isNat1 && !rolling ? 'text-gray-300' : ''}`}>
        <D20Shape number={rolling ? displayNum : finalNum} />
      </div>
      {result && !rolling && (
        <div className="text-center text-sm">
          <div className="text-gray-400">{result.natural} + {result.modifier} = {result.total} vs DC {result.dc}</div>
          {result.skill && <div className="text-purple-400 text-xs mt-1">{result.skill} check</div>}
        </div>
      )}
    </div>
  )
}

function ChoiceCard({ choice, onClick, disabled, selected, dimmed }: {
  choice: Choice; onClick: () => void; disabled: boolean; selected?: boolean; dimmed?: boolean
}) {
  const diffColor = DIFFICULTY_COLORS[choice.difficulty] || 'text-gray-400 border-gray-500'
  const chance = Math.round(choice.success_chance || 0)

  return (
    <button onClick={onClick} disabled={disabled || dimmed}
      className={`w-full text-left p-4 rounded-lg border-2 transition
        ${selected ? 'border-purple-400 bg-purple-900/30 ring-1 ring-purple-400/50' : ''}
        ${dimmed ? 'opacity-30 cursor-default' : ''}
        ${!selected && !dimmed ? `bg-gray-800/50 hover:bg-gray-700/50 ${diffColor.split(' ')[1]}` : ''}
        ${disabled && !dimmed && !selected ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium text-white">{choice.text}</div>
          <div className="text-gray-400 text-sm mt-1">{choice.description}</div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-medium ${diffColor.split(' ')[0]}`}>{choice.difficulty?.toUpperCase()}</div>
          <div className="text-gray-500 text-xs">DC {choice.dc}</div>
        </div>
      </div>
      {choice.your_modifier !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-sm">
          <span className="text-gray-400">Modifier: <span className="text-purple-400">+{choice.your_modifier}</span></span>
          {choice.auto_succeed ? <span className="text-green-400 font-medium">Auto-success</span>
            : choice.auto_fail ? <span className="text-red-400 font-medium">Very unlikely</span>
            : <span className="text-gray-400">{chance}% chance</span>}
        </div>
      )}
    </button>
  )
}

// ─── Main Component ───

export default function GamePlay() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const [campaign, setCampaign] = useState<CampaignWithSession | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rolling, setRolling] = useState(false)
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [pendingRollResult, setPendingRollResult] = useState<RollResult | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [campRes, sessRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/sessions`),
      ])
      if (!campRes.ok) throw new Error('Campaign not found')
      setCampaign(await campRes.json())
      setSessions(sessRes.ok ? await sessRes.json() : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { loadData() }, [loadData])

  // Build pages and go to last page on initial load
  const pages = campaign ? buildPages(sessions) : []
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (pages.length > 0 && !initialized) {
      setPageIndex(pages.length - 1)
      setInitialized(true)
    }
  }, [pages.length, initialized])

  const currentPage = pages[pageIndex]

  const goToPage = (idx: number) => {
    if (idx >= 0 && idx < pages.length) setPageIndex(idx)
  }

  const startNewSession = async () => {
    setGenerating(true)
    setError(null)
    setSelectedChoiceId(null)
    setPendingRollResult(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(await res.text())

      // Reload sessions and campaign, navigate to new scene
      const [campRes, sessRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/sessions`),
      ])
      if (campRes.ok) setCampaign(await campRes.json())
      const updatedSessions: Session[] = sessRes.ok ? await sessRes.json() : sessions
      setSessions(updatedSessions)
      setPageIndex(buildPages(updatedSessions).length - 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
    } finally {
      setGenerating(false)
    }
  }

  const makeChoice = async (choiceId: number) => {
    setSelectedChoiceId(choiceId)
    setRolling(true)
    setError(null)

    const apiPromise = fetch(`/api/campaigns/${campaignId}/choice`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice_id: choiceId }),
    })

    // Dice animation for 1.5s
    await new Promise(r => setTimeout(r, 1500))

    try {
      const res = await apiPromise
      if (!res.ok) throw new Error(await res.text())
      const result = await res.json()
      setPendingRollResult(result.roll_result)
      setRolling(false)

      // Pause to show roll result
      await new Promise(r => setTimeout(r, 1200))

      // Reload sessions and navigate to result page
      const sessRes = await fetch(`/api/campaigns/${campaignId}/sessions`)
      const updatedSessions: Session[] = sessRes.ok ? await sessRes.json() : sessions
      setSessions(updatedSessions)

      const updatedPages = buildPages(updatedSessions)
      setPageIndex(updatedPages.length - 1)
      setSelectedChoiceId(null)
      setPendingRollResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make choice')
      setRolling(false)
    }
  }

  // Story so far: summaries of all sessions before the current one
  const buildStorySoFar = (sessionIndex: number): string[] => {
    return sessions.slice(0, sessionIndex)
      .map((s, i) => `**Scene ${i + 1}:** ${s.summary || s.outcome_narrative?.substring(0, 150) || 'No summary'}`)
      .filter(Boolean)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading adventure...</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error || 'Campaign not found'}</div>
          <Link to="/campaigns" className="text-purple-400">← Back</Link>
        </div>
      </div>
    )
  }

  // Page label for navigation
  const getPageLabel = (p: Page, idx: number): string => {
    if (p.type === 'intro') return 'Intro'
    if (p.type === 'scene') return `Scene ${p.sessionIndex + 1}`
    return `Scene ${p.sessionIndex + 1} Result`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-purple-950">
      {generating && (
        <GeneratingOverlay message="The DM is preparing..." subtitle="Generating narrative, choices, and scene image" />
      )}

      <header className="border-b border-gray-800 bg-black/40 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{campaign.name}</h1>
            <p className="text-gray-500 text-xs">{campaign.character?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Page navigation */}
            {pages.length > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0}
                  className="text-gray-400 hover:text-purple-300 disabled:opacity-30 transition">←</button>
                <span className="text-gray-500 min-w-[120px] text-center">
                  {currentPage ? getPageLabel(currentPage, pageIndex) : ''}
                </span>
                <button onClick={() => goToPage(pageIndex + 1)} disabled={pageIndex >= pages.length - 1}
                  className="text-gray-400 hover:text-purple-300 disabled:opacity-30 transition">→</button>
              </div>
            )}
            <Link to={`/campaigns/${campaignId}/settings`} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition">Settings</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mb-6">{error}</div>}

        {/* ─── INTRO PAGE ─── */}
        {currentPage?.type === 'intro' && !generating && (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/3">
              {campaign.intro_image_url && (
                <img src={campaign.intro_image_url} alt="Campaign" className="w-full rounded-lg border border-gray-700" />
              )}
            </div>
            <div className="lg:w-2/3 space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-100 mb-2">{campaign.name}</h2>
                <p className="text-gray-500">{campaign.world}</p>
              </div>
              <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-6">
                <p className="text-gray-300 leading-relaxed">{campaign.premise}</p>
              </div>
              {campaign.character && (
                <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-2">Starring</h3>
                  <p className="text-gray-200 font-medium">{campaign.character.name}</p>
                  <p className="text-gray-400 text-sm">Level {campaign.character.level} {campaign.character.race} {campaign.character.class}</p>
                </div>
              )}
              {sessions.length === 0 && (
                <button onClick={startNewSession}
                  className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-lg font-medium transition-all hover:shadow-lg hover:shadow-purple-600/25">
                  Begin Adventure
                </button>
              )}
              {sessions.length > 0 && (
                <button onClick={() => goToPage(1)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
                  Go to Scene 1 →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── SCENE PAGE ─── */}
        {currentPage?.type === 'scene' && !generating && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left — Scene image + dice */}
            <div className="lg:w-1/3 lg:sticky lg:top-20 lg:self-start space-y-4">
              {currentPage.session.content?.image_url ? (
                <img src={currentPage.session.content.image_url} alt="Scene" className="w-full rounded-lg border border-gray-700" />
              ) : (
                <div className="w-full aspect-video bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center">
                  <span className="text-4xl opacity-40">🎲</span>
                </div>
              )}

              {/* Dice roll — shows when rolling */}
              {(rolling || pendingRollResult) && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <DiceRoll rolling={rolling} result={pendingRollResult || undefined} />
                  {pendingRollResult && !rolling && (
                    <div className={`mt-3 p-3 rounded-lg text-center ${OUTCOME_STYLES[pendingRollResult.outcome]?.bg}`}>
                      <div className={`font-bold ${OUTCOME_STYLES[pendingRollResult.outcome]?.text}`}>
                        {OUTCOME_STYLES[pendingRollResult.outcome]?.label}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right — Narrative + Choices */}
            <div className="lg:w-2/3 space-y-6">
              {/* Story so far */}
              {currentPage.sessionIndex > 0 && (
                <details className="bg-gray-800/20 border border-gray-700/30 rounded-lg">
                  <summary className="px-4 py-3 text-gray-400 text-sm cursor-pointer hover:text-gray-300">
                    Story so far ({currentPage.sessionIndex} previous scene{currentPage.sessionIndex > 1 ? 's' : ''})
                  </summary>
                  <div className="px-4 pb-4 space-y-2 text-sm prose prose-invert prose-sm max-w-none">
                    {buildStorySoFar(currentPage.sessionIndex).map((recap, i) => (
                      <div key={i} className="text-gray-400"><ReactMarkdown>{recap}</ReactMarkdown></div>
                    ))}
                  </div>
                </details>
              )}

              {/* Narrative */}
              {currentPage.session.content?.narrative && (
                <div className="bg-gray-800/30 border border-gray-700/40 rounded-xl p-6">
                  {currentPage.session.content.location && (
                    <div className="text-purple-400 text-sm mb-3">{currentPage.session.content.location}</div>
                  )}
                  <div className="prose prose-invert prose-purple max-w-none">
                    <ReactMarkdown>{currentPage.session.content.narrative}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Choices — always visible, selected/dimmed after choice */}
              {currentPage.session.content?.choices && currentPage.session.content.choices.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-300">
                    {(selectedChoiceId || currentPage.session.chosen_option) ? 'Your choice' : 'What do you do?'}
                  </h3>
                  {currentPage.session.content.choices.map((choice: Choice) => {
                    const chosen = selectedChoiceId || currentPage.session.chosen_option
                    const isSelected = chosen === choice.id
                    const isDimmed = chosen != null && !isSelected
                    return (
                      <ChoiceCard key={choice.id} choice={choice}
                        onClick={() => makeChoice(choice.id)}
                        disabled={!!chosen || rolling}
                        selected={isSelected} dimmed={isDimmed} />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── RESULT PAGE ─── */}
        {currentPage?.type === 'result' && !generating && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left — Outcome image + roll */}
            <div className="lg:w-1/3 lg:sticky lg:top-20 lg:self-start space-y-4">
              {currentPage.session.outcome_image_url ? (
                <img src={currentPage.session.outcome_image_url} alt="Outcome" className="w-full rounded-lg border border-purple-700/50" />
              ) : currentPage.session.content?.image_url ? (
                <img src={currentPage.session.content.image_url} alt="Scene" className="w-full rounded-lg border border-gray-700 opacity-60" />
              ) : null}

              {/* Roll result */}
              {currentPage.session.roll_result && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <DiceRoll rolling={false} result={currentPage.session.roll_result} />
                  <div className={`mt-3 p-3 rounded-lg text-center ${OUTCOME_STYLES[currentPage.session.roll_result.outcome]?.bg}`}>
                    <div className={`font-bold ${OUTCOME_STYLES[currentPage.session.roll_result.outcome]?.text}`}>
                      {OUTCOME_STYLES[currentPage.session.roll_result.outcome]?.label}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right — Outcome narrative + next */}
            <div className="lg:w-2/3 space-y-6">
              <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">What Happened</h3>
                <div className="prose prose-invert prose-purple max-w-none">
                  <ReactMarkdown>{currentPage.session.outcome_narrative || ''}</ReactMarkdown>
                </div>
              </div>

              {currentPage.session.summary && (
                <div className="text-gray-500 text-sm italic">{currentPage.session.summary}</div>
              )}

              {/* Next Scene button — only on the last result page */}
              {pageIndex === pages.length - 1 && (
                <button onClick={startNewSession}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-lg font-medium transition-all hover:shadow-lg hover:shadow-purple-600/25">
                  Continue to Next Scene →
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
