"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { format, addMinutes, set } from "date-fns"
import { CalendarIcon, UserCheck, UserPlus } from "lucide-react"
import { ClientSearchDialog } from "@/components/pos/client-search-dialog"
import { useToast } from "@/components/ui/use-toast"
import { useApiStaff } from "@/lib/api-staff-service"
import { useServices } from "@/lib/service-provider"
import { getFirstName } from "@/lib/female-avatars"

// Helper function to check if user has admin privileges
const hasAdminPrivileges = (hasPermissionFn: (permission: string) => boolean) => {
  // Check if user has permission to create appointments outside business hours
  return hasPermissionFn("edit_appointment") || hasPermissionFn("all");
}

interface EnhancedNewAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  onAppointmentCreated?: () => void
}

export function EnhancedNewAppointmentDialog({
  open,
  onOpenChange,
  initialDate = new Date(),
  onAppointmentCreated,
}: EnhancedNewAppointmentDialogProps) {
  const { currentLocation, user, hasPermission } = useAuth()
  const { toast } = useToast()

  // Fetch real staff data from HR system
  const { staff: realStaff, isLoading: isStaffLoading, fetchStaff } = useApiStaff()

  // Use real services from service provider - NO mock data
  const { services: realServices } = useServices()

  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    client: null as any,
    date: initialDate,
    time: "10:00",
    serviceId: "",
    staffId: "",
    notes: "",
  })

  // Fetch staff data when dialog opens
  useEffect(() => {
    if (open && !isStaffLoading && realStaff.length === 0) {
      fetchStaff();
    }
  }, [open, isStaffLoading, realStaff.length, fetchStaff]);

  // Reset form when dialog opens with new initial date
  useEffect(() => {
    if (open) {
      setFormData({
        ...formData,
        date: initialDate,
        time: format(initialDate, "HH:mm"),
      })
    }
  }, [open, initialDate])

  // Filter REAL services based on location - NO mock data
  const filteredServices = realServices.filter(
    (service) => currentLocation === "all" || service.locations.includes(currentLocation),
  )

  const filteredStaff = realStaff.filter(
    (staff) => {
      // First check if staff is active
      if (staff.status !== "Active") return false;

      // For location filtering
      if (currentLocation === "all") return true;

      // For Home service location, include staff with homeService flag OR staff with "home" in their locations
      if (currentLocation === "home") {
        return staff.homeService === true || (staff.locations && staff.locations.includes("home"));
      }

      // For regular locations, check if staff is assigned to that location
      return staff.locations && staff.locations.includes(currentLocation);
    }
  )

  // Debug log to verify we're using REAL data from HR system
  console.log("EnhancedNewAppointmentDialog - Using REAL staff from HR system");
  console.log("EnhancedNewAppointmentDialog - Total Real Staff Count:", realStaff.length);
  console.log("EnhancedNewAppointmentDialog - Filtered Staff for Location:", filteredStaff.length);
  console.log("EnhancedNewAppointmentDialog - Real Services Count:", realServices.length);
  console.log("EnhancedNewAppointmentDialog - Filtered Services for Location:", filteredServices.length);

  // Verify we have real staff data (should be exactly 7 real staff members)
  if (realStaff.length === 0) {
    console.warn("⚠️ EnhancedNewAppointmentDialog - No staff data found! Check HR staff management system.");
  } else if (realStaff.length !== 7) {
    console.warn(`⚠️ EnhancedNewAppointmentDialog - Expected 7 real staff members, found ${realStaff.length}. Check HR system.`);
  } else {
    console.log("✅ EnhancedNewAppointmentDialog - Using correct number of real staff members (7)");
  }

  // Get duration for selected service
  const selectedService = filteredServices.find((service) => service.id === formData.serviceId)

  // Calculate end time based on service duration
  const getEndTime = () => {
    if (!selectedService) return formData.date

    const [hours, minutes] = formData.time.split(":").map(Number)
    const startDateTime = set(formData.date, { hours, minutes })
    return addMinutes(startDateTime, selectedService.duration)
  }

  const handleSelectClient = (client: any) => {
    setFormData({
      ...formData,
      client,
    })
    setIsClientDialogOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.client || !formData.serviceId || !formData.staffId) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill out all required fields.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // In a real app, this would create a new appointment via API
      const [hours, minutes] = formData.time.split(":").map(Number)
      const appointmentDate = set(formData.date, { hours, minutes })
      const endTime = getEndTime()

      console.log({
        clientId: formData.client.id,
        serviceId: formData.serviceId,
        staffId: formData.staffId,
        location: currentLocation,
        startTime: appointmentDate,
        endTime,
        status: "pending",
        notes: formData.notes,
      })

      toast({
        title: "Appointment scheduled",
        description: `Appointment for ${formData.client.name} on ${format(appointmentDate, "MMMM d 'at' h:mm a")} has been created.`,
      })

      if (onAppointmentCreated) {
        onAppointmentCreated()
      }

      setIsSubmitting(false)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to create appointment:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create the appointment. Please try again.",
      })
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Schedule New Appointment</DialogTitle>
              <DialogDescription>Create a new appointment for a client.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Client</Label>
                <div className="col-span-3 flex gap-2">
                  {formData.client ? (
                    <div className="flex-1 flex justify-between items-center p-2 border rounded-md">
                      <div>
                        <p className="font-medium">{formData.client.name}</p>
                        <p className="text-xs text-muted-foreground">{formData.client.email}</p>
                      </div>
                      <Button variant="ghost" size="sm" type="button" onClick={() => setIsClientDialogOpen(true)}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="flex-1 flex gap-2">
                      <Button
                        className="flex-1"
                        type="button"
                        variant="outline"
                        onClick={() => setIsClientDialogOpen(true)}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        Select Existing Client
                      </Button>
                      <Button type="button" variant="outline">
                        <UserPlus className="mr-2 h-4 w-4" />
                        New Client
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="service" className="text-right">
                  Service
                </Label>
                <Select
                  value={formData.serviceId}
                  onValueChange={(value) => {
                    console.log("Enhanced dialog - Service selected:", value);
                    setFormData((prevData) => ({
                      ...prevData,
                      serviceId: value
                    }));
                  }}
                >
                  <SelectTrigger id="service" className="col-span-3">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} ({service.duration} min) - ${service.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="staff" className="text-right">
                  Staff
                </Label>
                <Select
                  value={formData.staffId}
                  onValueChange={(value) => {
                    console.log("Enhanced dialog - Staff selected:", value);
                    setFormData((prevData) => ({
                      ...prevData,
                      staffId: value
                    }));
                  }}
                >
                  <SelectTrigger id="staff" className="col-span-3">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {isStaffLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading staff...
                      </SelectItem>
                    ) : (
                      filteredStaff.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {getFirstName(staff.name)} - {(staff.role || "Staff").replace("_", " ")}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Date</Label>
                <div className="col-span-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={(date) => {
                          if (date) {
                            console.log("Enhanced dialog - Date selected:", date);
                            setFormData((prevData) => ({
                              ...prevData,
                              date
                            }));
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="time" className="text-right">
                  Time
                </Label>
                <Select
                  value={formData.time}
                  onValueChange={(value) => {
                    console.log("Enhanced dialog - Time selected:", value);
                    setFormData((prevData) => ({
                      ...prevData,
                      time: value
                    }));
                  }}>
                  <SelectTrigger id="time" className="col-span-3">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i
                      const isAdmin = hasAdminPrivileges(hasPermission)
                      // Check for both "loc4" and "home" as valid home service locations
                      const isHomeService = currentLocation === "home" || currentLocation === "loc4" || currentLocation === "home"

                      // Debug information
                      console.log("Enhanced dialog - User role:", user?.role);
                      console.log("Enhanced dialog - Is admin:", isAdmin);
                      console.log("Enhanced dialog - Current location:", currentLocation);
                      console.log("Enhanced dialog - Is home service:", isHomeService);

                      // Special case for super_admin - always allow all hours
                      if (user?.role === "ADMIN") {
                        console.log("Enhanced dialog - Super admin detected - allowing all hours");
                        return [
                          <SelectItem key={`${hour}:00`} value={`${hour.toString().padStart(2, "0")}:00`}>
                            {hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
                          </SelectItem>,
                          <SelectItem key={`${hour}:30`} value={`${hour.toString().padStart(2, "0")}:30`}>
                            {hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:30 {hour >= 12 ? "PM" : "AM"}
                          </SelectItem>,
                        ];
                      }

                      // For other admins creating home service appointments, allow all hours
                      if (isAdmin && isHomeService) {
                        return [
                          <SelectItem key={`${hour}:00`} value={`${hour.toString().padStart(2, "0")}:00`}>
                            {hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
                          </SelectItem>,
                          <SelectItem key={`${hour}:30`} value={`${hour.toString().padStart(2, "0")}:30`}>
                            {hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:30 {hour >= 12 ? "PM" : "AM"}
                          </SelectItem>,
                        ]
                      }
                      // For regular users or non-home service, enforce business hours (9 AM to 7 PM)
                      else if (hour >= 9 && hour <= 19) {
                        return [
                          <SelectItem key={`${hour}:00`} value={`${hour.toString().padStart(2, "0")}:00`}>
                            {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
                          </SelectItem>,
                          <SelectItem key={`${hour}:30`} value={`${hour.toString().padStart(2, "0")}:30`}>
                            {hour > 12 ? hour - 12 : hour}:30 {hour >= 12 ? "PM" : "AM"}
                          </SelectItem>,
                        ]
                      }
                      return null
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedService && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Duration</Label>
                  <div className="col-span-3">
                    <p className="text-sm">{selectedService.duration} minutes</p>
                    <p className="text-xs text-muted-foreground">Ends at {format(getEndTime(), "h:mm a")}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    console.log("Enhanced dialog - Notes changed:", newValue);
                    setFormData((prevData) => ({
                      ...prevData,
                      notes: newValue
                    }));
                  }}
                  placeholder="Any special requests or notes"
                  className="col-span-3"
                  rows={3}
                />
              </div>

              {/* Show warning for admins booking outside business hours */}
              {(hasPermission("all") || (hasAdminPrivileges(hasPermission) && (currentLocation === "home" || currentLocation === "loc4" || currentLocation === "all"))) && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="col-span-4 text-xs bg-blue-50 p-2 rounded border border-blue-200">
                    <strong>Admin Notice:</strong> As a {user?.role?.replace("_", " ")}, you can create appointments outside of regular business hours{user?.role === "ADMIN" ? "" : " for home service"}.
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Scheduling..." : "Schedule Appointment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ClientSearchDialog
        open={isClientDialogOpen}
        onOpenChange={setIsClientDialogOpen}
        onSelectClient={handleSelectClient}
      />
    </>
  )
}

