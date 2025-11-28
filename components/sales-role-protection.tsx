"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-provider"
import { AccessDenied } from "@/components/access-denied"

interface SalesRoleProtectionProps {
  children: React.ReactNode
  allowedForSales?: boolean
}

/**
 * Component to protect pages from Sales role access
 * 
 * Usage:
 * - Wrap page content with this component
 * - Set allowedForSales={true} for POS and Inventory pages
 * - Set allowedForSales={false} or omit for all other pages
 * 
 * This ensures Samrawit (SALES role) can only access POS and Inventory pages
 */
export function SalesRoleProtection({ children, allowedForSales = false }: SalesRoleProtectionProps) {
  const { user } = useAuth()
  const router = useRouter()

  const isSalesRole = user?.role?.toUpperCase() === "SALES"

  useEffect(() => {
    // If user is Sales role and page is not allowed, redirect to POS
    if (isSalesRole && !allowedForSales) {
      console.log("🚫 Sales role attempting to access restricted page - redirecting to POS")
      router.replace("/dashboard/pos")
    }
  }, [isSalesRole, allowedForSales, router])

  // If Sales role trying to access restricted page, show access denied
  if (isSalesRole && !allowedForSales) {
    return (
      <AccessDenied
        description="You don't have permission to view this page. As a Sales staff member, you can only access the Point of Sale and Inventory pages."
        backButtonHref="/dashboard/pos"
      />
    )
  }

  return <>{children}</>
}
