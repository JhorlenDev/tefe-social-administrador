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
  MapPinned,
  Map,
  LogOut,
} from "lucide-react"
import { signOut } from "next-auth/react"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cidadaos", label: "Cidadãos", icon: Users },
  { href: "/beneficios", label: "Benefícios", icon: Gift },
  { href: "/beneficiarios", label: "Beneficiários", icon: BadgeCheck },
  { href: "/localidades", label: "Localidades", icon: Map },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/mapa-de-calor", label: "Mapa de Calor", icon: MapPinned },
]

interface SidebarProps {
  collapsed: boolean
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-50 h-full bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border flex flex-col transition-all duration-200 shadow-[0_12px_28px_rgba(0,0,0,0.08)]",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <div className={cn("flex h-24 items-center border-b border-sidebar-border px-4", collapsed ? "justify-center" : "justify-start")}>
        <div className={cn("flex min-w-0", collapsed ? "items-center justify-center" : "flex-col items-start gap-1.5")}>
          <Logo compact={collapsed} priority />
        {!collapsed && (
            <p className="pl-[3.35rem] text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Administrador
            </p>
        )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-2.5">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
          return (
            <Link key={link.href} href={link.href}>
              <Button
                variant="ghost"
                className={cn(
                  "h-11 w-full gap-3 rounded-xl px-3 text-[0.94rem] font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed ? "justify-center" : "justify-start",
                  isActive && "bg-primary/10 text-primary shadow-none ring-1 ring-primary/15 hover:bg-primary/15 hover:text-primary"
                )}
              >
                <link.icon className="h-6.5 w-6.5" />
                {!collapsed && link.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className={cn("h-11 w-full gap-3 rounded-xl px-3 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed ? "justify-center" : "justify-start")}
          onClick={() => signOut({ redirectTo: "/login" })}
        >
          <LogOut className="h-6.5 w-6.5" />
          {!collapsed && "Sair"}
        </Button>
      </div>
    </aside>
  )
}
