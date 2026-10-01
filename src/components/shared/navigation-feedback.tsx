"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { usePathname } from "next/navigation"

type NavigationFeedbackContextValue = {
  startNavigation: () => void
}

const NavigationFeedbackContext = createContext<NavigationFeedbackContextValue | null>(null)

export function useNavigationFeedback() {
  const context = useContext(NavigationFeedbackContext)
  if (!context) throw new Error("useNavigationFeedback deve ser usado dentro de NavigationFeedback")
  return context
}

export default function NavigationFeedback({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [navigating, setNavigating] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const stopNavigation = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    setNavigating(false)
    setShowOverlay(false)
  }, [])

  const startNavigation = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    setNavigating(true)
    setShowOverlay(false)
    timeoutRef.current = window.setTimeout(() => setShowOverlay(true), 250)
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(stopNavigation)
    return () => window.cancelAnimationFrame(frameId)
  }, [pathname, stopNavigation])

  useEffect(() => {
    function handleLinkClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest("a[href]")
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return

      const url = new URL(link.href, window.location.href)
      const current = `${window.location.pathname}${window.location.search}`
      if (url.origin === window.location.origin && `${url.pathname}${url.search}` !== current) startNavigation()
    }

    document.addEventListener("click", handleLinkClick, true)
    return () => document.removeEventListener("click", handleLinkClick, true)
  }, [startNavigation])

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
  }, [])

  return (
    <NavigationFeedbackContext.Provider value={{ startNavigation }}>
      {navigating && <div className="fixed inset-x-0 top-0 z-[100] h-1 animate-pulse bg-primary" />}
      {showOverlay && (
        <div className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-background/35 backdrop-blur-[1px]">
          <div aria-live="polite" className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 text-sm font-medium shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Aguarde...
          </div>
        </div>
      )}
      {children}
    </NavigationFeedbackContext.Provider>
  )
}
