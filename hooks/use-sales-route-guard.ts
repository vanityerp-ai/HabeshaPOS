"use client"

import { useEffect, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"

const DEFAULT_ALLOWED_ROUTES = ["/dashboard/pos", "/dashboard/inventory"] as const

/**
 * Redirects users with the Sales role away from restricted routes.
 * Allowed routes default to POS and Inventory.
 * 
 * This hook enforces strict route access control for specific roles.
 * For the SALES role (Samrawit), only POS and Inventory pages are accessible.
 */
export function useSalesRouteGuard(
  allowedRoutes: readonly string[] = DEFAULT_ALLOWED_ROUTES,
  targetRole: string = "SALES",
  fallbackRoute?: string
) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  // Memoize the allowed route list identifier to keep the effect dependency stable
  const allowedKey = useMemo(() => allowedRoutes.join("|"), [allowedRoutes])
  const normalizedTargetRole = targetRole.toUpperCase()

  // EFFECT-BASED CHECK - runs after render to avoid React errors
  useEffect(() => {
    if (!user) return

    const roleUpper = user.role?.toUpperCase() || ""
    if (roleUpper !== normalizedTargetRole) return

    const allowedRouteList = allowedKey.split("|").filter(Boolean)
    const resolvedFallback = fallbackRoute || allowedRouteList[0] || "/dashboard/pos"

    // Check if current path is allowed
    const isAllowed = allowedRouteList.some((route) => {
      if (!route) return false
      return pathname === route || pathname.startsWith(`${route}/`)
    })

    // Log access attempt for debugging and redirect if not allowed
    if (!isAllowed) {
      console.log(`🚫 Access denied for ${roleUpper} role: ${pathname}`)
      console.log(`✅ Redirecting to: ${resolvedFallback}`)
      router.replace(resolvedFallback)
    } else {
      console.log(`✅ Access granted for ${roleUpper} role: ${pathname}`)
    }
  }, [user, pathname, router, allowedKey, normalizedTargetRole, fallbackRoute])
}

