import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  priority?: boolean
  compact?: boolean
}

export default function Logo({ className, compact }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="Tefé Social">
      <div className="relative flex h-11 w-11 shrink-0 rotate-[-82deg] items-center justify-center overflow-hidden rounded-2xl bg-primary text-lg font-black tracking-[-0.08em] text-white shadow-sm ring-1 ring-primary/20">
        <span className="absolute left-0 top-0 h-4 w-5 rounded-br-2xl bg-yellow-400" />
        <span className="absolute bottom-0 right-0 h-4 w-5 rounded-tl-2xl bg-green-500" />
        <svg viewBox="0 0 54 54" className="relative h-8 w-8 drop-shadow-sm" aria-hidden="true">
          <path
            d="M 49 16.28 L 48.12 16.03 L 46.81 15.07 L 45.67 14.25 L 44.7 13.74 L 43.35 12.63 L 42.17 10.56 L 40.68 9.98 L 39.86 9.6 L 38.28 10.3 L 37.27 11.33 L 36.55 12.04 L 35.69 13.04 L 35.06 14.5 L 34.71 15.54 L 34.47 16.63 L 34.62 17.5 L 33.36 17.91 L 32.35 19.37 L 31.08 20.06 L 29.59 20.55 L 28.82 21.11 L 27.63 21.56 L 26.62 22.17 L 24.82 22.87 L 23.28 24.03 L 22.1 24.54 L 21.14 25.2 L 18.86 26.84 L 17.48 27.2 L 16.57 28.23 L 16.73 30.45 L 15.9 32.41 L 14.25 33.31 L 13.43 33.83 L 12.6 34.63 L 11.74 35.18 L 10.59 37.04 L 8.9 36.77 L 8.09 37.2 L 7.77 38.23 L 7.04 38.86 L 5.97 39.92 L 5.61 40.77 L 5 41.87 L 6.06 42.78 L 6.76 43.81 L 7.85 44.22 L 8.92 44.2 L 10.2 43.31 L 11.2 41.89 L 11.91 42.67 L 13.26 42.47 L 14.42 41.71 L 15.69 41.33 L 18.48 41.67 L 19.79 42.24 L 21.27 42.55 L 21.44 41.65 L 21.99 40.83 L 23.25 40.57 L 24.45 40.63 L 24.31 38.79 L 25.07 37.97 L 24.34 37.52 L 24.52 36.6 L 25.48 36.28 L 26.27 35.08 L 26.21 34.17 L 27.09 33.13 L 27.9 32.32 L 28.15 31.07 L 29.13 30.67 L 30.09 30.2 L 31.02 30.16 L 33.06 28.6 L 33.53 27.66 L 34.65 27.03 L 34.87 25.47 L 35.75 25.28 L 36.59 25.05 L 37.73 24.81 L 38.3 23.89 L 39.2 22.92 L 40.08 22.71 L 40.82 21.75 L 41.52 20.61 L 43.43 20.57 L 44.32 20.26 L 45.71 19.95 L 46.28 19.06 L 47.56 18.72 L 48.4 17.12 Z"
            fill="white"
            stroke="white"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {!compact && (
        <p className="whitespace-nowrap text-[1.25rem] font-extrabold tracking-tight text-foreground">
          Tefé <span className="text-primary">Social</span>
        </p>
      )}
    </div>
  )
}
