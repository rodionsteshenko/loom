import { tool } from '@openai/agents'
import { z } from 'zod'

// --- Enums ---

export enum RollOutcome {
  CRITICAL_SUCCESS = 'critical_success',
  SUCCESS = 'success',
  PARTIAL_SUCCESS = 'partial_success',
  FAILURE = 'failure',
  CRITICAL_FAILURE = 'critical_failure',
}

export function isSuccess(outcome: RollOutcome): boolean {
  return (
    outcome === RollOutcome.CRITICAL_SUCCESS ||
    outcome === RollOutcome.SUCCESS ||
    outcome === RollOutcome.PARTIAL_SUCCESS
  )
}

export function outcomeDescription(outcome: RollOutcome): string {
  const descriptions: Record<RollOutcome, string> = {
    [RollOutcome.CRITICAL_SUCCESS]: 'Critical Success! Exceptional outcome.',
    [RollOutcome.SUCCESS]: 'Success! You achieved your goal.',
    [RollOutcome.PARTIAL_SUCCESS]: 'Partial success. You succeeded, but with complications.',
    [RollOutcome.FAILURE]: 'Failure. You did not achieve your goal.',
    [RollOutcome.CRITICAL_FAILURE]: 'Critical Failure! Something went terribly wrong.',
  }
  return descriptions[outcome]
}

// --- Types ---

export interface CheckResult {
  naturalRoll: number
  modifier: number
  total: number
  dc: number
  outcome: RollOutcome
  margin: number
  autoResolved: boolean
  skill: string | null
  ability: string | null
  isCritical: boolean
}

export interface CheckResultDict {
  natural_roll: number
  modifier: number
  total: number
  dc: number
  outcome: string
  margin: number
  auto_resolved: boolean
  skill: string | null
  ability: string | null
  is_critical: boolean
}

export interface ContestedResult {
  attackerResult: CheckResult
  defenderResult: CheckResult
  attackerWins: boolean
}

export interface DamageResult {
  total: number
  rolls: number[]
}

// --- Helpers ---

function makeCheckResult(params: Omit<CheckResult, 'isCritical'>): CheckResult {
  return {
    ...params,
    isCritical: params.naturalRoll === 1 || params.naturalRoll === 20,
  }
}

export function checkResultToDict(result: CheckResult): CheckResultDict {
  return {
    natural_roll: result.naturalRoll,
    modifier: result.modifier,
    total: result.total,
    dc: result.dc,
    outcome: result.outcome,
    margin: result.margin,
    auto_resolved: result.autoResolved,
    skill: result.skill,
    ability: result.ability,
    is_critical: result.isCritical,
  }
}

// --- Core Functions ---

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

export function determineOutcome(
  naturalRoll: number,
  total: number,
  dc: number,
  partialThreshold: number = 5,
): RollOutcome {
  if (naturalRoll === 1) return RollOutcome.CRITICAL_FAILURE
  if (naturalRoll === 20) return RollOutcome.CRITICAL_SUCCESS
  if (total >= dc) {
    const margin = total - dc
    if (margin < partialThreshold) return RollOutcome.PARTIAL_SUCCESS
    return RollOutcome.SUCCESS
  }
  return RollOutcome.FAILURE
}

export function rollCheck(options: {
  modifier: number
  dc: number
  skill?: string | null
  ability?: string | null
  autoSucceed?: boolean
  autoFail?: boolean
  advantage?: boolean
  disadvantage?: boolean
}): CheckResult {
  const {
    modifier,
    dc,
    skill = null,
    ability = null,
    autoSucceed = false,
    autoFail = false,
    advantage = false,
    disadvantage = false,
  } = options

  if (autoSucceed) {
    return makeCheckResult({
      naturalRoll: 20,
      modifier,
      total: 20 + modifier,
      dc,
      outcome: RollOutcome.SUCCESS,
      margin: 20 + modifier - dc,
      autoResolved: true,
      skill,
      ability,
    })
  }

  if (autoFail) {
    return makeCheckResult({
      naturalRoll: 1,
      modifier,
      total: 1 + modifier,
      dc,
      outcome: RollOutcome.FAILURE,
      margin: 1 + modifier - dc,
      autoResolved: true,
      skill,
      ability,
    })
  }

  let naturalRoll: number
  if (advantage || disadvantage) {
    const roll1 = rollD20()
    const roll2 = rollD20()
    naturalRoll = advantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2)
  } else {
    naturalRoll = rollD20()
  }

  const total = naturalRoll + modifier
  const margin = total - dc
  const outcome = determineOutcome(naturalRoll, total, dc)

  return makeCheckResult({
    naturalRoll,
    modifier,
    total,
    dc,
    outcome,
    margin,
    autoResolved: false,
    skill,
    ability,
  })
}

export function rollContested(options: {
  attackerMod: number
  defenderMod: number
  attackerAdvantage?: boolean
  defenderAdvantage?: boolean
}): ContestedResult {
  const {
    attackerMod,
    defenderMod,
    attackerAdvantage = false,
    defenderAdvantage = false,
  } = options

  const atkRoll = attackerAdvantage ? Math.max(rollD20(), rollD20()) : rollD20()
  const atkTotal = atkRoll + attackerMod

  const defRoll = defenderAdvantage ? Math.max(rollD20(), rollD20()) : rollD20()
  const defTotal = defRoll + defenderMod

  const attackerWins = atkTotal > defTotal

  const attackerResult = makeCheckResult({
    naturalRoll: atkRoll,
    modifier: attackerMod,
    total: atkTotal,
    dc: defTotal,
    outcome: attackerWins ? RollOutcome.SUCCESS : RollOutcome.FAILURE,
    margin: atkTotal - defTotal,
    autoResolved: false,
    skill: null,
    ability: null,
  })

  const defenderResult = makeCheckResult({
    naturalRoll: defRoll,
    modifier: defenderMod,
    total: defTotal,
    dc: atkTotal,
    outcome: attackerWins ? RollOutcome.FAILURE : RollOutcome.SUCCESS,
    margin: defTotal - atkTotal,
    autoResolved: false,
    skill: null,
    ability: null,
  })

  return { attackerResult, defenderResult, attackerWins }
}

export function rollDamage(diceExpr: string, modifier: number = 0): DamageResult {
  const match = diceExpr.toLowerCase().match(/^(\d+)d(\d+)$/)
  if (!match) return { total: modifier, rolls: [] }

  const numDice = parseInt(match[1], 10)
  const dieSize = parseInt(match[2], 10)
  const rolls: number[] = []

  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * dieSize) + 1)
  }

  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier
  return { total, rolls }
}

// --- OpenAI Agents SDK Tool ---

export const rollDiceTool = tool({
  name: 'roll_dice',
  description:
    'Roll a dice check. Provide notation (e.g. "1d20+5"), a DC (difficulty class), and optional skill/ability/advantage/disadvantage. Returns the full CheckResult as JSON including outcome, margin, and whether it was a critical.',
  parameters: z.object({
    notation: z
      .string()
      .describe(
        'Dice notation like "1d20+5" or "1d20-2". The modifier after +/- is added to the d20 roll.',
      ),
    dc: z.string().describe('The difficulty class (DC) as a number string, e.g. "15"'),
    skill: z.string().optional().describe('Optional skill being tested, e.g. "perception"'),
    ability: z.string().optional().describe('Optional ability score being used, e.g. "wisdom"'),
    advantage: z
      .string()
      .optional()
      .describe('Set to "true" if the roller has advantage'),
    disadvantage: z
      .string()
      .optional()
      .describe('Set to "true" if the roller has disadvantage'),
  }),
  async execute({ notation, dc, skill, ability, advantage, disadvantage }) {
    // Parse notation like "1d20+5", "1d20-2", "1d20"
    const notationMatch = notation.toLowerCase().match(/^\d*d20([+-]\d+)?$/)
    const modifier = notationMatch?.[1] ? parseInt(notationMatch[1], 10) : 0
    const dcNum = parseInt(dc, 10)

    const result = rollCheck({
      modifier,
      dc: dcNum,
      skill: skill || null,
      ability: ability || null,
      advantage: advantage === 'true',
      disadvantage: disadvantage === 'true',
    })

    return JSON.stringify(checkResultToDict(result))
  },
})
