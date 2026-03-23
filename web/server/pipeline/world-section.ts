import { run, extractAllTextOutput } from '@openai/agents'
import { worldSectionUpdaterAgent } from '../agents/world-section-updater.js'
import { saveWorld } from '../agents/tools/world-state.js'
import { validateWorldStructure } from '../agents/tools/world-validation.js'
import { log, extractJSON } from '../utils.js'
import type { PipelineResult } from '../types.js'

const VALID_SECTIONS = ['overview', 'history', 'geography', 'factions', 'religion', 'key_figures'] as const

// ─── World Section Update Pipeline ───

export interface WorldSectionResponse {
  world: any
  section: string
  updated: any
}

export async function updateWorldSectionPipeline(worldDir: string, world: any, section: string, prompt: string): Promise<PipelineResult<WorldSectionResponse>> {
  try {
    // Step 1: Validate section name
    log('[world-section] Step 1/4: Validating section name')
    if (!VALID_SECTIONS.includes(section as any)) {
      return { ok: false, error: `Invalid section "${section}". Valid sections: ${VALID_SECTIONS.join(', ')}`, step: 'validate-section' }
    }
    log(`[world-section]   Section: ${section}`)

    // Step 2: Run worldSectionUpdaterAgent
    log('[world-section] Step 2/4: Generating updated section via AI')
    const agentPrompt = [
      `Here is the full world JSON:`,
      '```json',
      JSON.stringify(world, null, 2),
      '```',
      '',
      `Update the "${section}" section based on the following instruction:`,
      prompt,
      '',
      `Return ONLY the updated JSON for the "${section}" section, nothing else.`,
    ].join('\n')

    const agentResult = await run(worldSectionUpdaterAgent, agentPrompt, { maxTurns: 5 })
    const agentText = extractAllTextOutput(agentResult.newItems)
    log(`[world-section]   Agent returned ${agentText.length} chars`)

    // Step 3: Extract JSON, merge into world, and validate
    log('[world-section] Step 3/4: Extracting, merging, and validating')
    const updatedSection = extractJSON<any>(agentText, 'object')
    world[section] = updatedSection
    const validation = validateWorldStructure(world)
    if (!validation.valid) {
      return { ok: false, error: `Validation failed after merge: ${validation.errors.join(', ')}`, step: 'validate-world' }
    }
    log(`[world-section]   Section "${section}" merged and validated`)

    // Step 4: Save updated world.json and return
    log('[world-section] Step 4/4: Saving updated world.json')
    saveWorld(worldDir, world)
    log('[world-section]   Complete')

    return {
      ok: true,
      data: { world, section, updated: updatedSection },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log(`[world-section] FAILED: ${msg}`, 'ERROR')
    return { ok: false, error: msg, step: 'section-update' }
  }
}
