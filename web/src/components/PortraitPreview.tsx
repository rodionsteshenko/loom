interface Props {
  imageUrl?: string
  name: string
  onRegenerate: () => void
  isGenerating: boolean
}

export default function PortraitPreview({ imageUrl, name, onRegenerate, isGenerating }: Props) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-900 relative">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={`Portrait of ${name}`}
            className="w-full h-auto max-h-[600px] object-contain"
          />
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <div className="text-6xl mb-2">🖼️</div>
              <p className="text-sm">Portrait generating...</p>
            </div>
          </div>
        )}
        
        {imageUrl && (
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="absolute bottom-3 right-3 px-3 py-2 bg-black/70 hover:bg-black/90 disabled:opacity-50 text-white text-sm rounded-lg backdrop-blur transition-colors flex items-center gap-2"
          >
            🔄 Regenerate
          </button>
        )}
      </div>
    </div>
  )
}
