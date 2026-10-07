"use client"

import { useState } from "react"
import Sidebar from "@/components/shared/sidebar"
import Header from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import NavigationFeedback from "@/components/shared/navigation-feedback"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <NavigationFeedback>
      <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(0,100,224,0.10),transparent_34%),linear-gradient(180deg,rgba(247,248,250,0.96),rgba(241,244,247,0.92))] dark:bg-none">
        <Sidebar collapsed={sidebarCollapsed} />
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "fixed top-5 z-[60] hidden rounded-full border border-border/80 bg-card shadow-md transition-all duration-200 hover:bg-sidebar-accent lg:inline-flex",
            sidebarCollapsed ? "left-[4.25rem]" : "left-[15.25rem]",
          )}
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {sidebarCollapsed ? <ChevronRight className="h-5.5 w-5.5" /> : <ChevronLeft className="h-5.5 w-5.5" />}
        </Button>
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
          <Header />
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <div className="mx-auto max-w-[1440px]">{children}</div>
          </main>
          <Footer />
        </div>
      </div>
    </NavigationFeedback>
  )
}
