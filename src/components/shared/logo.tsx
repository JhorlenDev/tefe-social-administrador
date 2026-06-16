"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  priority?: boolean
}

export default function Logo({ className, priority }: LogoProps) {
  const { resolvedTheme } = useTheme()
  const src = resolvedTheme === "dark" ? "/logo-tefe-social.png" : "/logo-tefe-social-claro.png"

  return (
    <Image
      src={src}
      alt="Tefé Social"
      width={1084}
      height={622}
      className={cn("h-auto object-contain", className)}
      priority={priority}
    />
  )
}
