"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-provider"
import { NAVIGATION_PERMISSIONS } from "@/lib/permissions"

interface ProtectedNavProps extends React.HTMLAttributes<HTMLElement> {
  items?: {
    href: string
    title: string
  }[]
}

export function ProtectedNav({ className, items, ...props }: ProtectedNavProps) {
  const pathname = usePathname()
  const { user, hasAnyPermission } = useAuth()

  const defaultItems = [
    {
      href: "/dashboard",
      title: "Dashboard",
    },
    {
      href: "/dashboard/appointments",
      title: "Appointments",
    },
    {
      href: "/dashboard/clients",
      title: "Clients",
    },
    {
      href: "/dashboard/services",
      title: "Services",
    },
    {
      href: "/dashboard/staff",
      title: "Staff",
    },
    {
      href: "/dashboard/inventory",
      title: "Inventory",
    },
    {
      href: "/dashboard/orders",
      title: "Orders",
    },
    {
      href: "/dashboard/pos",
      title: "Point of Sale",
    },
    {
      href: "/dashboard/gift-cards-memberships",
      title: "Gift Cards & Memberships",
    },
    {
      href: "/dashboard/accounting",
      title: "Accounting",
    },
    {
      href: "/dashboard/hr",
      title: "HR",
    },
    {
      href: "/dashboard/reports",
      title: "Reports",
    },
    {
      href: "/dashboard/settings",
      title: "Settings",
    },
    {
      href: "/client-portal",
      title: "Client Portal",
    },
  ]

  const navItems = items || defaultItems
  const roleUpper = user?.role?.toUpperCase() || ""
  const isSalesRole = roleUpper === "SALES"
  const isStaffRole = roleUpper === "STAFF"
  const salesAllowedRoutes = new Set(["/dashboard/pos", "/dashboard/inventory"])
  const staffAllowedRoutes = new Set(["/dashboard/appointments", "/dashboard/services"])

  // Filter navigation items based on user permissions
  const filteredNavItems = navItems.filter(item => {
    // Restrict sales users to POS and Inventory only
    if (isSalesRole) {
      return salesAllowedRoutes.has(item.href)
    }

    if (isStaffRole) {
      return staffAllowedRoutes.has(item.href)
    }

    // Hide Clients menu entirely for Staff users
    if (roleUpper === "STAFF" && item.href === "/dashboard/clients") {
      return false
    }

    const requiredPermissions = NAVIGATION_PERMISSIONS[item.href as keyof typeof NAVIGATION_PERMISSIONS]

    // If no permissions are defined for this route, hide it
    if (!requiredPermissions) {
      return false
    }

    // Special case for POS - ensure it's visible for receptionists
    if (item.href === "/dashboard/pos" && roleUpper === "RECEPTIONIST") {
      return true
    }

    // Check if the user has any of the required permissions
    return hasAnyPermission(requiredPermissions)
  })

  return (
    <div className={cn("overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border nav-scroll-container", className)} {...props}>
      <nav className="flex items-center space-x-4 lg:space-x-6 min-w-max">
        {filteredNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary whitespace-nowrap py-3 px-1",
              item.href === "/client-portal" && "text-pink-600 hover:text-pink-700",
              pathname === item.href || pathname.startsWith(`${item.href}/`) ? "text-primary" : "text-muted-foreground",
              item.href === "/client-portal" && pathname !== "/client-portal" && !pathname.startsWith("/client-portal/") && "text-pink-600",
            )}
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </div>
  )
}
