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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User, Clock, MapPin } from "lucide-react"
import { format, parseISO, addMinutes } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { useApiStaff } from "@/lib/api-staff-service"
import { useServices } from "@/lib/service-provider"
import { Appointment } from "@/lib/types/appointment"
import { updateAppointment } from "@/lib/appointment-service"
import { getFirstName } from "@/lib/female-avatars"

interface ChangeStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Appointment
  onAppointmentUpdated?: (appointment: Appointment) => void
  existingAppointments?: Appointment[]
}

export function ChangeStaffDialog({
  open,
  onOpenChange,
  appointment,
  onAppointmentUpdated,
  existingAppointments = [],
}: ChangeStaffDialogProps) {
  const { toast } = useToast()
  const { currentLocation, user } = useAuth()
  const { staff: realStaff, isLoading: isStaffLoading } = useApiStaff()
  const { services } = useServices()

  const [selectedStaffId, setSelectedStaffId] = useState(appointment.staffId)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset selected staff when appointment changes
  useEffect(() => {
    setSelectedStaffId(appointment.staffId)
  }, [appointment])

  // Get the service details
  const appointmentService = useMemo(() => {
    return services.find(service => 
      service.name === appointment.service || 
      // @ts-ignore - serviceId property exists in actual appointment objects
      service.id === (appointment as any).serviceId
    )
  }, [services, appointment])

  // Filter staff based on current location and service capability
  const availableStaff = useMemo(() => {
    if (!realStaff) return []

    return realStaff.filter(staff => {
      // Only include active staff
      if (staff.status !== "Active") return false

      // Check location access
      if (currentLocation === "all") {
        // Admin can assign any staff
      } else if (currentLocation === "home") {
        // Staff users cannot access home service
        if (user && user.role !== "ADMIN") {
          return false;
        }
        if (!(staff.homeService === true || staff.locations.includes("home"))) {
          return false
        }
      } else {
        if (!staff.locations.includes(currentLocation)) {
          return false
        }
      }

      // Check if staff can perform the service (if specialties are available)
      if (appointmentService && staff.specialties && staff.specialties.length > 0) {
        return staff.specialties.some(specialty =>
          appointmentService.category === specialty ||
          appointmentService.name.toLowerCase().includes(specialty.toLowerCase())
        )
      }

      return true
    })
  }, [realStaff, currentLocation, appointmentService])

  // Check if a staff member has conflicts at the appointment time
  const hasConflict = (staffId: string) => {
    if (staffId === appointment.staffId) return false // Current staff, no conflict

    const appointmentStart = parseISO(appointment.date)
    const appointmentEnd = addMinutes(appointmentStart, appointment.duration)

    return existingAppointments.some(existingAppt => {
      if (existingAppt.id === appointment.id) return false // Skip current appointment
      if (existingAppt.staffId !== staffId) return false // Different staff

      const existingStart = parseISO(existingAppt.date)
      const existingEnd = addMinutes(existingStart, existingAppt.duration)

      // Check for overlap
      return (
        (appointmentStart >= existingStart && appointmentStart < existingEnd) ||
        (appointmentEnd > existingStart && appointmentEnd <= existingEnd) ||
        (appointmentStart <= existingStart && appointmentEnd >= existingEnd)
      )
    })
  }

  const handleSubmit = async () => {
    if (!selectedStaffId) {
      toast({
        variant: "destructive",
        title: "No staff selected",
        description: "Please select a staff member.",
      })
      return
    }

    if (selectedStaffId === appointment.staffId) {
      toast({
        variant: "destructive",
        title: "Same staff member",
        description: "Please select a different staff member.",
      })
      return
    }

    // Check for conflicts
    if (hasConflict(selectedStaffId)) {
      toast({
        variant: "destructive",
        title: "Staff conflict",
        description: "The selected staff member has another appointment at this time. Please choose a different staff member or reschedule the appointment.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const selectedStaff = availableStaff.find(staff => staff.id === selectedStaffId)
      
      const updates = {
        staffId: selectedStaffId,
        staffName: selectedStaff?.name || "Unknown Staff",
      }

      // Update the appointment
      const updatedAppointment = await updateAppointment(appointment.id, updates)

      if (updatedAppointment && onAppointmentUpdated) {
        // @ts-ignore
        onAppointmentUpdated(updatedAppointment)
      }

      toast({
        title: "Staff changed",
        description: `Appointment staff has been changed to ${selectedStaff?.name}.`,
      })

      // Reset selection
      setSelectedStaffId(appointment.staffId)

      onOpenChange(false)
    } catch (error) {
      console.error("Failed to change staff:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to change the staff member. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentStaff = availableStaff.find(staff => staff.id === appointment.staffId)
  const newStaff = availableStaff.find(staff => staff.id === selectedStaffId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change Staff Member</DialogTitle>
          <DialogDescription>
            Assign a different staff member to {appointment.clientName}'s {appointment.service} appointment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Appointment Info */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span>{format(parseISO(appointment.date), "MMMM d, yyyy 'at' h:mm a")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <User className="h-4 w-4" />
              <span>{appointment.service} ({appointment.duration} min)</span>
            </div>
          </div>

          {/* Current Staff */}
          <div className="space-y-2">
            <Label>Current Staff Member</Label>
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-background">
              <Avatar className="h-10 w-10">
                <AvatarImage src={currentStaff?.avatar} />
                <AvatarFallback>
                  {currentStaff?.name?.split(' ').map(n => n[0]).join('') || 'S'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{getFirstName(currentStaff?.name || appointment.staffName)}</div>
                <div className="text-sm text-muted-foreground">
                  {currentStaff?.role || 'Staff Member'}
                </div>
              </div>
            </div>
          </div>

          {/* New Staff Selection */}
          <div className="space-y-2">
            <Label>New Staff Member</Label>
            <Select
              value={selectedStaffId}
              onValueChange={setSelectedStaffId}
              disabled={availableStaff.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  availableStaff.length === 0
                    ? "No staff available"
                    : "Select new staff member"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableStaff.map((staff) => {
                  const conflict = hasConflict(staff.id)
                  const isCurrent = staff.id === appointment.staffId
                  
                  return (
                    <SelectItem
                      key={staff.id}
                      value={staff.id}
                      disabled={conflict}
                      className={conflict ? "text-muted-foreground" : ""}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={staff.avatar} />
                          <AvatarFallback className="text-xs">
                            {staff.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getFirstName(staff.name)}</span>
                            {isCurrent && <Badge variant="secondary" className="text-xs">Current</Badge>}
                            {conflict && <Badge variant="destructive" className="text-xs">Conflict</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{staff.role}</div>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Staff Preview */}
          {newStaff && selectedStaffId !== appointment.staffId && (
            <div className="space-y-2">
              <Label>New Assignment</Label>
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-green-50 border-green-200">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={newStaff.avatar} />
                  <AvatarFallback>
                    {newStaff.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{getFirstName(newStaff.name)}</div>
                  <div className="text-sm text-muted-foreground">
                    {newStaff.role}
                  </div>
                  {newStaff.specialties && newStaff.specialties.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {newStaff.specialties.slice(0, 2).map((specialty, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                      {newStaff.specialties.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{newStaff.specialties.length - 2} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warning for conflicts */}
          {selectedStaffId && hasConflict(selectedStaffId) && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <div className="text-sm text-red-800">
                <strong>Conflict detected:</strong> This staff member has another appointment at the same time. 
                Please choose a different staff member or reschedule the appointment.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              isSubmitting || 
              isStaffLoading || 
              !selectedStaffId || 
              selectedStaffId === appointment.staffId ||
              hasConflict(selectedStaffId)
            }
          >
            {isSubmitting ? "Changing Staff..." : "Change Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
