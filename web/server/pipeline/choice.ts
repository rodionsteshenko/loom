import { run, extractAllTextOutput } from '@openai/agents'
import path from 'path'
import { outcomeNarrationAgent, recapAgent, buildOutcomePrompt, buildRecapPrompt } from '../agents/dungeon-master.js'
import { imagePromptAgent } from '../agents/image-prompt.js'
import { rollCheck, type CheckResult } from '../agents/tools/dice.js'
import { getRelevantModifier, checkAutoSucceed, checkAutoFail } from '../agents/tools/difficulty.js'
import { loadSession, saveSession, loadCampaign, accumulateCampaignState } from '../agents/tools/state.js'
import { eventExtractorAgent, buildEventExtractionPrompt } from '../agents/event-extractor.js'
import { generateImage } from '../agents/tools/image.js'
import { getArtStylePrompt } from '../agents/tools/art-styles.js'
import { log, extractJSON } from '../utils.js'
import type { GameContext, PipelineResult, RollResult, Choice } from '../types.js'

// ─── Helpers ───

function toFrontendRollResult(result: CheckResult): RollResult {
  return {
    natural: result.naturalRoll,
    modifier: result.modifier,
    total: result.total,
    dc: result.dc,
    outcome: result.outcome as RollResult['outcome'],
    margin: result.margin,
    skill: result.skill ?? undefined,
    ability: result.ability ?? undefined,
    auto_succeed: result.autoResolved && result.outcome !== 'failure' && result.outcome !== 'critical_failure',
    auto_fail: result.autoResolved && (result.outcome === 'failure' || result.outcome === 'critical_failure'),
  }
}

// Art styles centralized in agents/tools/art-styles.ts

async function generateImagePrompt(narrative: string, characterDesc?: string): Promise<string> {
  try {
    let input = narrative.substring(0, 1000)
    if (characterDesc) {
      input += `\n\nThe main character looks like: ${characterDesc.substring(0, 300)}`
    }
    const result = await run(imagePromptAgent, input, { maxTurns: 3 })
    return extractAllTextOutput(result.newItems).trim() || narrative.substring(0, 200)
  } catch {
    return narrative.substring(0, 200)
  }
}

async function generateOutcomeImage(
  campaignDir: string,
  sessionId: string,
  outcomeNarrative: string,
  artStyle?: string,
  characterDesc?: string
): Promise<string | null> {
  try {
    const prompt = await generateImagePrompt(outcomeNarrative, characterDesc)
    const campaignId = path.basename(campaignDir)
    const filename = `${sessionId}_outcome.png`
    const outputPath = path.join(campaignDir, filename)
    const stylePrefix = getArtStylePrompt(artStyle || 'oil-painting')

    await generateImage({ prompt: `${stylePrefix}, cinematic composition: ${prompt}`, outputPath, resolution: '1K' })
    return `/scene-images/${campaignId}/${filename}`
  } catch (e) {
    log(`Outcome image generation failed: ${e}`, 'ERROR')
    return null
  }
}

// ─── Choice Pipeline ───

export interface ChoiceResponse {
  choice: any
  roll_result: RollResult
  outcome_narrative: string
  outcome_image_url: string | null
  session_id: string
}

export async function resolveChoicePipeline(ctx: GameContext, choiceId: number): Promise<PipelineResult<ChoiceResponse>> {
  try {
    // Step 1: Load current session
    log('[choice] Step 1/8: Loading current session')
    const currentSessionId = ctx.campaign.current_session
    if (!currentSessionId) {
      return { ok: false, error: 'No active session', step: 'load-session' }
    }
    const session = loadSession(ctx.campaignDir, currentSessionId)
    if (!session || !session.content) {
      return { ok: false, error: 'Session not found or has no content', step: 'load-session' }
    }
    log(`[choice]   Session ${currentSessionId} loaded (state: ${session.state})`)

    // Step 2: Find and validate chosen option
    log('[choice] Step 2/8: Validating choice')
    const choice = (session.content.choices || []).find((c: any) => c.id === choiceId)
    if (!choice) {
      return { ok: false, error: `Invalid choice ID: ${choiceId}. Valid IDs: ${(session.content.choices || []).map((c: any) => c.id).join(', ')}`, step: 'validate-choice' }
    }
    log(`[choice]   Choice ${choiceId}: "${choice.text}" (DC ${choice.dc}, skill: ${choice.skill || 'none'})`)

    // Step 3: Roll dice (pure TypeScript)
    log('[choice] Step 3/8: Rolling dice')
    const modifier = getRelevantModifier(ctx.character, choice.skill, choice.ability)
    const autoSucceed = checkAutoSucceed(modifier, choice.dc)
    const autoFail = checkAutoFail(modifier, choice.dc)
    const checkResult = rollCheck({
      modifier,
      dc: choice.dc,
      skill: choice.skill,
      ability: choice.ability,
      autoSucceed,
      autoFail,
    })
    const rollResult = toFrontendRollResult(checkResult)
    log(`[choice]   Roll: ${checkResult.naturalRoll} + ${modifier} = ${checkResult.total} vs DC ${choice.dc} → ${checkResult.outcome}${checkResult.autoResolved ? ' (auto)' : ''}`)

    // Step 4: Generate outcome narrative via agent
    log('[choice] Step 4/8: Generating outcome narrative')
    const outcomePrompt = buildOutcomePrompt({
      narrative: session.content.narrative,
      choice: { text: choice.text, description: choice.description },
      rollResult: {
        natural_roll: checkResult.naturalRoll,
        modifier: checkResult.modifier,
        total: checkResult.total,
        dc: checkResult.dc,
        outcome: checkResult.outcome,
        auto_resolved: checkResult.autoResolved,
      },
      characterName: ctx.character.name,
    })
    const outcomeAgentResult = await run(outcomeNarrationAgent, outcomePrompt, { maxTurns: 3 })
    const outcomeNarrative = extractAllTextOutput(outcomeAgentResult.newItems).trim()
    log(`[choice]   Outcome narrative: ${outcomeNarrative.length} chars`)

    // Step 5: Generate recap summary via agent
    log('[choice] Step 5/8: Generating recap summary')
    let summary = `${ctx.character.name} attempted to ${choice.text.toLowerCase()}.`
    try {
      const recapPrompt = buildRecapPrompt({
        characterName: ctx.character.name,
        narrative: session.content.narrative,
        choiceText: choice.text,
        outcomeNarrative,
      })
      const recapResult = await run(recapAgent, recapPrompt, { maxTurns: 3 })
      summary = extractAllTextOutput(recapResult.newItems).trim() || summary
    } catch (e) {
      log(`[choice]   Recap generation failed, using fallback: ${e}`, 'ERROR')
    }
    log(`[choice]   Recap: "${summary.slice(0, 80)}..."`)

    // Step 5.5: Extract events from outcome
    log('[choice] Step 5.5/9: Extracting events from outcome')
    let extractedEvents: any[] = []
    try {
      const eventPrompt = buildEventExtractionPrompt({
        outcomeNarrative,
        choiceText: choice.text,
        rollOutcome: checkResult.outcome,
        characterName: ctx.character.name,
        sceneNarrative: session.content.narrative || '',
      })
      const eventResult = await run(eventExtractorAgent, eventPrompt, { maxTurns: 3 })
      const eventText = extractAllTextOutput(eventResult.newItems)
      // Try to parse events — if it fails, just continue without events
      try {
        const parsed = JSON.parse(eventText.trim().replace(/```json?\n?/g, '').replace(/```/g, ''))
        if (Array.isArray(parsed)) {
          extractedEvents = parsed
          log(`[choice]   Extracted ${extractedEvents.length} events: ${extractedEvents.map((e: any) => e.type).join(', ')}`)
        }
      } catch {
        // Try extractJSON as fallback
        try {
          const { extractJSON } = await import('../utils.js')
          extractedEvents = extractJSON(eventText, 'array')
          log(`[choice]   Extracted ${extractedEvents.length} events (fallback)`)
        } catch {
          log('[choice]   No events extracted (parse failed)', 'ERROR')
        }
      }
    } catch (e) {
      log(`[choice]   Event extraction failed: ${e}`, 'ERROR')
    }

    // Accumulate events into campaign state
    if (extractedEvents.length > 0) {
      const sceneNumber = session.sequence || 1
      accumulateCampaignState(ctx.campaignDir, ctx.campaign, extractedEvents, sceneNumber)
      log(`[choice]   Campaign state updated with ${extractedEvents.length} events`)
    }

    // Step 6: Update and save session
    log('[choice] Step 6/9: Saving session')
    session.chosen_option = choiceId
    session.roll_result = rollResult
    session.outcome_narrative = outcomeNarrative
    session.summary = summary
    session.events = extractedEvents
    session.state = 'complete'
    session.completed_at = new Date().toISOString()
    saveSession(ctx.campaignDir, session)
    log('[choice]   Session saved as complete')

    // Step 7: Generate outcome image (blocking)
    log('[choice] Step 7/9: Generating outcome image')
    // Resolve art style: campaign → world → character → default
    let artStyle = (ctx.campaign as any).art_style
    if (!artStyle && (ctx.campaign as any).world_id) {
      try {
        const { resolveWorld } = await import('../agents/tools/world-state.js')
        const { world } = resolveWorld((ctx.campaign as any).world_id)
        artStyle = world.art_style
      } catch {}
    }
    if (!artStyle) artStyle = (ctx.character as any).art_style
    const imageUrl = await generateOutcomeImage(ctx.campaignDir, currentSessionId, outcomeNarrative, artStyle, ctx.character.physical_description)
    if (imageUrl) {
      session.outcome_image_url = imageUrl
      saveSession(ctx.campaignDir, session)
      log(`[choice]   Outcome image saved: ${imageUrl}`)
    } else {
      log('[choice]   Outcome image skipped or failed')
    }

    // Step 8: Assemble response
    log('[choice] Step 8/9: Complete')
    return {
      ok: true,
      data: {
        choice,
        roll_result: rollResult,
        outcome_narrative: outcomeNarrative,
        outcome_image_url: imageUrl,
        session_id: currentSessionId,
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log(`[choice] FAILED: ${msg}`, 'ERROR')
    return { ok: false, error: msg, step: 'choice-resolution' }
  }
}
