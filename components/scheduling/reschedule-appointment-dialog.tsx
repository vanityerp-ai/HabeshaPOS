"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Clock } from "lucide-react"
import { set, isBefore, startOfDay, addMinutes, parseISO } from "date-fns"
import { formatAppDate, formatAppTime, isToday } from "@/lib/date-utils"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { useApiStaff } from "@/lib/api-staff-service"
import { Appointment } from "@/lib/types/appointment"
import { updateAppointment } from "@/lib/appointment-service"
import { getFirstName } from "@/lib/female-avatars"

interface RescheduleAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Appointment
  onAppointmentUpdated?: (appointment: Appointment) => void
  existingAppointments?: Appointment[]
}

export function RescheduleAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onAppointmentUpdated,
  existingAppointments = [],
}: RescheduleAppointmentDialogProps) {
  const { toast } = useToast()
  const { currentLocation } = useAuth()
  const { staff: realStaff, isLoading: isStaffLoading } = useApiStaff()

  const [formData, setFormData] = useState({
    date: new Date(),
    time: "10:00",
    staffId: appointment.staffId,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize form data when appointment changes
  useEffect(() => {
    if (appointment) {
      const appointmentDate = parseISO(appointment.date)
      setFormData({
        date: appointmentDate,
        time: formatAppTime(appointmentDate),
        staffId: appointment.staffId,
      })
    }
  }, [appointment])

  // Filter staff based on current location and active status
  const availableStaff = useMemo(() => {
    if (!realStaff) return []

    return realStaff.filter(staff => {
      // Only include active staff
      if (staff.status !== "Active") return false

      if (currentLocation === "all") return true
      if (currentLocation === "home") {
        return staff.homeService === true || staff.locations.includes("home")
      }
      return staff.locations.includes(currentLocation)
    })
  }, [realStaff, currentLocation])

  // Generate time slots (9 AM to 6 PM, 30-minute intervals)
  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = 9; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 18 && minute > 0) break // Stop at 6:00 PM
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
        slots.push(timeString)
      }
    }
    return slots
  }, [])

  // Check if a time slot conflicts with existing appointments
  const isTimeSlotConflicted = (date: Date, time: string, staffId: string) => {
    const [hours, minutes] = time.split(":").map(Number)
    const proposedStart = set(date, { hours, minutes })
    const proposedEnd = addMinutes(proposedStart, appointment.duration)

    return existingAppointments.some(existingAppt => {
      // Skip the current appointment being rescheduled
      if (existingAppt.id === appointment.id) return false
      
      // Only check conflicts for the same staff member
      if (existingAppt.staffId !== staffId) return false

      const existingStart = parseISO(existingAppt.date)
      const existingEnd = addMinutes(existingStart, existingAppt.duration)

      // Check for overlap
      return (
        (proposedStart >= existingStart && proposedStart < existingEnd) ||
        (proposedEnd > existingStart && proposedEnd <= existingEnd) ||
        (proposedStart <= existingStart && proposedEnd >= existingEnd)
      )
    })
  }

  const handleSubmit = async () => {
    if (!formData.staffId) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a staff member.",
      })
      return
    }

    // Create appointment date by combining date and time
    const [hours, minutes] = formData.time.split(":").map(Number)
    const appointmentDate = set(formData.date, { hours, minutes })

    // Validate that appointment time is in the future
    const now = new Date()
    if (isBefore(appointmentDate, now)) {
      toast({
        variant: "destructive",
        title: "Invalid appointment time",
        description: "Appointments cannot be scheduled in the past. Please select a future time.",
      })
      return
    }

    // Check for conflicts
    if (isTimeSlotConflicted(formData.date, formData.time, formData.staffId)) {
      toast({
        variant: "destructive",
        title: "Time slot conflict",
        description: "The selected time slot conflicts with another appointment. Please choose a different time.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const selectedStaff = availableStaff.find(staff => staff.id === formData.staffId)
      
      const updates = {
        date: appointmentDate.toISOString(),
        staffId: formData.staffId,
        staffName: selectedStaff?.name || appointment.staffName,
      }

      // Update the appointment
      const updatedAppointment = await updateAppointment(appointment.id, updates)

      if (updatedAppointment && onAppointmentUpdated) {
        // @ts-ignore
        onAppointmentUpdated(updatedAppointment)
      }

      toast({
        title: "Appointment rescheduled",
        description: `Appointment has been rescheduled to ${formatAppDate(appointmentDate)} at ${formatAppTime(appointmentDate)}.`,
      })

      // Reset form data
      setFormData({
        date: new Date(),
        time: "10:00",
        staffId: appointment.staffId,
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Failed to reschedule appointment:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reschedule the appointment. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedStaff = availableStaff.find(staff => staff.id === formData.staffId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            Change the date and time for {appointment.clientName}'s {appointment.service} appointment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>New Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? formatAppDate(formData.date) : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                  disabled={(date) => isBefore(date, startOfDay(new Date()))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label>New Time</Label>
            <Select
              value={formData.time}
              onValueChange={(value) => setFormData(prev => ({ ...prev, time: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((time) => {
                  const isConflicted = isTimeSlotConflicted(formData.date, time, formData.staffId)
                  return (
                    <SelectItem
                      key={time}
                      value={time}
                      disabled={isConflicted}
                      className={isConflicted ? "text-muted-foreground" : ""}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{formatAppTime(set(new Date(), { hours: parseInt(time.split(":")[0]), minutes: parseInt(time.split(":")[1]) }))}</span>
                        {isConflicted && <span className="text-xs text-red-500 ml-2">Conflict</span>}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Staff Selection */}
          <div className="space-y-2">
            <Label>Staff Member</Label>
            <Select
              value={formData.staffId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, staffId: value }))}
              disabled={availableStaff.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  availableStaff.length === 0
                    ? "No staff available"
                    : "Select staff member"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableStaff.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {getFirstName(staff.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current vs New Appointment Info */}
          <div className="bg-muted p-3 rounded-lg space-y-2">
            <div className="text-sm">
              <div className="font-medium">Current:</div>
              <div className="text-muted-foreground">
                {formatAppDate(appointment.date)} at {formatAppTime(appointment.date)} with {getFirstName(appointment.staffName)}
              </div>
            </div>
            <div className="text-sm">
              <div className="font-medium">New:</div>
              <div className="text-muted-foreground">
                {formatAppDate(formData.date)} at {formatAppTime(set(formData.date, {
                  hours: parseInt(formData.time.split(":")[0]),
                  minutes: parseInt(formData.time.split(":")[1])
                }))} with {getFirstName(selectedStaff?.name || "Select staff")}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isStaffLoading}>
            {isSubmitting ? "Rescheduling..." : "Reschedule Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
