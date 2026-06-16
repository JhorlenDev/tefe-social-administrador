"use client"

import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

interface HeaderProps {
  collapsed: boolean
  onToggleSidebar: () => void
}

export default function Header({ collapsed, onToggleSidebar }: HeaderProps) {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "AD"

  return (
    <header className="h-16 border-b flex items-center justify-between px-4 lg:px-6 bg-background">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <Sun className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {session?.user?.name || "Admin"}
          </span>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
