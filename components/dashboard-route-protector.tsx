"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"

/**
 * Dashboard Route Protector
 * 
 * This component provides an additional layer of route protection
 * specifically for SALES role users (like Samrawit).
 * 
 * It ensures SALES role can ONLY access:
 * - /dashboard/pos
 * - /dashboard/inventory
 * 
 * All other routes are blocked with immediate redirect.
 */
export function DashboardRouteProtector({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!user) return

    const roleUpper = user.role?.toUpperCase()
    
    // Only apply protection to SALES role
    if (roleUpper !== "SALES") return

    // Define allowed routes for SALES role
    const allowedRoutes = ["/dashboard/pos", "/dashboard/inventory"]
    
    // Check if current route is allowed
    const isAllowed = allowedRoutes.some(route => 
      pathname === route || pathname.startsWith(`${route}/`)
    )

    // If not allowed, redirect to POS immediately
    if (!isAllowed) {
      console.log(`🛡️ DASHBOARD PROTECTOR - Blocking SALES role from: ${pathname}`)
      console.log(`🔄 Redirecting to: /dashboard/pos`)
      router.replace("/dashboard/pos")
    }
  }, [user, pathname, router])

  return <>{children}</>
}
