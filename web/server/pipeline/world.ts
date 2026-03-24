import { run, extractAllTextOutput } from '@openai/agents'
import path from 'path'
import { worldBuilderAgent } from '../agents/world-builder.js'
import { imagePromptAgent } from '../agents/image-prompt.js'
import { generateImage } from '../agents/tools/image.js'
import { getArtStylePrompt, ART_STYLE_PROMPTS } from '../agents/tools/art-styles.js'
import { createWorld, saveWorld } from '../agents/tools/world-state.js'
import { validateWorldStructure } from '../agents/tools/world-validation.js'
import { log, extractJSON } from '../utils.js'
import type { PipelineResult } from '../types.js'

// Art styles centralized in agents/tools/art-styles.ts

// ─── Normalize agent output ───

import crypto from 'crypto'

function normalizeWorldData(data: any, artStyle: string) {
  // Fill server-managed fields
  if (!data.id) data.id = crypto.randomUUID().slice(0, 8)
  if (!data.status) data.status = 'draft'
  if (!data.art_style) data.art_style = artStyle
  if (!data.created_at) data.created_at = new Date().toISOString()
  if (!data.updated_at) data.updated_at = new Date().toISOString()
  if (!data.tagline) data.tagline = data.name || ''
  if (!data.concept_images) data.concept_images = []

  // Normalize overview
  if (data.overview) {
    if (!data.overview.genre) data.overview.genre = data.overview.setting || data.overview.type || 'fantasy'
    if (!data.overview.era) data.overview.era = data.overview.time_period || data.overview.period || 'unspecified era'
    if (!data.overview.themes && data.overview.theme) data.overview.themes = [data.overview.theme]
    if (!Array.isArray(data.overview.themes)) data.overview.themes = []
  }

  // Normalize history
  if (data.history) {
    if (!data.history.creation_myth) data.history.creation_myth = data.history.origin || data.history.mythology || 'The origins of this world are shrouded in mystery.'
    if (!Array.isArray(data.history.timeline)) {
      // Agent might put timeline events under a different key
      data.history.timeline = data.history.events || data.history.key_events || data.history.major_events || []
    }
    // Normalize each timeline event
    for (const event of data.history.timeline) {
      if (!event.era) event.era = event.age || event.period || 'Unknown Era'
      if (!event.year_label) event.year_label = event.year || event.date || event.when || 'Unknown date'
      if (!event.impact) event.impact = event.consequence || event.significance || event.result || ''
      if (!event.description) event.description = event.details || event.summary || ''
      if (!event.name) event.name = event.title || event.event || 'Unnamed Event'
    }
  }

  // Normalize geography
  if (data.geography) {
    if (!data.geography.overview) data.geography.overview = data.geography.description || data.geography.summary || ''
    if (!Array.isArray(data.geography.regions)) {
      data.geography.regions = data.geography.locations || data.geography.areas || []
    }
    for (const region of data.geography.regions || []) {
      if (!region.id) region.id = `region_${(region.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      if (!region.type) region.type = region.kind || region.category || 'region'
      if (!Array.isArray(region.notable_features)) {
        region.notable_features = region.features || region.landmarks || region.points_of_interest || []
      }
      if (!Array.isArray(region.connections)) region.connections = []
    }
  }

  // Normalize factions — agent might nest them in an object
  if (data.factions && !Array.isArray(data.factions)) {
    // Try to extract array from nested object
    const val = data.factions
    data.factions = val.factions || val.groups || val.organizations || Object.values(val).filter(Array.isArray)[0] || []
  }
  if (Array.isArray(data.factions)) {
    for (const faction of data.factions) {
      if (!faction.id) faction.id = `faction_${(faction.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      if (!faction.type) faction.type = faction.kind || faction.category || 'organization'
      if (!faction.methods) faction.methods = faction.approach || faction.tactics || ''
      if (!faction.leader) faction.leader = faction.leadership || ''
      if (!Array.isArray(faction.allies)) faction.allies = []
      if (!Array.isArray(faction.enemies)) faction.enemies = []
    }
  }

  // Normalize religion
  if (data.religion) {
    if (!data.religion.overview) data.religion.overview = data.religion.description || data.religion.summary || ''
    if (!Array.isArray(data.religion.deities_or_forces)) {
      data.religion.deities_or_forces = data.religion.deities || data.religion.gods || data.religion.forces || data.religion.pantheon || []
    }
  }

  // Normalize key_figures — agent might nest them
  if (data.key_figures && !Array.isArray(data.key_figures)) {
    const val = data.key_figures
    data.key_figures = val.figures || val.characters || val.npcs || Object.values(val).filter(Array.isArray)[0] || []
  }
  if (Array.isArray(data.key_figures)) {
    for (const fig of data.key_figures) {
      if (!fig.title) fig.title = fig.role || ''
      if (!fig.role) fig.role = fig.title || fig.type || 'notable'
      if (fig.alive === undefined) fig.alive = fig.status !== 'deceased' && fig.status !== 'dead'
    }
  }
}

// ─── Helpers ───

async function generateImagePrompt(description: string): Promise<string> {
  try {
    const result = await run(imagePromptAgent, description.substring(0, 1000), { maxTurns: 3 })
    return extractAllTextOutput(result.newItems).trim() || description.substring(0, 200)
  } catch {
    return description.substring(0, 200)
  }
}

// ─── World Generation Pipeline ───

export interface WorldGenerationResponse {
  world: any
}

export async function generateWorldPipeline(prompt: string, artStyle: string): Promise<PipelineResult<WorldGenerationResponse>> {
  try {
    // Step 1: Validate prompt and art style
    log('[world] Step 1/8: Validating prompt and art style')
    if (!prompt || prompt.trim().length < 3) {
      return { ok: false, error: 'Prompt is too short', step: 'validate-input' }
    }
    if (!artStyle || !ART_STYLE_PROMPTS[artStyle]) {
      log(`[world]   Unknown art style "${artStyle}", falling back to oil-painting`)
      artStyle = 'oil-painting'
    }
    log(`[world]   Prompt: "${prompt.slice(0, 80)}..." | Art style: ${artStyle}`)

    // Step 2: Generate world content via agent
    log('[world] Step 2/8: Generating world content via AI')
    const agentResult = await run(worldBuilderAgent, prompt, { maxTurns: 5 })
    const agentText = extractAllTextOutput(agentResult.newItems)
    log(`[world]   Agent returned ${agentText.length} chars`)

    // Step 3: Extract, normalize, and validate world structure (with retry)
    log('[world] Step 3/8: Extracting and validating world structure')
    let worldData = extractJSON<any>(agentText, 'object')
    normalizeWorldData(worldData, artStyle)
    let validation = validateWorldStructure(worldData)
    if (!validation.valid) {
      log(`[world]   Validation failed (${validation.errors.length} errors): ${validation.errors.slice(0, 5).join('; ')}. Retrying...`, 'ERROR')
      const retryPrompt = `${prompt}\n\nYour previous response had validation errors:\n${validation.errors.join('\n')}\n\nPlease fix these issues and return valid world JSON.`
      const retryResult = await run(worldBuilderAgent, retryPrompt, { maxTurns: 5 })
      const retryText = extractAllTextOutput(retryResult.newItems)
      worldData = extractJSON<any>(retryText, 'object')
      normalizeWorldData(worldData, artStyle)
      validation = validateWorldStructure(worldData)
      if (!validation.valid) {
        log(`[world]   Retry also failed (${validation.errors.length} errors). Proceeding with warnings.`, 'ERROR')
        // Don't block — proceed with what we have, user can refine sections
      } else {
        log('[world]   Retry succeeded, world structure valid')
      }
    } else {
      log('[world]   World structure valid')
    }

    // Step 4: Create world directory and save world.json
    log('[world] Step 4/8: Creating world directory and saving world.json')
    const { worldDir, world: baseWorld } = createWorld({ name: worldData.name || 'Untitled World', art_style: artStyle })
    // Merge generated content into the base world
    const world = { ...baseWorld, ...worldData, art_style: artStyle, status: 'draft' }
    saveWorld(worldDir, world)
    log(`[world]   World "${world.name}" saved to ${worldDir}`)

    // Step 5: Generate image prompts for 3 concept images
    log('[world] Step 5/8: Generating image prompts for concept images')
    const geography = world.geography || {}
    const regions = geography.regions || []
    const firstRegion = regions[0]
    const settlements = regions.flatMap((r: any) => r.settlements || [])
    const prominentSettlement = settlements[0]
    const landmarks = regions.flatMap((r: any) => r.landmarks || r.notable_features || [])
    const notableLandmark = landmarks[0]

    const subjects = [
      { label: 'landscape', description: firstRegion ? `Sweeping landscape of ${firstRegion.name}: ${firstRegion.description || ''}` : `Landscape of ${world.name || 'the world'}` },
      { label: 'city', description: prominentSettlement ? `The settlement of ${prominentSettlement.name}: ${prominentSettlement.description || ''}` : `A major city in ${world.name || 'the world'}` },
      { label: 'landmark', description: notableLandmark ? `${typeof notableLandmark === 'string' ? notableLandmark : notableLandmark.name + ': ' + (notableLandmark.description || '')}` : `A notable landmark in ${world.name || 'the world'}` },
    ]

    const imagePrompts: string[] = []
    for (const subject of subjects) {
      const imgPrompt = await generateImagePrompt(subject.description)
      imagePrompts.push(imgPrompt)
      log(`[world]   ${subject.label} prompt: "${imgPrompt.slice(0, 60)}..."`)
    }

    // Step 6: Generate 3 concept images in parallel
    log('[world] Step 6/8: Generating concept images in parallel')
    const stylePrefix = ART_STYLE_PROMPTS[artStyle] || ART_STYLE_PROMPTS['oil-painting']
    const imageResults = await Promise.allSettled(
      imagePrompts.map((imgPrompt, i) => {
        const label = subjects[i].label
        const filename = `concept_${label}.png`
        const outputPath = path.join(worldDir, 'images', filename)
        return generateImage({
          prompt: `${stylePrefix}, cinematic composition: ${imgPrompt}`,
          outputPath,
          resolution: '1K',
          aspectRatio: 'landscape',
        }).then(() => ({ label, filename, outputPath }))
      })
    )

    const conceptImages: Array<{ label: string; filename: string; path: string }> = []
    for (const result of imageResults) {
      if (result.status === 'fulfilled') {
        conceptImages.push(result.value)
        log(`[world]   Generated: ${result.value.filename}`)
      } else {
        log(`[world]   Image generation failed: ${result.reason}`, 'ERROR')
      }
    }

    // Step 7: Update world.json with concept images and set status
    log('[world] Step 7/8: Updating world.json with concept images')
    const worldDirName = path.basename(worldDir)
    world.concept_images = conceptImages.map(img => ({
      type: img.label as 'landscape' | 'city' | 'landmark',
      subject: subjects.find(s => s.label === img.label)?.description?.slice(0, 100) || img.label,
      url: `/world-images/${worldDirName}/images/${img.filename}`,
      prompt: imagePrompts[subjects.findIndex(s => s.label === img.label)] || '',
    }))
    world.status = 'draft'
    saveWorld(worldDir, world)
    log(`[world]   ${conceptImages.length}/3 concept images saved, status set to draft`)

    // Step 8: Return the world
    log('[world] Step 8/8: Complete')
    return {
      ok: true,
      data: { world },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log(`[world] FAILED: ${msg}`, 'ERROR')
    return { ok: false, error: msg, step: 'world-generation' }
  }
}
