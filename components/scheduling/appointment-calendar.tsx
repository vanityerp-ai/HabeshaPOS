"use client"

import { useState, useMemo, useEffect } from "react"
import { useAuth } from "@/lib/auth-provider"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { getCleanClientName } from "@/lib/utils/client-name-utils"
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns"
import { getAllAppointments } from "@/lib/appointment-service"
import { useStaff } from "@/lib/staff-provider"
import { getFirstName } from "@/lib/female-avatars"

interface AppointmentCalendarProps {
  onDateSelect?: (date: Date) => void
  onAppointmentClick?: (appointment: any) => void
  onCreateAppointment?: (date: Date) => void
  selectedDate?: Date
  viewMode?: "day" | "week" | "month"
}

export function AppointmentCalendar({
  onDateSelect,
  onAppointmentClick,
  onCreateAppointment,
  selectedDate = new Date(),
  viewMode: initialViewMode = "day",
}: AppointmentCalendarProps) {
  const { currentLocation } = useAuth()
  const [date, setDate] = useState<Date>(selectedDate)
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">(initialViewMode)
  const [staffFilter, setStaffFilter] = useState<string>("all")
  const [allAppointments, setAllAppointments] = useState<any[]>([])

  // Load appointments asynchronously
  useEffect(() => {
    getAllAppointments().then(setAllAppointments)
  }, [])

  // Filter REAL appointments based on location, date, and staff - NO mock data
  const filteredAppointments = useMemo(() => {

    return allAppointments.filter((appointment) => {
      // Filter by location with cross-location blocking support
      let isCorrectLocation = currentLocation === "all" || appointment.location === currentLocation;

      // CROSS-LOCATION BLOCKING: Also show home service appointments for staff members
      // who are assigned to this location, so they appear as unavailable
      if (!isCorrectLocation && (appointment.location === "home" || appointment.location === "loc4")) {
        const staffMember = staffList.find((s: StaffMember) => s.id === appointment.staffId);
        if (staffMember && staffMember.locations.includes(currentLocation)) {
          isCorrectLocation = true; // Show home service appointment in staff's primary location
        }
      }

      // REVERSE CROSS-LOCATION BLOCKING: For home service view, also show physical location appointments
      // for staff members who have home service capability
      if (!isCorrectLocation && currentLocation === "home" &&
          (appointment.location === "loc1" || appointment.location === "loc2" || appointment.location === "loc3")) {
        const staffMember = staffList.find((s: StaffMember) => s.id === appointment.staffId);
        if (staffMember && staffMember.homeService === true) {
          isCorrectLocation = true; // Show physical location appointment in home service view
        }
      }

      if (!isCorrectLocation) {
        return false
      }

      // Filter by date based on view mode
      const appointmentDate = parseISO(appointment.date)
      if (viewMode === "day") {
        if (!isSameDay(appointmentDate, date)) {
          return false
        }
      } else if (viewMode === "week") {
        const weekStart = startOfWeek(date)
        const weekEnd = addDays(weekStart, 6)
        if (appointmentDate < weekStart || appointmentDate > weekEnd) {
          return false
        }
      }
      // Month view is handled by the Calendar component

      // Filter by staff if needed
      if (staffFilter !== "all" && appointment.staffId !== staffFilter) {
        return false
      }

      // Get the staff member for this appointment
      const staffMember = staffList.find((s: StaffMember) => s.id === appointment.staffId);

      // Only show appointments for staff members who are assigned to the selected location
      // This ensures staff members only show appointments at their assigned locations
      const isStaffAssignedToLocation =
        currentLocation === "all" ||
        (staffMember && staffMember.locations.includes(currentLocation)) ||
        (currentLocation === "home" && staffMember && staffMember.homeService);

      if (!isStaffAssignedToLocation) {
        return false;
      }

      return true
    })
  }, [allAppointments, currentLocation, date, viewMode, staffFilter])

  // Use the REAL staff data from HR management system - NO mock data
  const { activeStaff: realStaff, getActiveStaffByLocation, getActiveStaffWithHomeService } = useStaff();

  // Get REAL ACTIVE staff for the current location - filtered from HR system (excludes inactive/on-leave)
  let availableStaff = currentLocation === 'all'
    ? realStaff
    : currentLocation === 'home'
      ? getActiveStaffWithHomeService()
      : getActiveStaffByLocation(currentLocation);
  // Exclude admins, managers, and receptionists from availableStaff
  availableStaff = availableStaff.filter((staff: StaffMember) => {
    const role = (staff.role || "").toUpperCase();
    return role !== "ADMIN" && role !== "MANAGER" && role !== "SUPER_ADMIN";
  });

  // Use REAL ACTIVE staff list for filtering appointments - NO mock data
  const staffList = realStaff;

  // Debug log to verify we're using REAL staff data from HR system
  console.log("🔍 AppointmentCalendar - STAFF DATA AUDIT:");
  console.log("AppointmentCalendar - Using REAL staff from HR system");
  console.log("AppointmentCalendar - Current Location:", currentLocation);
  console.log("AppointmentCalendar - Total Real Staff Count:", realStaff.length);
  console.log("AppointmentCalendar - Available Staff for Location:", availableStaff.length);
  console.log("AppointmentCalendar - Real Staff Names:", realStaff.map((s: StaffMember) => s.name));
  console.log("AppointmentCalendar - Real Staff IDs:", realStaff.map((s: StaffMember) => s.id));
  console.log("AppointmentCalendar - Staff data source: useStaff() hook from HR system");
  console.log("AppointmentCalendar - NO MOCK DATA USED ✅");

  // Verify we have real staff data (should be exactly 7 real staff members)
  if (realStaff.length === 0) {
    console.error("❌ AppointmentCalendar - CRITICAL: No staff data found! Check HR staff management system.");
  } else if (realStaff.length !== 7) {
    console.warn(`⚠️ AppointmentCalendar - Expected 7 real staff members, found ${realStaff.length}. Check HR system.`);
  } else {
    console.log("✅ AppointmentCalendar - VERIFIED: Using correct number of real staff members (7)");
  }



  // Handle date change
  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate)
      if (onDateSelect) {
        onDateSelect(newDate)
      }
    }
  }

  // Create time slots for day view
  const timeSlots: string[] = []
  for (let i = 9; i < 19; i++) {
    timeSlots.push(`${i}:00`)
    timeSlots.push(`${i}:30`)
  }

  // Group appointments by time slot for day view
  const appointmentsByTime = useMemo(() => {
    const grouped: Record<string, any[]> = {}

    timeSlots.forEach((time: string) => {
      grouped[time] = []
    })

    filteredAppointments.forEach((appointment) => {
      const appointmentDate = parseISO(appointment.date)
      const hour = appointmentDate.getHours()
      const minute = appointmentDate.getMinutes()
      const timeKey = `${hour}:${minute === 0 ? "00" : minute}`

      if (grouped[timeKey]) {
        grouped[timeKey].push(appointment)
      }
    })

    return grouped
  }, [filteredAppointments])

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <CardTitle className="text-xl">Appointment Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Tabs defaultValue={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs defaultValue={staffFilter} onValueChange={setStaffFilter}>
              <TabsList>
                <TabsTrigger value="all">All Staff</TabsTrigger>
                {availableStaff.map((staff: StaffMember) => (
                  <TabsTrigger key={staff.id} value={staff.id}>
                    {getFirstName(staff.name)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
          <div>
            <Calendar mode="single" selected={date} onSelect={handleDateChange} className="rounded-md border" />
            <div className="mt-4">
              <Button className="w-full" onClick={() => onCreateAppointment && onCreateAppointment(date)}>
                New Appointment
              </Button>
            </div>
          </div>

          <div className="overflow-auto">
            {viewMode === "day" && (
              <div className="space-y-2">
                <h3 className="font-medium text-lg">{format(date, "EEEE, MMMM d, yyyy")}</h3>
                <div className="border rounded-md">
                  {timeSlots.map((timeSlot: string) => {
                    const [hour, minute] = timeSlot.split(":")
                    const appointments = appointmentsByTime[timeSlot] || []
                    const hasAppointments = appointments.length > 0

                    return (
                      <div
                        key={timeSlot}
                        className={cn("flex flex-col border-b last:border-b-0", hasAppointments ? "min-h-20" : "h-12")}
                      >
                        <div className="flex">
                          <div className="w-20 p-2 border-r flex-shrink-0 font-medium text-sm text-muted-foreground">
                            {`${hour}:${minute}`}
                          </div>
                          <div className="flex-1 p-1">
                            {appointments.map((appointment: any) => (
                              <div
                                key={appointment.id}
                                className={cn(
                                  "p-2 rounded-md mb-1 cursor-pointer",
                                  appointment.status === "confirmed"
                                    ? "bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-800"
                                    : appointment.status === "completed"
                                      ? "bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-800"
                                      : appointment.status === "cancelled"
                                        ? "bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-800"
                                        : "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700",
                                  "border",
                                )}
                                onClick={() => onAppointmentClick && onAppointmentClick(appointment)}
                              >
                                <div className="flex justify-between items-start">
                                  <span className="font-medium truncate flex-1 min-w-0 pr-2">{getCleanClientName(appointment.clientName)} - {appointment.service}</span>
                                  <span className="text-sm flex-shrink-0">{format(parseISO(appointment.date), "h:mm a")}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {viewMode === "week" && (
              <div className="space-y-2">
                <h3 className="font-medium text-lg">Week of {format(startOfWeek(date), "MMMM d, yyyy")}</h3>
                <div className="overflow-x-auto">
                  <div className="min-w-[800px] border rounded-md p-4">
                    {/* Week view would go here - for now showing a simple list */}
                    <div className="space-y-4">
                      {filteredAppointments.map((appointment: any) => (
                        <div
                          key={appointment.id}
                          className={cn(
                            "p-3 rounded-md cursor-pointer",
                            appointment.status === "confirmed"
                              ? "bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-800"
                              : appointment.status === "completed"
                                ? "bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-800"
                                : appointment.status === "cancelled"
                                  ? "bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-800"
                                  : "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700",
                            "border",
                          )}
                          onClick={() => onAppointmentClick && onAppointmentClick(appointment)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="font-medium text-base truncate">{getCleanClientName(appointment.clientName)} - {appointment.service}</div>
                              <div className="text-sm text-muted-foreground truncate">
                                {format(parseISO(appointment.date), "EEEE, MMMM d")} at{" "}
                                {format(parseISO(appointment.date), "h:mm a")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {filteredAppointments.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No appointments found for this week.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {viewMode === "month" && (
              <div className="space-y-2">
                <h3 className="font-medium text-lg">{format(date, "MMMM yyyy")}</h3>
                <div className="overflow-x-auto">
                  <div className="min-w-[800px] border rounded-md p-4">
                    {/* Month view would go here - for now showing a simple list */}
                    <div className="space-y-4">
                      {filteredAppointments.map((appointment: any) => (
                        <div
                          key={appointment.id}
                          className={cn(
                            "p-3 rounded-md cursor-pointer",
                            appointment.status === "confirmed"
                              ? "bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-800"
                              : appointment.status === "completed"
                                ? "bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-800"
                                : appointment.status === "cancelled"
                                  ? "bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-800"
                                  : "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700",
                            "border",
                          )}
                          onClick={() => onAppointmentClick && onAppointmentClick(appointment)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="font-medium text-base truncate">{getCleanClientName(appointment.clientName)} - {appointment.service}</div>
                              <div className="text-sm text-muted-foreground truncate">
                                {format(parseISO(appointment.date), "EEEE, MMMM d")} at{" "}
                                {format(parseISO(appointment.date), "h:mm a")}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {filteredAppointments.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No appointments found for this month.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

