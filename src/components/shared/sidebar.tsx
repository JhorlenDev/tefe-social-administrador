"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Logo from "@/components/shared/logo"
import {
  LayoutDashboard,
  Users,
  Gift,
  BadgeCheck,
  FileText,
  LogOut,
} from "lucide-react"
import { signOut } from "next-auth/react"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cidadaos", label: "Cidadãos", icon: Users },
  { href: "/beneficios", label: "Benefícios", icon: Gift },
  { href: "/beneficiarios", label: "Beneficiários", icon: BadgeCheck },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  // Temporariamente desativado:
  // { href: "/mapa-de-calor", label: "Mapa de Calor", icon: MapPinned },
]

interface SidebarProps {
  collapsed: boolean
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-50 h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 h-16 border-b border-sidebar-border", collapsed ? "justify-center" : "justify-start")}> 
        <Logo className={collapsed ? "w-9" : "w-24"} priority />
        {!collapsed && (
          <div>
            <p className="text-xs text-muted-foreground">Administrador</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
          return (
            <Link key={link.href} href={link.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full gap-3 font-normal",
                  collapsed ? "justify-center" : "justify-start",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                )}
              >
                <link.icon className="w-5 h-5" />
                {!collapsed && link.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className={cn("w-full gap-3 text-muted-foreground", collapsed ? "justify-center" : "justify-start")}
          onClick={() => signOut({ redirectTo: "/login" })}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && "Sair"}
        </Button>
      </div>
    </aside>
  )
}
