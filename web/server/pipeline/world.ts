import { run, extractAllTextOutput } from '@openai/agents'
import path from 'path'
import { worldBuilderAgent } from '../agents/world-builder.js'
import { imagePromptAgent } from '../agents/image-prompt.js'
import { generateImage } from '../agents/tools/image.js'
import { createWorld, saveWorld } from '../agents/tools/world-state.js'
import { validateWorldStructure } from '../agents/tools/world-validation.js'
import { log, extractJSON } from '../utils.js'
import type { PipelineResult } from '../types.js'

const WORLD_ART_STYLES: Record<string, string> = {
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
    if (!prompt || prompt.trim().length < 10) {
      return { ok: false, error: 'Prompt must be at least 10 characters', step: 'validate-input' }
    }
    if (!artStyle || !WORLD_ART_STYLES[artStyle]) {
      log(`[world]   Unknown art style "${artStyle}", falling back to oil-painting`)
      artStyle = 'oil-painting'
    }
    log(`[world]   Prompt: "${prompt.slice(0, 80)}..." | Art style: ${artStyle}`)

    // Step 2: Generate world content via agent
    log('[world] Step 2/8: Generating world content via AI')
    const agentResult = await run(worldBuilderAgent, prompt, { maxTurns: 5 })
    const agentText = extractAllTextOutput(agentResult.newItems)
    log(`[world]   Agent returned ${agentText.length} chars`)

    // Step 3: Extract and validate world structure (with retry)
    log('[world] Step 3/8: Extracting and validating world structure')
    let worldData = extractJSON<any>(agentText, 'object')
    let validation = validateWorldStructure(worldData)
    if (!validation.valid) {
      log(`[world]   Validation failed: ${validation.errors.join(', ')}. Retrying...`, 'ERROR')
      const retryPrompt = `${prompt}\n\nYour previous response had validation errors:\n${validation.errors.join('\n')}\n\nPlease fix these issues and return valid world JSON.`
      const retryResult = await run(worldBuilderAgent, retryPrompt, { maxTurns: 5 })
      const retryText = extractAllTextOutput(retryResult.newItems)
      worldData = extractJSON<any>(retryText, 'object')
      validation = validateWorldStructure(worldData)
      if (!validation.valid) {
        return { ok: false, error: `World validation failed after retry: ${validation.errors.join(', ')}`, step: 'validate-world' }
      }
      log('[world]   Retry succeeded, world structure valid')
    } else {
      log('[world]   World structure valid')
    }

    // Step 4: Create world directory and save world.json
    log('[world] Step 4/8: Creating world directory and saving world.json')
    const { worldDir, world } = createWorld(worldData)
    Object.assign(world, worldData)
    world.art_style = artStyle
    saveWorld(worldDir, world)
    log(`[world]   World saved to ${worldDir}`)

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
    const stylePrefix = WORLD_ART_STYLES[artStyle] || WORLD_ART_STYLES['oil-painting']
    const imageResults = await Promise.allSettled(
      imagePrompts.map((imgPrompt, i) => {
        const label = subjects[i].label
        const filename = `concept_${label}.png`
        const outputPath = path.join(worldDir, 'images', filename)
        return generateImage({
          prompt: `${stylePrefix}, cinematic composition: ${imgPrompt}`,
          outputPath,
          resolution: '1K',
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
    world.concept_images = conceptImages.map(img => ({
      label: img.label,
      filename: img.filename,
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
