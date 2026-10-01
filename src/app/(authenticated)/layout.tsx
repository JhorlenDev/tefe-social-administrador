"use client"

import { useState } from "react"
import Sidebar from "@/components/shared/sidebar"
import Header from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import NavigationFeedback from "@/components/shared/navigation-feedback"

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <NavigationFeedback>
      <div className="flex h-screen overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
          <Header collapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((current) => !current)} />
          <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
          <Footer />
        </div>
      </div>
    </NavigationFeedback>
  )
}
