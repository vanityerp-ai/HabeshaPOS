"use client"

import type React from "react"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-provider"
import { LocationSelector } from "@/components/location-selector"
import { UserNav } from "@/components/user-nav"
import { AdminModeToggle } from "@/components/admin-mode-toggle"
import { AdminThemeProvider } from "@/components/theme-provider"
import { ProtectedNav } from "@/components/protected-nav"
import { NotificationAudioToggle } from "@/components/notifications/notification-audio-toggle"
import { Notifications } from "@/components/notifications"
import { ChatNotifications } from "@/components/chat/chat-notifications"
import { ChatInterface } from "@/components/chat/chat-interface"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { AppointmentNotificationHandler } from "@/components/notifications/appointment-notification-handler"
import { DashboardLogo } from "@/components/ui/logo"


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, hasPermission } = useAuth()
  const router = useRouter()

  // Memoize the logo component to prevent re-renders
  const logoComponent = useMemo(() => {
    // Admin and Super Admin always get dashboard link
    const roleUpper = user?.role?.toUpperCase()
    if (roleUpper === "ADMIN" || roleUpper === "SUPER_ADMIN") {
      return (
        <DashboardLogo href="/dashboard" className="hidden md:flex" />
      )
    } else if (hasPermission("view_dashboard")) {
      return (
        <DashboardLogo href="/dashboard" className="hidden md:flex" />
      )
    } else {
      return (
        <DashboardLogo className="hidden md:flex" />
      )
    }
  }, [user?.role, hasPermission])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return null
  }

  return (
    <AdminThemeProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 flex h-16 items-center border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-4 md:gap-6">
            {logoComponent}
            <LocationSelector />
          </div>
          <ProtectedNav className="mx-6" />
          <div className="ml-auto flex items-center gap-4">
            <NotificationAudioToggle />
            <Notifications />
            <NotificationCenter />
            <ChatNotifications />
            <AdminModeToggle />
            <UserNav />
          </div>
        </header>
        <div className="flex flex-1">
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>

        {/* Chat Interface */}
        <ChatInterface />

        {/* Appointment Notification Handler */}
        <AppointmentNotificationHandler
          onViewAppointment={(appointmentId) => {
            // Navigate to calendar with appointment highlighted
            window.location.href = `/dashboard/appointments?highlight=${appointmentId}`
          }}
        />
      </div>
    </AdminThemeProvider>
  )
}

