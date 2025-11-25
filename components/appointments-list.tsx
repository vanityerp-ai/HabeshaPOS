"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getAllAppointments } from "@/lib/appointment-service"
import { getCleanClientName } from "@/lib/utils/client-name-utils"

interface AppointmentsListProps {
  date?: Date
  onlyMine?: boolean
}

export function AppointmentsList({ date, onlyMine = false }: AppointmentsListProps) {
  const { user, currentLocation } = useAuth()
  const [allAppointments, setAllAppointments] = useState<any[]>([])

  // Load appointments asynchronously
  useEffect(() => {
    getAllAppointments().then(setAllAppointments)
  }, [])

  // Filter REAL appointments based on location, date, and staff
  const filteredAppointments = allAppointments.filter((appointment) => {
    // Exclude reflected appointments from the appointments list
    if (appointment.isReflected) {
      return false
    }

    // Filter by location with cross-location blocking support
    let isCorrectLocation = currentLocation === "all" || appointment.location === currentLocation;

    // CROSS-LOCATION BLOCKING: Also show home service appointments for staff members
    // who are assigned to this location, so they appear as unavailable
    if (!isCorrectLocation && appointment.location === "home") {
      // Note: We would need staff data here to implement this properly
      // For now, we'll keep the simple location filtering for the list view
      // The calendar views handle the cross-location display
    }

    if (!isCorrectLocation) {
      return false
    }

    // Filter by date if provided
    if (date) {
      const appointmentDate = new Date(appointment.date)
      if (
        appointmentDate.getDate() !== date.getDate() ||
        appointmentDate.getMonth() !== date.getMonth() ||
        appointmentDate.getFullYear() !== date.getFullYear()
      ) {
        return false
      }
    }

    // Filter by staff if onlyMine is true
    if (onlyMine && appointment.staffId !== user?.id) {
      return false
    }

    return true
  })

  if (filteredAppointments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">No appointments found</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {filteredAppointments.map((appointment) => (
        <Card key={appointment.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {appointment.clientName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{getCleanClientName(appointment.clientName)} - {appointment.service}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {new Date(appointment.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    appointment.status === "confirmed"
                      ? "default"
                      : appointment.status === "completed"
                        ? "success"
                        : appointment.status === "cancelled"
                          ? "destructive"
                          : "outline"
                  }
                >
                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </Badge>
                <Button variant="ghost" size="sm">
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

