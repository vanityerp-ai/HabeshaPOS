"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useServices } from "@/lib/service-provider"
import { useApiStaff } from "@/lib/api-staff-service"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { parseISO, addMinutes, isWithinInterval } from "date-fns"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { useCurrency } from "@/lib/currency-provider"

interface AddServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  onServiceAdded: (bookingId: string, service: any) => void
  currentBooking?: any
}

export function AddServiceDialog({ open, onOpenChange, bookingId, onServiceAdded, currentBooking: propCurrentBooking }: AddServiceDialogProps) {
  const { toast } = useToast()
  const { currency } = useCurrency()

  // Get real services and categories
  const { services, categories } = useServices()

  // Fetch real staff data from HR system
  const { staff: realStaff, isLoading: isStaffLoading, fetchStaff } = useApiStaff()

  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedService, setSelectedService] = useState("")
  const [selectedStaff, setSelectedStaff] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [unavailableStaff, setUnavailableStaff] = useState<string[]>([])
  const [currentBooking, setCurrentBooking] = useState<any>(null)
  const [staffWarning, setStaffWarning] = useState<string | null>(null)

  // Fetch staff data when dialog opens
  useEffect(() => {
    if (open && !isStaffLoading && realStaff.length === 0) {
      fetchStaff();
    }
  }, [open, isStaffLoading, realStaff.length, fetchStaff]);

  // Get the current booking details when the dialog opens
  useEffect(() => {
    // Reset state when dialog opens or closes
    setSelectedCategory("")
    setSelectedService("")
    setSelectedStaff("")
    setStaffWarning(null)

    if (open && bookingId) {
      if (propCurrentBooking) {
        // Use the booking passed from props
        setCurrentBooking(propCurrentBooking)
      } else {
        // Fallback to mock data if no booking is passed
        const booking = mockAppointments.find(a => a.id === bookingId)
        if (booking) {
          setCurrentBooking(booking)
        }
      }
    }
  }, [open, bookingId, propCurrentBooking])

  // Check if a staff member is already booked for this time slot
  const isStaffAvailable = (staffId: string, booking: any) => {
    if (!booking) return true

    // Get the appointment time range
    const appointmentDate = parseISO(booking.date)
    const appointmentEndTime = addMinutes(appointmentDate, booking.duration)

    // STRICT RULE: Check if this staff is already assigned to any service in this booking
    // If staff is the main service provider, they are not available for the entire duration
    // UNLESS they have completed their service
    if (booking.staffId === staffId) {
      // If the staff has completed their service, they are available
      if (booking.staffServiceCompleted) {
        return true
      }
      return false // Main service staff is not available if they haven't completed their service
    }

    // STRICT RULE: Check additional services for this staff
    // If staff is assigned to any additional service, they are not available for the entire duration
    // UNLESS they have completed their service
    if (booking.additionalServices && booking.additionalServices.length > 0) {
      const assignedService = booking.additionalServices.find((service: any) => service.staffId === staffId)
      if (assignedService) {
        // If the staff has completed their service, they are available
        if (assignedService.completed) {
          return true
        }
        return false // Staff is not available if they haven't completed their service
      }
    }

    // Check other appointments for this staff at the same time
    // Get real appointments from localStorage
    const allAppointments = (() => {
      try {
        const storedAppointments = typeof window !== 'undefined' ? localStorage.getItem('vanity_appointments') : null;
        return storedAppointments ? JSON.parse(storedAppointments) : [];
      } catch (error) {
        console.error('Error loading appointments:', error);
        return [];
      }
    })();

    return !allAppointments.some((appointment: any) => {
      // Skip the current booking
      if (appointment.id === booking.id) return false

      // IMPORTANT: Skip completed appointments - they don't block staff availability
      if (appointment.status === "completed") {
        return false;
      }

      // IMPORTANT: Skip cancelled and no-show appointments - they don't block staff availability
      if (appointment.status === "cancelled" || appointment.status === "no-show") {
        return false;
      }

      // STRICT RULE: Check if staff is the main provider or assigned to any additional service
      const isMainProvider = appointment.staffId === staffId

      // Check if staff is assigned to any additional service
      const isAssignedToAdditionalService = appointment.additionalServices &&
        appointment.additionalServices.some((s: any) => s.staffId === staffId)

      // If staff is not involved in this appointment at all, skip
      if (!isMainProvider && !isAssignedToAdditionalService) {
        return false
      }

      // Check if time overlaps
      const otherStart = parseISO(appointment.date)
      const otherEnd = addMinutes(otherStart, appointment.duration)

      return isWithinInterval(appointmentDate, { start: otherStart, end: otherEnd }) ||
             isWithinInterval(appointmentEndTime, { start: otherStart, end: otherEnd }) ||
             (appointmentDate <= otherStart && appointmentEndTime >= otherEnd)
    })
  }

  // Update unavailable staff when the dialog opens
  useEffect(() => {
    if (currentBooking && realStaff.length > 0) {
      const unavailable = realStaff
        .filter(staff => staff.status === "Active")
        .filter(staff => !isStaffAvailable(staff.id, currentBooking))
        .map(staff => staff.id)

      setUnavailableStaff(unavailable)
    }
  }, [currentBooking, realStaff])

  // Check if selected staff is already booked
  useEffect(() => {
    if (selectedStaff && unavailableStaff.includes(selectedStaff)) {
      setStaffWarning("This staff member is already assigned to a service during this time slot.")
    } else {
      setStaffWarning(null)
    }
  }, [selectedStaff, unavailableStaff])

  // Log available categories and services for debugging
  React.useEffect(() => {
    if (open) {
      console.log("Available categories:", categories);
      console.log("Available services:", services.length, "total");

      // Log services by category
      const servicesByCategory = {};
      services.forEach(service => {
        if (!servicesByCategory[service.category]) {
          servicesByCategory[service.category] = [];
        }
        servicesByCategory[service.category].push(service.name);
      });

      console.log("Services by category:", servicesByCategory);
    }
  }, [open, categories, services]);

  // Create a mapping between category IDs and names
  const categoryIdToNameMap = React.useMemo(() => {
    const map = new Map();
    categories.forEach(cat => {
      map.set(cat.id, cat.name);
    });
    return map;
  }, [categories]);

  const categoryNameToIdMap = React.useMemo(() => {
    const map = new Map();
    categories.forEach(cat => {
      map.set(cat.name, cat.id);
    });
    return map;
  }, [categories]);

  // Filter services by category
  const filteredServices = React.useMemo(() => {
    if (!selectedCategory || selectedCategory === "all") {
      return services;
    }

    console.log("Filtering services for category:", selectedCategory);
    console.log("Available services:", services.length);

    return services.filter((service) => {
      // Services are stored with category names, so match directly by name
      // Also handle the inconsistent "massage-and-spa" ID format
      const matchByName = service.category === selectedCategory;
      const matchByIdFormat = service.category === categoryNameToIdMap.get(selectedCategory);

      const match = matchByName || matchByIdFormat;

      if (match) {
        console.log("Service matches:", service.name, "Category:", service.category);
      }

      return match;
    });
  }, [selectedCategory, categoryNameToIdMap, services]);

  // Filter active staff
  const activeStaff = realStaff.filter((s) => s.status === "Active")

  const handleSubmit = async () => {
    // Validate required fields
    if (!selectedCategory) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a service category.",
      })
      return
    }

    if (!selectedService) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a service.",
      })
      return
    }

    if (!selectedStaff) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a staff member.",
      })
      return
    }

    // Check if staff is unavailable
    if (unavailableStaff.includes(selectedStaff)) {
      toast({
        variant: "destructive",
        title: "Staff unavailable",
        description: "This staff member is already assigned to a service during this time slot. Please select another staff member.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Find the selected service details
      const serviceDetails = services.find((s) => s.id === selectedService)
      const staffDetails = realStaff.find((s) => s.id === selectedStaff)

      if (!serviceDetails || !staffDetails) {
        throw new Error("Service or staff not found")
      }

      // Create the service object with a unique ID for UI tracking
      // but also include the actual serviceId for database persistence
      const newService = {
        id: `service-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        serviceId: serviceDetails.id, // Add the actual service ID from the database
        type: "service",
        name: serviceDetails.name,
        price: serviceDetails.price,
        duration: serviceDetails.duration,
        staff: staffDetails.name,
        staffId: staffDetails.id,
      }

      // Log the service being added for debugging
      console.log("Adding service:", newService);

      // Call the callback to add the service
      onServiceAdded(bookingId, newService)

      toast({
        title: "Service added",
        description: `${serviceDetails.name} with ${staffDetails.name} has been added to the booking.`,
      })

      // Reset form and close dialog
      setSelectedCategory("")
      setSelectedService("")
      setSelectedStaff("")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to add service:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add the service. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Service</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">Service Category</Label>
            <Select
              value={selectedCategory}
              onValueChange={(value) => {
                console.log("Category selected:", value);
                setSelectedCategory(value);
                // Reset service selection when category changes
                setSelectedService("");
              }}
              name="category"
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Select
              value={selectedService}
              onValueChange={(value) => {
                console.log("Service selected:", value);
                setSelectedService(value);
              }}
              name="service"
              disabled={!selectedCategory}
            >
              <SelectTrigger id="service">
                <SelectValue placeholder={!selectedCategory ? "Select a category first" : "Select a service"} />
              </SelectTrigger>
              <SelectContent>
                {filteredServices.length > 0 ? (
                  filteredServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - <CurrencyDisplay amount={service.price} showSymbol={true} useLocaleFormat={false} /> ({service.duration} min)
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-services" disabled>
                    No services available in this category
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectedService && (
              <div className="text-xs text-gray-500 mt-1">
                Selected service: {services.find(s => s.id === selectedService)?.name || "Unknown"}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff">Staff Member</Label>
            <Select
              value={selectedStaff}
              onValueChange={(value) => {
                console.log("Staff selected:", value);
                setSelectedStaff(value);
              }}
              name="staff"
              disabled={!selectedService}
            >
              <SelectTrigger
                id="staff"
                className={unavailableStaff.includes(selectedStaff) ? "border-red-500" : ""}
              >
                <SelectValue placeholder={!selectedService ? "Select a service first" : "Select staff member"} />
              </SelectTrigger>
              <SelectContent>
                {isStaffLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading staff...
                  </SelectItem>
                ) : activeStaff.length > 0 ? (
                  activeStaff.map((staff) => {
                    const isUnavailable = unavailableStaff.includes(staff.id);
                    return (
                      <SelectItem
                        key={staff.id}
                        value={staff.id}
                        className={isUnavailable ? "text-red-500 line-through" : ""}
                        disabled={isUnavailable}
                      >
                        {staff.name} - {(staff.role || staff.jobRole || "Staff").replace("_", " ")}
                        {isUnavailable ? " (Unavailable)" : ""}
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="no-staff" disabled>
                    No staff members available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {selectedStaff && (
              <div className="text-xs text-gray-500 mt-1">
                Selected staff: {realStaff.find(s => s.id === selectedStaff)?.name || "Unknown"}
              </div>
            )}
            {staffWarning && (
              <Alert variant="destructive" className="py-2 mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs ml-2">
                  {staffWarning}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedService || !selectedStaff || unavailableStaff.includes(selectedStaff)}
            className="bg-black text-white hover:bg-gray-800"
          >
            {isSubmitting ? "Adding..." : "Add Service"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

