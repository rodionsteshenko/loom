// ─── World structure validation ───

export function validateWorldStructure(world: any): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Required top-level fields
  const requiredFields = [
    'id', 'name', 'tagline', 'status', 'art_style',
    'overview', 'history', 'geography', 'factions', 'religion', 'key_figures',
  ]
  for (const field of requiredFields) {
    if (world[field] === undefined || world[field] === null) {
      errors.push(`Missing required top-level field: ${field}`)
    }
  }

  // Collect valid IDs for cross-reference checks
  const regionIds = new Set<string>()
  const factionIds = new Set<string>()

  // 2. Overview validation
  if (world.overview && typeof world.overview === 'object') {
    const ov = world.overview
    for (const field of ['tone', 'genre', 'era', 'description']) {
      if (!ov[field]) errors.push(`overview missing required field: ${field}`)
    }
    if (ov.description && typeof ov.description === 'string' && ov.description.length < 100) {
      errors.push(`overview.description must be at least 100 characters (got ${ov.description.length})`)
    }
    if (!Array.isArray(ov.themes)) {
      errors.push('overview.themes must be an array')
    } else if (ov.themes.length < 3 || ov.themes.length > 5) {
      errors.push(`overview.themes must have 3-5 items (got ${ov.themes.length})`)
    }
  }

  // 3. History validation
  if (world.history && typeof world.history === 'object') {
    const hist = world.history
    if (!hist.creation_myth) {
      errors.push('history missing required field: creation_myth')
    } else if (typeof hist.creation_myth === 'string' && hist.creation_myth.length < 100) {
      errors.push(`history.creation_myth must be at least 100 characters (got ${hist.creation_myth.length})`)
    }
    if (!Array.isArray(hist.timeline)) {
      errors.push('history.timeline must be an array')
    } else {
      if (hist.timeline.length < 5 || hist.timeline.length > 8) {
        errors.push(`history.timeline must have 5-8 items (got ${hist.timeline.length})`)
      }
      const eventFields = ['era', 'name', 'year_label', 'description', 'impact']
      for (let i = 0; i < hist.timeline.length; i++) {
        const evt = hist.timeline[i]
        for (const field of eventFields) {
          if (!evt[field]) {
            errors.push(`history.timeline[${i}] missing required field: ${field}`)
          }
        }
      }
    }
  }

  // 4. Geography validation
  if (world.geography && typeof world.geography === 'object') {
    const geo = world.geography
    if (!geo.overview) {
      errors.push('geography missing required field: overview')
    } else if (typeof geo.overview === 'string' && geo.overview.length < 50) {
      errors.push(`geography.overview must be at least 50 characters (got ${geo.overview.length})`)
    }
    if (!Array.isArray(geo.regions)) {
      errors.push('geography.regions must be an array')
    } else {
      if (geo.regions.length < 3 || geo.regions.length > 5) {
        errors.push(`geography.regions must have 3-5 items (got ${geo.regions.length})`)
      }
      const regionFields = ['id', 'name', 'type', 'description', 'notable_features', 'connections']
      for (let i = 0; i < geo.regions.length; i++) {
        const region = geo.regions[i]
        for (const field of regionFields) {
          if (region[field] === undefined || region[field] === null) {
            errors.push(`geography.regions[${i}] missing required field: ${field}`)
          }
        }
        if (region.id) regionIds.add(region.id)
      }
    }
  }

  // 5. Factions validation
  if (Array.isArray(world.factions)) {
    if (world.factions.length < 3 || world.factions.length > 5) {
      errors.push(`factions must have 3-5 items (got ${world.factions.length})`)
    }
    const factionFields = ['id', 'name', 'type', 'description', 'goals', 'methods', 'leader']
    for (let i = 0; i < world.factions.length; i++) {
      const faction = world.factions[i]
      for (const field of factionFields) {
        if (faction[field] === undefined || faction[field] === null) {
          errors.push(`factions[${i}] missing required field: ${field}`)
        }
      }
      if (faction.id) factionIds.add(faction.id)
    }
  } else if (world.factions !== undefined) {
    errors.push('factions must be an array')
  }

  // 6. Religion validation
  if (world.religion && typeof world.religion === 'object') {
    const rel = world.religion
    if (!rel.overview) {
      errors.push('religion missing required field: overview')
    } else if (typeof rel.overview === 'string' && rel.overview.length < 50) {
      errors.push(`religion.overview must be at least 50 characters (got ${rel.overview.length})`)
    }
    if (!Array.isArray(rel.deities_or_forces)) {
      errors.push('religion.deities_or_forces must be an array')
    } else {
      if (rel.deities_or_forces.length < 3 || rel.deities_or_forces.length > 5) {
        errors.push(`religion.deities_or_forces must have 3-5 items (got ${rel.deities_or_forces.length})`)
      }
      const deityFields = ['name', 'domain', 'description']
      for (let i = 0; i < rel.deities_or_forces.length; i++) {
        const deity = rel.deities_or_forces[i]
        for (const field of deityFields) {
          if (!deity[field]) {
            errors.push(`religion.deities_or_forces[${i}] missing required field: ${field}`)
          }
        }
      }
    }
  }

  // 7. Key figures validation
  if (Array.isArray(world.key_figures)) {
    if (world.key_figures.length < 3 || world.key_figures.length > 5) {
      errors.push(`key_figures must have 3-5 items (got ${world.key_figures.length})`)
    }
    const figureFields = ['name', 'title', 'description', 'role']
    for (let i = 0; i < world.key_figures.length; i++) {
      const figure = world.key_figures[i]
      for (const field of figureFields) {
        if (!figure[field]) {
          errors.push(`key_figures[${i}] missing required field: ${field}`)
        }
      }
      if (typeof figure.alive !== 'boolean') {
        errors.push(`key_figures[${i}] missing required field: alive (must be boolean)`)
      }
    }
  } else if (world.key_figures !== undefined) {
    errors.push('key_figures must be an array')
  }

  // 8. Cross-reference checks (warnings for optional fields)
  // Region connections → valid region IDs
  if (world.geography?.regions && Array.isArray(world.geography.regions)) {
    for (const region of world.geography.regions) {
      if (Array.isArray(region.connections)) {
        for (const conn of region.connections) {
          if (conn && !regionIds.has(conn)) {
            warnings.push(`Region "${region.name || region.id}" references unknown region connection: ${conn}`)
          }
        }
      }
      if (region.controlling_faction && !factionIds.has(region.controlling_faction)) {
        warnings.push(`Region "${region.name || region.id}" references unknown controlling_faction: ${region.controlling_faction}`)
      }
    }
  }

  // Faction territory → valid region IDs
  if (Array.isArray(world.factions)) {
    for (const faction of world.factions) {
      if (faction.territory && !regionIds.has(faction.territory)) {
        warnings.push(`Faction "${faction.name || faction.id}" references unknown territory: ${faction.territory}`)
      }
    }
  }

  // Key figure references
  if (Array.isArray(world.key_figures)) {
    for (const figure of world.key_figures) {
      if (figure.faction_id && !factionIds.has(figure.faction_id)) {
        warnings.push(`Key figure "${figure.name}" references unknown faction_id: ${figure.faction_id}`)
      }
      if (figure.location && !regionIds.has(figure.location)) {
        warnings.push(`Key figure "${figure.name}" references unknown location: ${figure.location}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
