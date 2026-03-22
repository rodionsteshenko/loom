// Shared art styles for character creation and campaigns
export interface ArtStyle {
  id: string
  name: string
  description: string
}

export const ART_STYLES: ArtStyle[] = [
  // Classic Fantasy
  { id: 'oil-painting', name: 'Oil Painting', description: 'Rich brushstrokes, dramatic lighting' },
  { id: 'classic-fantasy', name: 'Classic Fantasy', description: '80s D&D, Larry Elmore style' },
  { id: 'dark-fantasy', name: 'Dark Fantasy', description: 'Gritty, moody, deep shadows' },
  
  // Stylized
  { id: 'watercolor', name: 'Watercolor', description: 'Soft, flowing, ethereal' },
  { id: 'storybook', name: 'Storybook', description: 'Whimsical, illustrated' },
  { id: 'art-nouveau', name: 'Art Nouveau', description: 'Ornate, flowing lines' },
  
  // Modern
  { id: 'digital-art', name: 'Digital Art', description: 'Clean, polished illustration' },
  { id: 'concept-art', name: 'Concept Art', description: 'Film/game production style' },
  { id: 'realistic', name: 'Photorealistic', description: 'Highly detailed, lifelike' },
  
  // Stylized/Pop
  { id: 'comic-book', name: 'Comic Book', description: 'Bold lines, vivid colors' },
  { id: 'anime', name: 'Anime', description: 'Japanese animation style' },
  { id: 'pixel-art', name: 'Pixel Art', description: 'Retro 16-bit aesthetic' },
  
  // Moody
  { id: 'noir', name: 'Noir', description: 'High contrast, shadows, mystery' },
  { id: 'gothic', name: 'Gothic', description: 'Dark, romantic, Victorian' },
  { id: 'eldritch', name: 'Eldritch Horror', description: 'Lovecraftian, unsettling' },
]

// Map for image generation prompts
export const ART_STYLE_PROMPTS: Record<string, string> = {
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
