import { useState, useEffect, useCallback, useRef } from 'react'
import type { TouchEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import type { CampaignWithSession, Choice, RollResult, Session } from '../types'

const DIFFICULTY_COLORS: Record<string, string> = {
  trivial: 'text-green-400 border-green-500',
  easy: 'text-blue-400 border-blue-500',
  medium: 'text-yellow-400 border-yellow-500',
  hard: 'text-orange-400 border-orange-500',
  extreme: 'text-red-400 border-red-500'
}

const OUTCOME_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  critical_success: { bg: 'bg-green-900/50', text: 'text-green-300', label: '🎯 CRITICAL SUCCESS!' },
  success: { bg: 'bg-green-800/30', text: 'text-green-400', label: '✓ Success' },
  partial_success: { bg: 'bg-yellow-800/30', text: 'text-yellow-400', label: '~ Partial Success' },
  failure: { bg: 'bg-red-800/30', text: 'text-red-400', label: '✗ Failure' },
  critical_failure: { bg: 'bg-red-900/50', text: 'text-red-300', label: '💀 CRITICAL FAILURE!' }
}

const DM_LOADING_MESSAGES = [
  "Consulting ancient tomes...", "Rolling behind the screen...", "Summoning narrative threads...",
  "Weaving your destiny...", "Contemplating consequences...", "Scribbling in margins...",
  "Shuffling encounter cards...", "Muttering incantations...", "Checking character sheets...",
  "Preparing dramatic reveals...", "Calculating challenge ratings...", "Invoking the muse...",
  "Brewing plot twists...", "Sketching dungeon layouts...", "Manifesting NPCs...",
  "Polishing treasure hoards...", "Tuning the atmosphere...", "Aligning the stars...",
  "Sharpening plot hooks...", "Consulting the oracle..."
]

function LoadingIndicator() {
  const [messageIndex, setMessageIndex] = useState(0)
  const [dots, setDots] = useState('')

  useEffect(() => {
    const messageInterval = setInterval(() => setMessageIndex(i => (i + 1) % DM_LOADING_MESSAGES.length), 3000)
    const dotInterval = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => { clearInterval(messageInterval); clearInterval(dotInterval) }
  }, [])

  return (
    <div className="bg-purple-900/50 border border-purple-500 rounded-lg p-8 text-center mb-6">
      <div className="text-4xl mb-4">🎲</div>
      <div className="text-purple-300 text-lg h-7">{DM_LOADING_MESSAGES[messageIndex]}{dots}</div>
      <div className="text-gray-500 text-sm mt-3">This may take up to a minute</div>
    </div>
  )
}

function DiceRoll({ rolling, result }: { rolling: boolean; result?: RollResult }) {
  const [displayNum, setDisplayNum] = useState(20)
  useEffect(() => {
    if (!rolling) return
    const interval = setInterval(() => setDisplayNum(Math.floor(Math.random() * 20) + 1), 50)
    return () => clearInterval(interval)
  }, [rolling])

  const finalNum = result?.natural || displayNum
  const isNat20 = result?.natural === 20
  const isNat1 = result?.natural === 1

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`w-24 h-24 flex items-center justify-center bg-gray-800 border-4 rounded-lg text-4xl font-bold transition-all duration-200
        ${rolling ? 'border-purple-500 animate-pulse' : ''}
        ${isNat20 ? 'border-green-400 text-green-400 shadow-lg shadow-green-500/50' : ''}
        ${isNat1 ? 'border-red-400 text-red-400 shadow-lg shadow-red-500/50' : ''}
        ${!isNat20 && !isNat1 && !rolling ? 'border-gray-600 text-white' : ''}`}>
        {rolling ? displayNum : finalNum}
      </div>
      {result && (
        <div className="text-center">
          <div className="text-gray-400 text-sm">{result.natural} + {result.modifier} = {result.total} vs DC {result.dc}</div>
          {result.skill && <div className="text-purple-400 text-xs mt-1">{result.skill} check</div>}
        </div>
      )}
    </div>
  )
}

function ChoiceCard({ choice, onClick, disabled }: { choice: Choice; onClick: () => void; disabled: boolean }) {
  const diffColor = DIFFICULTY_COLORS[choice.difficulty] || 'text-gray-400 border-gray-500'
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full text-left p-4 rounded-lg border-2 transition bg-gray-800/50 hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed ${diffColor.split(' ')[1]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-medium text-white">{choice.text}</div>
          <div className="text-gray-400 text-sm mt-1">{choice.description}</div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-medium ${diffColor.split(' ')[0]}`}>{choice.difficulty.toUpperCase()}</div>
          <div className="text-gray-500 text-xs">DC {choice.dc}</div>
        </div>
      </div>
      {choice.your_modifier !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-sm">
          <span className="text-gray-400">Your modifier: <span className="text-purple-400">+{choice.your_modifier}</span></span>
          {choice.auto_succeed ? <span className="text-green-400 font-medium">Auto-success</span>
            : choice.auto_fail ? <span className="text-red-400 font-medium">Very unlikely</span>
            : <span className="text-gray-400">{Math.round((choice.success_chance || 0) * 100)}% chance</span>}
        </div>
      )}
    </button>
  )
}

// Build story recap as natural prose - 2-3 paragraphs that actually catch you up
// Written like "Previously on..." narration, not mechanical summaries
function buildStorySoFar(campaign: CampaignWithSession, sessions: Session[], upToIndex: number): string {
  const parts: string[] = []
  const char = campaign.character
  
  // First paragraph: Who you are and what's happening (character + premise woven together)
  if (char && campaign.premise) {
    parts.push(`You are **${char.name}**, a ${char.class?.toLowerCase() || 'adventurer'}. ${campaign.premise}`)
  } else if (campaign.premise) {
    parts.push(campaign.premise)
  }
  
  // Second paragraph: What's happened so far (use AI-generated recap summaries)
  if (upToIndex > 0) {
    const recaps: string[] = []
    
    for (let i = 0; i < upToIndex; i++) {
      const session = sessions[i]
      
      // Prefer the AI-generated summary (proper prose recap)
      if (session.summary && session.summary.length > 30 && !session.summary.includes('Result:')) {
        recaps.push(session.summary)
      } else if (session.outcome_narrative) {
        // Fallback: extract first 2 sentences from outcome narrative
        const sentences = session.outcome_narrative.split(/(?<=[.!?])\s+/)
        const excerpt = sentences.slice(0, 2).join(' ')
        if (excerpt.length > 50) {
          recaps.push(excerpt)
        }
      }
    }
    
    if (recaps.length > 0) {
      parts.push(`\n\n**What's happened:** ${recaps.join(' ')}`)
    }
  }
  
  return parts.join('')
}

// Page types for the carousel
type PageType = 
  | { type: 'intro' }
  | { type: 'narrative'; session: Session; sessionIndex: number }
  | { type: 'outcome'; session: Session; sessionIndex: number }

function buildPages(_campaign: CampaignWithSession, sessions: Session[]): PageType[] {
  const pages: PageType[] = [{ type: 'intro' }]
  
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]
    // Always add narrative page
    pages.push({ type: 'narrative', session, sessionIndex: i })
    // Add outcome page if session is complete
    if (session.state === 'complete' && session.outcome_narrative) {
      pages.push({ type: 'outcome', session, sessionIndex: i })
    }
  }
  
  // No "continue" page - next session auto-generates
  return pages
}

export default function GamePlay() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const [campaign, setCampaign] = useState<CampaignWithSession | null>(null)
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rolling, setRolling] = useState(false)
  const [generatingSession, setGeneratingSession] = useState(false)
  
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)

  const loadCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setCampaign(data)
      
      const sessionsRes = await fetch(`/api/campaigns/${campaignId}/sessions`)
      if (sessionsRes.ok) {
        const sessions = await sessionsRes.json()
        setAllSessions(sessions)
      } else {
        setAllSessions([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { loadCampaign() }, [loadCampaign])

  // Build pages and set initial position
  const pages = campaign ? buildPages(campaign, allSessions) : []
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  
  useEffect(() => {
    // Go to the last actionable page ONLY on initial load
    if (pages.length > 0 && !initialLoadDone) {
      setPageIndex(pages.length - 1)
      setInitialLoadDone(true)
    }
  }, [pages.length, initialLoadDone])

  const handleTouchStart = (e: TouchEvent) => {
    // Don't capture touch if user is interacting with interactive elements
    const target = e.target as HTMLElement
    if (target.closest('details, summary, button, a, input')) {
      touchStartX.current = 0
      return
    }
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchMove = (e: TouchEvent) => { 
    if (touchStartX.current === 0) return
    touchEndX.current = e.touches[0].clientX 
  }
  const handleTouchEnd = () => {
    if (touchStartX.current === 0) return
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) > 50) {
      if (diff > 0 && pageIndex < pages.length - 1) setPageIndex(i => i + 1)
      else if (diff < 0 && pageIndex > 0) setPageIndex(i => i - 1)
    }
    touchStartX.current = 0
  }

  // Keyboard navigation (arrow keys for desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.key === 'ArrowRight' && pageIndex < pages.length - 1) {
        setPageIndex(i => i + 1)
      } else if (e.key === 'ArrowLeft' && pageIndex > 0) {
        setPageIndex(i => i - 1)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pageIndex, pages.length])

  const startNewSession = async () => {
    setGeneratingSession(true)
    setError(null)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) throw new Error(await res.text())
      
      // Reload and navigate to new session
      const campRes = await fetch(`/api/campaigns/${campaignId}`)
      if (campRes.ok) {
        const data = await campRes.json()
        setCampaign(data)
      }
      
      const sessionsRes = await fetch(`/api/campaigns/${campaignId}/sessions`)
      if (sessionsRes.ok) {
        const sessions = await sessionsRes.json()
        setAllSessions(sessions)
        // Navigate to the new session's narrative page (last page before any continue)
        const newPages = buildPages(campaign!, sessions)
        setPageIndex(newPages.length - 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
    } finally {
      setGeneratingSession(false)
    }
  }

  const makeChoice = async (choiceId: number) => {
    setRolling(true)
    setError(null)
    const currentIdx = pageIndex
    await new Promise(r => setTimeout(r, 1500))
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/choice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice_id: choiceId })
      })
      if (!res.ok) throw new Error(await res.text())
      
      // Reload campaign data
      const campRes = await fetch(`/api/campaigns/${campaignId}`)
      if (campRes.ok) {
        const data = await campRes.json()
        setCampaign(data)
      }
      
      const sessionsRes = await fetch(`/api/campaigns/${campaignId}/sessions`)
      if (sessionsRes.ok) {
        const sessions = await sessionsRes.json()
        setAllSessions(sessions)
        setPageIndex(currentIdx + 1) // Move to outcome page
      }
      
      setRolling(false)
      
      // Auto-start next session after showing outcome briefly
      setTimeout(() => {
        startNewSession()
      }, 2000) // Give user 2 seconds to see the outcome before loading starts
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make choice')
      setRolling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading adventure...</div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Campaign not found</div>
          <Link to="/campaigns" className="text-purple-400 hover:underline">Back to Campaigns</Link>
        </div>
      </div>
    )
  }

  const currentPage = pages[pageIndex]
  const storySoFar = currentPage?.type === 'narrative' && campaign
    ? buildStorySoFar(campaign, allSessions, currentPage.sessionIndex) 
    : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <header className="border-b border-purple-800/50 bg-black/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{campaign.name}</h1>
            <p className="text-gray-400 text-sm">{campaign.character?.name}</p>
          </div>
          <div className="flex gap-2">
            <Link to={`/campaigns/${campaignId}/settings`} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm transition">⚙️</Link>
            <Link to="/campaigns" className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition">Exit</Link>
          </div>
        </div>
      </header>

      {/* Page dots */}
      {pages.length > 1 && (
        <div className="flex justify-center items-center gap-1.5 py-3 bg-black/20">
          {pages.map((p, idx) => (
            <button key={idx} onClick={() => setPageIndex(idx)}
              className={`h-2 rounded-full transition-all ${idx === pageIndex ? 'bg-purple-400 w-4' : 'bg-gray-600 hover:bg-gray-500 w-2'}`}
              title={p.type === 'intro' ? 'Intro' : `Session ${p.sessionIndex + 1}${p.type === 'outcome' ? ' Result' : ''}`} />
          ))}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {error && <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200 mb-6">{error}</div>}
        
        {pages.length > 1 && <div className="text-center text-gray-500 text-xs mb-4">← Swipe →</div>}
        
        {/* Only show loading on the last page */}
        {generatingSession && pageIndex === pages.length - 1 && <LoadingIndicator />}

        {/* INTRO PAGE */}
        {currentPage?.type === 'intro' && !generatingSession && (
          <div className="space-y-6">
            {campaign.intro_image_url && (
              <img src={campaign.intro_image_url} alt="Campaign intro" className="w-full rounded-lg" />
            )}
            <div className="bg-gray-800/50 border border-purple-700 rounded-lg p-8 text-center">
              <div className="text-5xl mb-4">📜</div>
              <h2 className="text-2xl font-bold text-white mb-4">{campaign.name}</h2>
              <div className="text-purple-400 text-sm mb-4">{campaign.world}</div>
              <p className="text-gray-300 leading-relaxed">{campaign.premise}</p>
              {campaign.character && (
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="text-gray-500 text-sm">Starring</div>
                  <div className="text-white font-medium">{campaign.character.name} — {campaign.character.race} {campaign.character.class}</div>
                </div>
              )}
            </div>
            {allSessions.length === 0 && (
              <div className="text-center">
                <button onClick={startNewSession} className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-lg font-medium transition">
                  Begin Adventure
                </button>
              </div>
            )}
          </div>
        )}

        {/* NARRATIVE PAGE (choices) */}
        {currentPage?.type === 'narrative' && !generatingSession && (
          <div className="space-y-6">
            {/* Scene image */}
            {currentPage.session.content?.image_url && (
              <img src={currentPage.session.content.image_url} alt="Scene" className="w-full rounded-lg" />
            )}
            
            {/* Story so far (collapsed) */}
            {storySoFar && (
              <details className="bg-gray-800/30 border border-gray-700 rounded-lg">
                <summary className="px-4 py-3 text-gray-400 text-sm cursor-pointer hover:text-gray-300">
                  📖 Story so far...
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{storySoFar}</ReactMarkdown>
                </div>
              </details>
            )}
            
            {/* Current narrative */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              {currentPage.session.content?.location && (
                <div className="text-purple-400 text-sm mb-2">📍 {currentPage.session.content.location}</div>
              )}
              <div className="prose prose-invert prose-purple max-w-none">
                <ReactMarkdown>{currentPage.session.content?.narrative || ''}</ReactMarkdown>
              </div>
            </div>

            {/* Rolling indicator */}
            {rolling && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex items-center justify-center">
                <DiceRoll rolling={true} />
              </div>
            )}

            {/* Choices */}
            {!rolling && currentPage.session.state !== 'complete' && currentPage.session.content?.choices && (
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-300">What do you do?</h3>
                {currentPage.session.content.choices.map((choice: Choice) => (
                  <ChoiceCard key={choice.id} choice={choice} onClick={() => makeChoice(choice.id)} disabled={rolling} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* OUTCOME PAGE */}
        {currentPage?.type === 'outcome' && !generatingSession && (
          <div className="space-y-6">
            {/* Outcome image */}
            {currentPage.session.outcome_image_url && (
              <img src={currentPage.session.outcome_image_url} alt="Outcome" className="w-full rounded-lg" />
            )}
            
            {/* Roll result with full context */}
            {currentPage.session.roll_result && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                {/* What skill was tested */}
                {currentPage.session.roll_result.skill && (
                  <div className="text-center text-purple-400 text-sm mb-3">
                    {currentPage.session.roll_result.skill} Check ({currentPage.session.roll_result.ability || 'ability'})
                  </div>
                )}
                
                {/* The roll breakdown */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-3xl font-bold text-white">
                    🎲 {currentPage.session.roll_result.natural} + {currentPage.session.roll_result.modifier} = {currentPage.session.roll_result.total}
                  </div>
                </div>
                
                {/* DC requirement */}
                <div className="text-center text-gray-400 text-sm mb-4">
                  Needed: <span className="text-white font-medium">DC {currentPage.session.roll_result.dc}</span>
                  {currentPage.session.roll_result.margin !== undefined && (
                    <span className={currentPage.session.roll_result.margin >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {' '}({currentPage.session.roll_result.margin >= 0 ? '+' : ''}{currentPage.session.roll_result.margin})
                    </span>
                  )}
                </div>
                
                {/* Outcome banner */}
                <div className={`p-4 rounded-lg text-center ${OUTCOME_STYLES[currentPage.session.roll_result.outcome]?.bg}`}>
                  <div className={`text-xl font-bold ${OUTCOME_STYLES[currentPage.session.roll_result.outcome]?.text}`}>
                    {OUTCOME_STYLES[currentPage.session.roll_result.outcome]?.label}
                  </div>
                </div>
              </div>
            )}
            
            {/* Outcome narrative */}
            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-6">
              <div className="prose prose-invert prose-purple max-w-none">
                <ReactMarkdown>{currentPage.session.outcome_narrative || ''}</ReactMarkdown>
              </div>
            </div>
            
            {/* Summary */}
            {currentPage.session.summary && (
              <div className="text-gray-500 text-sm italic text-center">{currentPage.session.summary}</div>
            )}
            
            {/* Continue button - show if this is the last session and it's complete */}
            {currentPage.sessionIndex === allSessions.length - 1 && currentPage.session.state === 'complete' && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={startNewSession}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
                >
                  Continue to Next Scene →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading indicator shows when generating next session */}
      </main>
    </div>
  )
}
