// ─── World structure validation ───
// Lenient: count mismatches and missing optional fields are warnings, not errors.
// Only truly missing required sections are errors.

export function validateWorldStructure(world: any): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (!world || typeof world !== 'object') {
    return { valid: false, errors: ['World data must be an object'], warnings: [] }
  }

  // 1. Required top-level fields (server-managed ones like id/status/art_style filled by normalize)
  for (const field of ['id', 'name', 'overview', 'history', 'geography']) {
    if (world[field] === undefined || world[field] === null) {
      errors.push(`Missing required section: ${field}`)
    }
  }
  // These are important but not blocking
  for (const field of ['tagline', 'status', 'art_style', 'factions', 'religion', 'key_figures']) {
    if (world[field] === undefined || world[field] === null) {
      warnings.push(`Missing field: ${field}`)
    }
  }

  // Collect valid IDs for cross-reference checks
  const regionIds = new Set<string>()
  const factionIds = new Set<string>()

  // 2. Overview
  if (world.overview && typeof world.overview === 'object') {
    const ov = world.overview
    if (!ov.description || (typeof ov.description === 'string' && ov.description.length < 50)) {
      warnings.push(`overview.description is short or missing (${ov.description?.length || 0} chars)`)
    }
    if (!ov.tone) warnings.push('overview missing tone')
    if (!ov.genre) warnings.push('overview missing genre')
  }

  // 3. History
  if (world.history && typeof world.history === 'object') {
    const hist = world.history
    if (!hist.creation_myth) warnings.push('history missing creation_myth')
    if (Array.isArray(hist.timeline)) {
      if (hist.timeline.length < 3) warnings.push(`history.timeline has only ${hist.timeline.length} events (recommend 5-8)`)
      for (let i = 0; i < hist.timeline.length; i++) {
        const evt = hist.timeline[i]
        if (!evt.name && !evt.title) warnings.push(`history.timeline[${i}] missing name`)
        if (!evt.description && !evt.details) warnings.push(`history.timeline[${i}] missing description`)
      }
    } else {
      warnings.push('history.timeline is not an array')
    }
  }

  // 4. Geography
  if (world.geography && typeof world.geography === 'object') {
    const geo = world.geography
    if (Array.isArray(geo.regions)) {
      if (geo.regions.length < 2) warnings.push(`geography has only ${geo.regions.length} regions (recommend 3-5)`)
      for (let i = 0; i < geo.regions.length; i++) {
        const region = geo.regions[i]
        if (!region.name) warnings.push(`geography.regions[${i}] missing name`)
        if (region.id) regionIds.add(region.id)
      }
    } else {
      warnings.push('geography.regions is not an array')
    }
  }

  // 5. Factions
  if (Array.isArray(world.factions)) {
    if (world.factions.length < 2) warnings.push(`Only ${world.factions.length} factions (recommend 3-5)`)
    for (let i = 0; i < world.factions.length; i++) {
      const f = world.factions[i]
      if (!f.name) warnings.push(`factions[${i}] missing name`)
      if (f.id) factionIds.add(f.id)
    }
  }

  // 6. Religion
  if (world.religion && typeof world.religion === 'object') {
    const rel = world.religion
    if (Array.isArray(rel.deities_or_forces)) {
      if (rel.deities_or_forces.length < 2) warnings.push(`Only ${rel.deities_or_forces.length} deities/forces (recommend 3-5)`)
    }
  }

  // 7. Key figures
  if (Array.isArray(world.key_figures)) {
    if (world.key_figures.length < 2) warnings.push(`Only ${world.key_figures.length} key figures (recommend 3-5)`)
    for (let i = 0; i < world.key_figures.length; i++) {
      if (!world.key_figures[i].name) warnings.push(`key_figures[${i}] missing name`)
    }
  }

  // 8. Cross-reference checks (all warnings, not errors)
  if (world.geography?.regions && Array.isArray(world.geography.regions)) {
    for (const region of world.geography.regions) {
      if (Array.isArray(region.connections)) {
        for (const conn of region.connections) {
          if (conn && !regionIds.has(conn)) {
            warnings.push(`Region "${region.name}" references unknown connection: ${conn}`)
          }
        }
      }
      if (region.controlling_faction && !factionIds.has(region.controlling_faction)) {
        warnings.push(`Region "${region.name}" references unknown faction: ${region.controlling_faction}`)
      }
    }
  }

  if (Array.isArray(world.factions)) {
    for (const faction of world.factions) {
      if (faction.territory && !regionIds.has(faction.territory)) {
        warnings.push(`Faction "${faction.name}" references unknown territory: ${faction.territory}`)
      }
    }
  }

  if (Array.isArray(world.key_figures)) {
    for (const figure of world.key_figures) {
      if (figure.faction_id && !factionIds.has(figure.faction_id)) {
        warnings.push(`Figure "${figure.name}" references unknown faction: ${figure.faction_id}`)
      }
      if (figure.location && !regionIds.has(figure.location)) {
        warnings.push(`Figure "${figure.name}" references unknown location: ${figure.location}`)
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
