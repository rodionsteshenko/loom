import { Link } from 'react-router-dom'

interface Props {
  children: React.ReactNode
}

export default function PageHeader({ children }: Props) {
  return (
    <header className="border-b border-gray-800 bg-black/40 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-purple-400 hover:text-purple-300 font-bold text-sm tracking-wide">
            Loom
          </Link>
          <div className="h-4 w-px bg-gray-700" />
          {children}
        </div>
      </div>
    </header>
  )
}
