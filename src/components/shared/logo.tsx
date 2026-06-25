"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  priority?: boolean
}

export default function Logo({ className, priority }: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Antes de montar (SSR + 1º render do cliente) usa sempre o logo escuro,
  // evitando mismatch de hidratação. A troca para o claro ocorre após montar.
  const isDark = mounted && resolvedTheme === "dark"
  const src = mounted && resolvedTheme !== "dark" ? "/logo-tefe-social-claro.png" : "/logo-tefe-social.png"

  return (
    <Image
      src={src}
      alt="Tefé Social"
      width={1084}
      height={622}
      className={cn(
        "h-auto object-contain",
        // No tema escuro a logo é exibida um pouco menor.
        isDark && "scale-90 origin-left",
        className,
      )}
      priority={priority}
    />
  )
}
