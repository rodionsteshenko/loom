import { run, extractAllTextOutput } from '@openai/agents'
import path from 'path'
import { sessionGeneratorAgent, buildSessionPrompt } from '../agents/dungeon-master.js'
import { imagePromptAgent } from '../agents/image-prompt.js'
import { analyzeDifficulty } from '../agents/tools/difficulty.js'
import { createSession, saveSession, getPreviousSessionContext } from '../agents/tools/state.js'
import { generateImage } from '../agents/tools/image.js'
import { log, extractJSON, validateSessionContent } from '../utils.js'
import type { GameContext, PipelineResult, Choice } from '../types.js'

const SCENE_ART_STYLES: Record<string, string> = {
  'oil-painting': 'Oil painting style, rich textured brushstrokes, dramatic lighting, classic fantasy art',
  'classic-fantasy': 'Classic fantasy art style, Larry Elmore, TSR, 1980s D&D, detailed oil painting',
  'dark-fantasy': 'Dark fantasy art, gritty moody atmosphere, deep shadows, ominous lighting, FromSoftware aesthetic',
  'watercolor': 'Watercolor illustration, soft flowing colors, ethereal dreamy quality',
  'storybook': 'Storybook illustration, whimsical charming style, children\'s book aesthetic',
  'art-nouveau': 'Art nouveau style, ornate flowing lines, natural motifs, decorative borders',
  'digital-art': 'Digital art, clean polished illustration, modern fantasy style',
  'concept-art': 'Concept art, film production quality, detailed environment design',
  'realistic': 'Photorealistic fantasy, highly detailed, lifelike rendering',
  'comic-book': 'Comic book art style, bold ink lines, dynamic composition, vivid colors',
  'anime': 'Anime illustration style, expressive characters, Japanese animation aesthetic, vibrant',
  'pixel-art': 'Pixel art style, retro game aesthetic, chunky pixels, 16-bit era',
  'noir': 'Film noir style, high contrast black and white, dramatic shadows, mystery',
  'gothic': 'Gothic art style, dark romantic atmosphere, Victorian aesthetic, ornate details',
  'eldritch': 'Eldritch horror art, Lovecraftian aesthetic, unsettling, cosmic dread',
}

// ─── Helpers ───

function enrichChoices(choices: any[], character: any): Choice[] {
  return choices.map((choice: any) => {
    const analysis = analyzeDifficulty(character, choice.dc, choice.skill, choice.ability)
    return {
      ...choice,
      your_modifier: analysis.modifier,
      success_chance: analysis.success_chance,
      auto_succeed: analysis.auto_succeed,
      auto_fail: analysis.auto_fail,
      assessment: analysis.description,
    }
  })
}

async function generateImagePrompt(narrative: string): Promise<string> {
  try {
    const result = await run(imagePromptAgent, narrative.substring(0, 1000), { maxTurns: 3 })
    return extractAllTextOutput(result.newItems).trim() || narrative.substring(0, 200)
  } catch {
    return narrative.substring(0, 200)
  }
}

export async function generateSceneImage(
  campaignDir: string,
  sessionId: string,
  narrative: string,
  artStyle?: string
): Promise<string | null> {
  try {
    const prompt = await generateImagePrompt(narrative)
    const campaignId = path.basename(campaignDir)
    const filename = `${sessionId}_scene.png`
    const outputPath = path.join(campaignDir, filename)
    const stylePrefix = SCENE_ART_STYLES[artStyle || 'oil-painting'] || SCENE_ART_STYLES['oil-painting']

    await generateImage({ prompt: `${stylePrefix}, cinematic composition: ${prompt}`, outputPath, resolution: '1K' })
    return `/scene-images/${campaignId}/${filename}`
  } catch (e) {
    log(`Scene image generation failed: ${e}`, 'ERROR')
    return null
  }
}

// ─── Session Pipeline ───

export interface SessionResponse {
  session: any
  narrative: string
  choices: Choice[]
}

export async function generateSessionPipeline(ctx: GameContext): Promise<PipelineResult<SessionResponse>> {
  try {
    // Step 1: Load previous session context
    log('[session] Step 1/7: Loading previous session context')
    const previous = getPreviousSessionContext(ctx.campaignDir, ctx.campaign)
    if (previous) {
      log(`[session]   Previous session found: "${previous.summary?.slice(0, 80)}..."`)
    } else {
      log('[session]   No previous session (first session)')
    }

    // Step 2: Generate narrative + choices via agent
    log('[session] Step 2/7: Generating narrative and choices via AI')
    const prompt = buildSessionPrompt({
      campaign: { name: ctx.campaign.name, world: ctx.campaign.world, premise: ctx.campaign.premise },
      character: ctx.character,
      previousSession: previous,
    })
    const agentResult = await run(sessionGeneratorAgent, prompt, { maxTurns: 5 })
    const agentText = extractAllTextOutput(agentResult.newItems)
    log(`[session]   Agent returned ${agentText.length} chars`)

    const raw = extractJSON<any>(agentText, 'object')
    log(`[session]   Parsed JSON with ${raw.choices?.length || 0} choices`)

    // Step 3: Validate session content structure
    log('[session] Step 3/7: Validating session content')
    validateSessionContent(raw)
    log(`[session]   Narrative: ${raw.narrative.length} chars, Choices: ${raw.choices.length}, Setting: "${raw.setting?.slice(0, 50)}"`)

    // Step 4: Create session record and save
    log('[session] Step 4/7: Creating session record')
    const session = createSession(ctx.campaignDir, ctx.campaign)
    session.content = raw
    session.state = 'choices'
    saveSession(ctx.campaignDir, session)
    log(`[session]   Session ${session.id} saved (sequence ${session.sequence})`)

    // Step 5: Enrich choices with difficulty analysis
    log('[session] Step 5/7: Enriching choices with difficulty analysis')
    const choices = enrichChoices(raw.choices, ctx.character)
    for (const c of choices) {
      log(`[session]   Choice ${c.id}: "${c.text}" DC ${c.dc} (${c.success_chance}% chance, mod +${c.your_modifier})`)
    }

    // Step 6: Generate scene image (blocking)
    log('[session] Step 6/7: Generating scene image')
    const imageUrl = await generateSceneImage(ctx.campaignDir, session.id, raw.narrative, (ctx.campaign as any).art_style)
    if (imageUrl) {
      session.content.image_url = imageUrl
      saveSession(ctx.campaignDir, session)
      log(`[session]   Image saved: ${imageUrl}`)
    } else {
      log('[session]   Image generation skipped or failed')
    }

    // Step 7: Assemble response
    log('[session] Step 7/7: Complete')
    return {
      ok: true,
      data: { session, narrative: raw.narrative, choices },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log(`[session] FAILED: ${msg}`, 'ERROR')
    return { ok: false, error: msg, step: 'session-generation' }
  }
}
