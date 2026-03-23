import { tool } from "@openai/agents";
import { z } from "zod";

// --- Types & Interfaces ---

export enum DifficultyTier {
  TRIVIAL = 5,
  EASY = 10,
  MEDIUM = 15,
  HARD = 20,
  EXTREME = 25,
  IMPOSSIBLE = 30,
}

export interface Character {
  stats?: Record<string, number>;
  skills?: string[];
  level?: number;
}

export interface DifficultyAnalysis {
  dc: number;
  tier: string;
  modifier: number;
  auto_succeed: boolean;
  auto_fail: boolean;
  success_chance: number;
  description: string;
}

// --- Constants ---

export const SKILL_ABILITIES: Record<string, string> = {
  Athletics: "STR",
  Acrobatics: "DEX",
  "Sleight of Hand": "DEX",
  Stealth: "DEX",
  Arcana: "INT",
  History: "INT",
  Investigation: "INT",
  Nature: "INT",
  Religion: "INT",
  "Animal Handling": "WIS",
  Insight: "WIS",
  Medicine: "WIS",
  Perception: "WIS",
  Survival: "WIS",
  Deception: "CHA",
  Intimidation: "CHA",
  Performance: "CHA",
  Persuasion: "CHA",
};

// --- Functions ---

export function difficultyTierFromDC(dc: number): DifficultyTier {
  if (dc <= 5) return DifficultyTier.TRIVIAL;
  if (dc <= 10) return DifficultyTier.EASY;
  if (dc <= 15) return DifficultyTier.MEDIUM;
  if (dc <= 20) return DifficultyTier.HARD;
  if (dc <= 25) return DifficultyTier.EXTREME;
  return DifficultyTier.IMPOSSIBLE;
}

export function difficultyTierName(tier: DifficultyTier): string {
  switch (tier) {
    case DifficultyTier.TRIVIAL:
      return "TRIVIAL";
    case DifficultyTier.EASY:
      return "EASY";
    case DifficultyTier.MEDIUM:
      return "MEDIUM";
    case DifficultyTier.HARD:
      return "HARD";
    case DifficultyTier.EXTREME:
      return "EXTREME";
    case DifficultyTier.IMPOSSIBLE:
      return "IMPOSSIBLE";
  }
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function getProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

export function getRelevantModifier(
  character: Character,
  skill?: string,
  ability?: string,
): number {
  const stats = character.stats ?? {};
  const skills = character.skills ?? [];
  const level = character.level ?? 1;

  if (skill && skill in SKILL_ABILITIES) {
    ability = SKILL_ABILITIES[skill];
  } else if (!ability) {
    ability = "STR";
  }

  const abilityScore = stats[ability!] ?? 10;
  const abilityMod = getAbilityModifier(abilityScore);

  if (skill && skills.includes(skill)) {
    return abilityMod + getProficiencyBonus(level);
  }

  return abilityMod;
}

export function checkAutoSucceed(
  modifier: number,
  dc: number,
  threshold: number = 5,
): boolean {
  return modifier >= dc - threshold;
}

export function checkAutoFail(modifier: number, dc: number): boolean {
  return 20 + modifier < dc;
}

export function calculateSuccessChance(modifier: number, dc: number): number {
  const requiredRoll = dc - modifier;
  if (requiredRoll <= 1) return 100.0;
  if (requiredRoll > 20) return 0.0;
  return (21 - requiredRoll) * 5.0;
}

export function analyzeDifficulty(
  character: Character,
  dc: number,
  skill?: string,
  ability?: string,
): DifficultyAnalysis {
  const modifier = getRelevantModifier(character, skill, ability);
  const tier = difficultyTierFromDC(dc);
  const autoSucceed = checkAutoSucceed(modifier, dc);
  const autoFail = checkAutoFail(modifier, dc);
  const chance = calculateSuccessChance(modifier, dc);

  let description: string;
  if (autoSucceed) {
    description = "This is trivial for you.";
  } else if (autoFail) {
    description = "This is beyond your capabilities.";
  } else if (chance >= 80) {
    description = "You're confident you can do this.";
  } else if (chance >= 60) {
    description = "A reasonable challenge.";
  } else if (chance >= 40) {
    description = "This will be difficult.";
  } else if (chance >= 20) {
    description = "The odds are against you.";
  } else {
    description = "You'd need a miracle.";
  }

  return {
    dc,
    tier: difficultyTierName(tier),
    modifier,
    auto_succeed: autoSucceed,
    auto_fail: autoFail,
    success_chance: chance,
    description,
  };
}

// --- Agent Tool ---

export const analyzeDifficultyTool = tool({
  name: "analyze_difficulty",
  description:
    "Analyze how difficult a check is for a given character. Returns the DC tier, the character's relevant modifier, auto-succeed/fail status, success chance percentage, and a human-readable description.",
  parameters: z.object({
    character_json: z
      .string()
      .describe(
        "JSON string of the character object with stats, skills, and level",
      ),
    dc: z.number().describe("The difficulty class of the check"),
    skill: z
      .string()
      .optional()
      .describe("The skill being used (e.g. 'Stealth', 'Perception')"),
    ability: z
      .string()
      .optional()
      .describe(
        "The ability being used (e.g. 'STR', 'DEX'). Inferred from skill if not provided.",
      ),
  }),
  execute: async ({ character_json, dc, skill, ability }) => {
    const character: Character = JSON.parse(character_json);
    const result = analyzeDifficulty(character, dc, skill, ability);
    return JSON.stringify(result);
  },
});
