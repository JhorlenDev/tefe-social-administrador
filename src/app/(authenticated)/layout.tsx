"use client"

import { useEffect, useState } from "react"
import Sidebar from "@/components/shared/sidebar"
import Header from "@/components/shared/header"
import Footer from "@/components/shared/footer"
import { warmClientCache } from "@/lib/api"

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    warmClientCache()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} />
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <Header collapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((current) => !current)} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
        <Footer />
      </div>
    </div>
  )
}
