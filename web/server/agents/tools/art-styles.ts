/**
 * Centralized art style prompts for ALL image generation.
 * These must be highly specific to ensure visual consistency across images.
 * Every image in a world/campaign uses the same style prefix.
 */

export const ART_STYLE_PROMPTS: Record<string, string> = {
  'oil-painting':
    'Traditional oil painting on canvas. Thick visible brushstrokes with impasto technique. Rich saturated colors with deep shadows and warm highlights. Rembrandt-style chiaroscuro lighting. Painterly texture throughout — no photorealism, no digital smoothness. Colors bleed slightly at edges. Varnished canvas look.',

  'classic-fantasy':
    'Classic 1980s fantasy illustration in the style of Larry Elmore and Keith Parkinson. Detailed oil painting technique with smooth blending. Warm golden lighting, rich earth tones and jewel colors. Heroic proportions, dramatic poses. TSR/D&D module cover art aesthetic. Detailed but not photorealistic — clearly painted by hand.',

  'dark-fantasy':
    'Dark fantasy art with heavy atmosphere. Desaturated color palette dominated by deep blacks, cold blues, muted greens, and occasional blood-red accents. Gritty texture with film grain. Moody volumetric lighting with deep shadows. FromSoftware / Dark Souls aesthetic. Gothic architecture, oppressive skies. Everything feels weathered, ancient, dangerous.',

  'watercolor':
    'Delicate watercolor illustration on textured paper. Soft translucent washes of color that bleed and bloom naturally. Visible paper texture showing through paint. Light, airy composition with generous white space. Gentle gradients, no hard edges. Colors are muted pastels — soft blues, warm peaches, sage greens. Feels hand-painted and intimate.',

  'storybook':
    'Whimsical storybook illustration in the style of classic children\'s fantasy books. Warm, inviting colors with golden-hour lighting. Slightly exaggerated proportions — big eyes, expressive faces. Detailed pen linework with soft colored fills. Charming, cozy atmosphere. Think Brian Froud meets Arthur Rackham. Every scene feels like a page from a beloved book.',

  'art-nouveau':
    'Art Nouveau illustration with flowing organic lines and decorative borders. Mucha-inspired composition with elegant curves and natural motifs — vines, flowers, flowing hair. Rich but flat color palette with gold accents. Strong outlines with interior gradients. Ornamental frame elements. Stained-glass quality to colors. Every element has graceful, sinuous curves.',

  'digital-art':
    'Clean modern digital illustration with polished rendering. Smooth gradients, precise edges, vibrant saturated colors. Professional concept art quality — not painterly, not photorealistic. Crisp lighting with rim lights and ambient occlusion. Rich color palettes with complementary accents. ArtStation/DeviantArt professional quality. Everything is sharp and intentional.',

  'concept-art':
    'Film/game production concept art. Loose but confident brushwork with deliberate visible strokes. Environmental storytelling — every element serves the narrative. Atmospheric perspective with muted backgrounds and detailed foregrounds. Color keys that establish mood. Speed-painting energy with professional finish. Paintover techniques mixing photo reference with painted elements.',

  'realistic':
    'Hyperrealistic digital rendering approaching photography. Extremely detailed textures — skin pores, fabric weave, metal scratches. Physically accurate lighting with global illumination, subsurface scattering on skin, caustics in water. Shallow depth of field. Cinematic color grading with teal-orange palette. 8K detail level. Could be mistaken for a photograph of a real scene.',

  'comic-book':
    'Bold comic book art with strong black ink outlines of varying weight. Flat color fills with cel-shading — no smooth gradients. Ben-Day dots for mid-tones. Dynamic panel-composition energy with dramatic angles and foreshortening. Primary color palette — bold reds, blues, yellows with black shadows. Speed lines for motion. Marvel/DC house style.',

  'anime':
    'Japanese anime illustration style with clean precise linework and flat cel-shaded coloring. Large expressive eyes, stylized hair with individual strands. Vibrant saturated color palette. Soft ambient lighting with dramatic action highlights. Clean backgrounds with atmospheric gradients. Character-focused composition. Studio Bones / Ufotable quality. Distinctly 2D — no 3D rendering.',

  'pixel-art':
    'Retro pixel art in 16-bit SNES/Genesis era style. Visible individual pixels with limited color palette (32-64 colors max). Dithering for gradients. Small detailed sprites with clear silhouettes. Tile-based environment design. Bright saturated colors against dark backgrounds. No anti-aliasing — hard pixel edges only. Chrono Trigger / Final Fantasy VI aesthetic.',

  'noir':
    'Film noir style in high-contrast black and white with dramatic shadows. Harsh directional lighting creating strong silhouettes and venetian blind patterns. Deep blacks, bright whites, minimal midtones. Cigarette smoke, rain on windows, wet streets reflecting light. 1940s detective aesthetic. Occasional single-color accent (red lips, amber whiskey). Everything is shadows and mystery.',

  'gothic':
    'Gothic art with dark romantic atmosphere. Victorian/Pre-Raphaelite aesthetic — ornate details, flowing fabrics, melancholy beauty. Rich jewel tones — deep crimson, royal purple, forest green — against black. Candlelight and moonlight illumination. Cathedral-like architectural elements with pointed arches. Roses, thorns, ravens, iron filigree. Beautiful but haunted.',

  'eldritch':
    'Eldritch horror art with Lovecraftian cosmic dread. Unsettling color palette — sickly greens, deep purples, impossible geometries. Organic textures that seem alive — tentacles, eyes, membrane. Perspective distortion suggesting non-Euclidean space. Vast scale — tiny humans against incomprehensible entities. Fog, depth, the unknown. Art should feel wrong, like staring too long hurts.',
}

export function getArtStylePrompt(artStyle: string): string {
  return ART_STYLE_PROMPTS[artStyle] || ART_STYLE_PROMPTS['oil-painting']
}
