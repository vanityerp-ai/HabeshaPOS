"use client"

import React, { useState, useRef, useEffect } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useLocations } from "@/lib/location-provider"
import { useStaffAvailabilitySync } from "@/hooks/use-staff-availability-sync"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CalendarIcon, ClipboardList, Plus, Search, X, Clock, Moon } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { LocationButtons } from "@/components/location-buttons"
import {
  format,
  addDays,
  subDays,
  parseISO,
  isSameDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  getDay,
  getDate
} from "date-fns"
import { cn } from "@/lib/utils"
import { getCleanClientName } from "@/lib/utils/client-name-utils"
// DEPRECATED: Mock data removed - now using real API data
import { useStaff } from "@/lib/staff-provider"
import { TimeSlotActionDialog } from "@/components/scheduling/time-slot-action-dialog"
import { NewAppointmentDialogV2 } from "@/components/scheduling/new-appointment-dialog-v2"
import { EnhancedBookingSummary } from "@/components/scheduling/enhanced-booking-summary"
import { GroupAppointmentDialog } from "@/components/scheduling/group-appointment-dialog"
import { BlockedTimeDialog } from "@/components/scheduling/blocked-time-dialog"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { getFirstName } from "@/lib/female-avatars"
import { staffAvailabilityService } from "@/lib/services/staff-availability"

interface EnhancedSalonCalendarProps {
  onAddAppointment?: (date?: Date) => void
  onAppointmentClick?: (appointment: any) => void
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  appointments?: any[]
  onAppointmentCreated?: (appointment: any) => void
  onAppointmentUpdated?: (appointment: any) => void
}

export function EnhancedSalonCalendar({
  onAddAppointment,
  onAppointmentClick,
  selectedDate = new Date(),
  onDateSelect,
  appointments = [],
  onAppointmentCreated,
  onAppointmentUpdated,
}: EnhancedSalonCalendarProps) {
  const { currentLocation, setCurrentLocation, user, hasPermission } = useAuth()
  const { locations, getActiveLocations } = useLocations()
  const { toast } = useToast()
  const [date, setDate] = useState<Date>(selectedDate)
  // Always initialize with "calendar" view to ensure Calendar View tab is shown by default
  const [viewMode, setViewMode] = useState<"calendar" | "summary">("calendar")
  const [hoveredTime, setHoveredTime] = useState<string | null>(null)
  const [hoveredTimeSlot, setHoveredTimeSlot] = useState<any | null>(null)
  const [hoveredStaffId, setHoveredStaffId] = useState<string | null>(null)
  // Remove local selectedLocation state - use global currentLocation from useAuth instead
  const [viewType, setViewType] = useState<string>("day")
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Early/Late hours collapsible state
  const [earlyHoursExpanded, setEarlyHoursExpanded] = useState<boolean>(false)
  const [lateHoursExpanded, setLateHoursExpanded] = useState<boolean>(false)

  // Time slot action dialog state
  const [isTimeSlotActionDialogOpen, setIsTimeSlotActionDialogOpen] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<any | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [staffFilter, setStaffFilter] = useState<string | null>(null)

  // New appointment dialog state
  const [isNewAppointmentDialogOpen, setIsNewAppointmentDialogOpen] = useState(false)
  const [newAppointmentTime, setNewAppointmentTime] = useState<string | undefined>()
  const [newAppointmentStaffId, setNewAppointmentStaffId] = useState<string | undefined>()

  // Group appointment dialog state
  const [isGroupAppointmentDialogOpen, setIsGroupAppointmentDialogOpen] = useState(false)

  // Blocked time dialog state
  const [isBlockedTimeDialogOpen, setIsBlockedTimeDialogOpen] = useState(false)

  // Memoize the view type selector to prevent unnecessary re-renders
  const viewTypeSelector = React.useMemo(() => (
    <Select value={viewType} onValueChange={setViewType}>
      <SelectTrigger className="w-[100px]">
        <SelectValue placeholder="View" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="day">Day</SelectItem>
        <SelectItem value="week">Week</SelectItem>
        <SelectItem value="month">Month</SelectItem>
      </SelectContent>
    </Select>
  ), [viewType, setViewType])

  // Update parent component's selected date when our date changes
  useEffect(() => {
    if (onDateSelect && date) {
      onDateSelect(date)
    }
  }, [date, onDateSelect])

  // Ensure the Calendar View tab is always available and properly initialized
  useEffect(() => {
    // Log the current view mode to help with debugging
    console.log("EnhancedSalonCalendar - Current view mode:", viewMode);

    // If viewMode is undefined or null, set it to "calendar" to ensure Calendar View is shown
    if (!viewMode) {
      setViewMode("calendar");
    }
  }, [viewMode])

  // Monitor currentLocation changes for debugging
  useEffect(() => {
    console.log(`🔄 EnhancedSalonCalendar - currentLocation changed to: "${currentLocation}"`);
  }, [currentLocation])

  // Update current time every minute
  useEffect(() => {
    // Update current time immediately
    setCurrentTime(new Date());

    // Set up interval to update current time every minute
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 60000 ms = 1 minute

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [])

  // Use the staff provider to get REAL ACTIVE staff data from API/database (excludes inactive/on-leave)
  const { activeStaff: staff, getActiveStaffByLocation, refreshStaff } = useStaff();



  // Add a loading state check
  const [isStaffLoading, setIsStaffLoading] = useState(true);
  const [hasShownError, setHasShownError] = useState(false);

  // Monitor staff loading state
  useEffect(() => {
    // If we have staff data, we're no longer loading
    if (staff.length > 0) {
      setIsStaffLoading(false);
      setHasShownError(false); // Reset error flag when staff loads
    } else {
      // If no staff after 5 seconds, try refreshing
      const timeout = setTimeout(() => {
        console.log("EnhancedSalonCalendar: No staff data after 5 seconds, attempting refresh...");
        refreshStaff();
        setIsStaffLoading(false);
      }, 5000); // Increased timeout to 5 seconds

      return () => clearTimeout(timeout);
    }
  }, [staff.length, refreshStaff]);

  // Get ACTIVE staff for the selected location using the provider's built-in filtering (excludes inactive/on-leave)
  let locationStaff = getActiveStaffByLocation(currentLocation);
  // Exclude admins, managers, and receptionists from locationStaff
  locationStaff = locationStaff.filter(staff => {
    const role = (staff.role || "").toUpperCase();
    return role !== "ADMIN" && role !== "MANAGER" && role !== "SUPER_ADMIN";
  });

  // Filter staff columns based on permissions
  // If user only has "view_own_appointments" (not "view_appointments"), show only their column
  const hasViewAllPermission = hasPermission("view_appointments")
  const hasViewOwnPermission = hasPermission("view_own_appointments")

  if (!hasViewAllPermission && hasViewOwnPermission && user) {
    // User can only see their own column
    console.log(`🔒 Attempting to filter staff columns for user "${user.name}" (ID: ${user.id})`)
    console.log(`📋 Available staff before filtering:`, locationStaff.map(s => ({ id: s.id, name: s.name })))

    locationStaff = locationStaff.filter(staff => staff.id === user.id)

    console.log(`🔒 After filtering - Staff count: ${locationStaff.length}`)

    // If user is not in the staff list, try to find them in the full staff array
    if (locationStaff.length === 0) {
      console.warn(`⚠️ User "${user.name}" not found in locationStaff. Searching in full staff array...`)
      const userStaff = staff.find(s => s.id === user.id)
      if (userStaff) {
        console.log(`✅ Found user in full staff array. Adding to locationStaff.`)
        locationStaff = [userStaff]
      } else {
        console.warn(`⚠️ User "${user.name}" (ID: ${user.id}) not found in staff array. Creating fallback staff object.`)

        // Create a fallback staff object for the current user
        const fallbackStaff = {
          id: user.id,
          name: user.name,
          email: user.email || '',
          phone: '',
          role: user.role,
          locations: user.locations || [currentLocation],
          status: 'active',
          homeService: false,
          employeeNumber: '',
          dateOfBirth: '',
          qidNumber: '',
          passportNumber: '',
          qidValidity: '',
          passportValidity: '',
          medicalValidity: '',
          profileImage: '',
          profileImageType: '',
          specialties: [],
          rating: 0,
          isTopRated: false,
          availability: 'Available',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        console.log(`✅ Created fallback staff object for user "${user.name}"`)
        locationStaff = [fallbackStaff]
      }
    }
  }

  // Filter by staff filter if active
  const availableStaff = staffFilter
    ? locationStaff.filter(s => s.id === staffFilter)
    : locationStaff;

  // Debug log to verify we're using REAL staff data from API/database
  console.log("🔍 EnhancedSalonCalendar - Staff Count:", staff.length, "| Location:", currentLocation, "| Available:", availableStaff.length);

  // Safety check: if no staff available, provide a minimal fallback to prevent crashes
  const safeStaff = availableStaff.length > 0 ? availableStaff : [];

  // If we have no staff but are still loading, show loading state instead of error
  if (staff.length === 0 && isStaffLoading) {
    console.log("🔄 EnhancedSalonCalendar - Still loading staff data...");
  }



  // Add a useEffect to handle staff data verification and error notification
  useEffect(() => {
    // Only check for errors after loading is complete and we haven't shown an error yet
    if (staff.length === 0 && !isStaffLoading && !hasShownError) {
      // Wait much longer before showing any error to account for slow network
      const errorTimeout = setTimeout(() => {
        if (staff.length === 0) {
          console.warn("⚠️ EnhancedSalonCalendar - No staff data found after extended wait. This may be a temporary network issue.");
          setHasShownError(true);
          // Show a less alarming toast notification
          toast({
            title: "Staff Data Loading",
            description: "Staff data is still loading. The calendar will update automatically when ready.",
          });
        }
      }, 10000); // Wait 10 seconds before showing any notification

      return () => clearTimeout(errorTimeout);
    } else if (staff.length > 0) {
      console.log(`✅ EnhancedSalonCalendar - Successfully loaded ${staff.length} staff members`);
    }
  }, [staff.length, isStaffLoading, hasShownError, toast]);

  // Log location filtering results
  if (currentLocation !== "all") {
    console.log(`📍 Location Filter Results for "${currentLocation}":`, {
      totalStaff: staff.length,
      locationStaff: locationStaff.length,
      staffNames: locationStaff.map(s => s.name)
    });
  }

  // Create time slots for day view (9 AM to 11 PM with 15-minute intervals)
  const timeSlots = []
  for (let hour = 9; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      timeSlots.push({
        hour,
        minute,
        label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`,
        fullLabel: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
        isHourStart: minute === 0,
      })
    }
  }

  // Get date range based on view type
  const getDateRange = () => {
    if (viewType === "day") {
      return { start: date, end: date }
    } else if (viewType === "week") {
      return { start: startOfWeek(date), end: endOfWeek(date) }
    } else if (viewType === "month") {
      return { start: startOfMonth(date), end: endOfMonth(date) }
    }
    return { start: date, end: date }
  }

  const dateRange = getDateRange()

  // Create a list of all appointments including additional services as separate appointments
  const getAllAppointments = () => {
    const allAppointments = [...appointments];

    // Add additional services as separate appointments for display in the calendar
    appointments.forEach(appointment => {
      if (appointment.additionalServices && appointment.additionalServices.length > 0) {
        appointment.additionalServices.forEach((service: any) => {
          if (service.staffId && service.staffId !== appointment.staffId) {
            // Create a new appointment-like object for this additional service
            allAppointments.push({
              id: `${appointment.id}-service-${service.id || Date.now()}`,
              clientId: appointment.clientId,
              clientName: appointment.clientName,
              date: service.date || appointment.date, // Use the service date if available, otherwise use the parent appointment date
              service: service.name,
              duration: service.duration || 30, // Default to 30 minutes if not specified
              staffId: service.staffId,
              staffName: service.staffName,
              location: appointment.location,
              status: appointment.status,
              price: service.price,
              isAdditionalService: true,
              parentAppointmentId: appointment.id,
              additionalServiceInfo: `Additional service for ${appointment.clientName}`
            });
          }
        });
      }
    });

    return allAppointments;
  };

  const allAppointmentsWithAdditionalServices = getAllAppointments();

  // Filter appointments based on view type, location, and staff filter
  // Also prioritize original appointments over reflected ones
  const filteredAppointments = allAppointmentsWithAdditionalServices.filter((appointment) => {
    const appointmentDate = parseISO(appointment.date)
    let isInRange = false

    if (viewType === "day") {
      isInRange = isSameDay(appointmentDate, date)
    } else if (viewType === "week") {
      isInRange = appointmentDate >= dateRange.start && appointmentDate <= dateRange.end
    } else if (viewType === "month") {
      isInRange = isSameMonth(appointmentDate, date)
    }

    // Add a property to identify out-of-hours appointments
    if (isInRange) {
      const hour = appointmentDate.getHours();

      // Handle appointments between 4 AM and 9 AM as early hours
      if (hour >= 4 && hour < 9) {
        appointment.isEarlyHours = true;
        appointment.isLateHours = false;
      }
      // Handle late night appointments (midnight to 3:59 AM)
      else if (hour >= 0 && hour < 4) {
        appointment.isLateHours = true;
        appointment.isEarlyHours = false;
      }
    }

    // Special handling for home service location and cross-location blocking
    let isCorrectLocation = false;
    if (currentLocation === "all") {
      isCorrectLocation = true;
    } else if (currentLocation === "home") {
      // For home service, include appointments with location "home" or "loc4"
      isCorrectLocation = appointment.location === "home" || appointment.location === "loc4";

      // REVERSE CROSS-LOCATION BLOCKING: Also show physical location appointments for staff members
      // who have home service capability, so they appear as unavailable for home service
      if (!isCorrectLocation && (appointment.location === "loc1" || appointment.location === "loc2" || appointment.location === "loc3")) {
        const staffMember = staff && Array.isArray(staff) ? staff.find(s => s.id === appointment.staffId) : null;
        if (staffMember && staffMember.homeService === true) {
          isCorrectLocation = true; // Show physical location appointment in home service view
          appointment._isCrossLocationBlocking = true;
        }
      }
    } else {
      // For physical locations, show appointments at this location
      isCorrectLocation = appointment.location === currentLocation;

      // CROSS-LOCATION BLOCKING: Also show home service appointments for staff members
      // who are assigned to this location, so they appear as unavailable
      if (!isCorrectLocation && (appointment.location === "home" || appointment.location === "loc4")) {
        const staffMember = staff && Array.isArray(staff) ? staff.find(s => s.id === appointment.staffId) : null;
        if (staffMember && staffMember.locations.includes(currentLocation)) {
          isCorrectLocation = true; // Show home service appointment in staff's primary location
          // Mark this appointment as a cross-location blocking appointment for visual indication
          appointment._isCrossLocationBlocking = true;
        }
      }
    }

    // Get the staff member for this appointment
    const staffMember = staff && Array.isArray(staff) ? staff.find(s => s.id === appointment.staffId) : null;

    // Only show appointments for staff members who are assigned to the selected location
    // This ensures staff members only show appointments at their assigned locations
    const isStaffAssignedToLocation =
      currentLocation === "all" ||
      (staffMember && staffMember.locations.includes(currentLocation)) ||
      (currentLocation === "home" && staffMember && staffMember.homeService);

    const isCorrectStaff = staffFilter === null || appointment.staffId === staffFilter

    // Filter by permission: if user only has "view_own_appointments", show only their appointments
    const hasViewAllPermission = hasPermission("view_appointments")
    const hasViewOwnPermission = hasPermission("view_own_appointments")

    let isOwnAppointment = true
    if (!hasViewAllPermission && hasViewOwnPermission && user) {
      // User can only see their own appointments
      isOwnAppointment = appointment.staffId === user.id
    }

    return isInRange && isCorrectLocation && isCorrectStaff && isStaffAssignedToLocation && isOwnAppointment
  })

  // Sort appointments to prioritize original appointments over reflected ones
  // This ensures that when both original and reflected appointments exist for the same time/staff,
  // the original appointment is shown prominently
  .sort((a, b) => {
    // Original appointments (not reflected) come first
    if (!a.isReflected && b.isReflected) return -1;
    if (a.isReflected && !b.isReflected) return 1;

    // If both are the same type, sort by date
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Debug log to help diagnose appointment filtering issues
  console.log("EnhancedSalonCalendar - Filtered Appointments:",
    filteredAppointments.map(a => ({
      id: a.id,
      staffName: a.staffName,
      location: a.location,
      service: a.service,
      isReflected: a.isReflected,
      originalAppointmentId: a.originalAppointmentId
    })));

  // For backward compatibility
  console.log("EnhancedSalonCalendar - Filtered Appointments:",
    filteredAppointments.map(a => ({
      staffName: a.staffName,
      location: a.location,
      service: a.service
    })));

  // For backward compatibility
  const todaysAppointments = filteredAppointments.filter(appointment =>
    isSameDay(parseISO(appointment.date), date)
  )

  // Group appointments by status
  const appointmentsByStatus = {
    pending: todaysAppointments.filter((a) => a.status === "pending"),
    upcoming: todaysAppointments.filter((a) => a.status === "confirmed"),
    arrived: todaysAppointments.filter((a) => a.status === "arrived"),
    inProgress: todaysAppointments.filter((a) => a.status === "service-started"),
    completed: todaysAppointments.filter((a) => a.status === "completed"),
    cancelled: todaysAppointments.filter((a) => a.status === "cancelled" || a.status === "no-show"),
  }

  // Get appointment position and height based on time
  const getAppointmentStyle = (appointment: any) => {
    const appointmentDate = parseISO(appointment.date)
    const hour = appointmentDate.getHours()
    const minute = appointmentDate.getMinutes()

    // Calculate start position (each hour is 60px, each 15 min is 15px)
    const startMinutesSinceMorning = (hour - 9) * 60 + minute
    const top = (startMinutesSinceMorning / 15) * 15

    // Calculate height (each minute is 1px)
    const height = (appointment.duration / 60) * 60

    return {
      top: `${top}px`,
      height: `${height}px`,
    }
  }

  // Get current time line position
  const getCurrentTimePosition = () => {
    const hour = currentTime.getHours()
    const minute = currentTime.getMinutes()

    // Only show the line if the current time is within the displayed hours (9 AM to 11:59 PM)
    if (hour < 9 || hour >= 24) {
      return -1; // Return -1 to indicate the line should not be shown
    }

    // Calculate position (each hour is 60px, each minute is 1px)
    const minutesSinceMorning = (hour - 9) * 60 + minute
    return minutesSinceMorning;
  }

  // Get appointment background color based on type, status, then service type
  const getAppointmentColor = (service?: string, status?: string, type?: string, isReflected?: boolean) => {
    // Check for reflected appointments first - give them a distinct appearance
    if (isReflected) {
      return "bg-slate-100 border-l-slate-500 text-slate-700 opacity-75 border-dashed"
    }

    // Check for blocked time entries
    if (type === "blocked") {
      return "bg-gray-200 border-l-gray-600 text-gray-800"
    }

    // Default color if both service and status are undefined
    if (!service && !status) {
      return "bg-gray-100 border-l-gray-400 text-gray-700"
    }

    // Status-based colors take precedence if status is defined
    if (status) {
      switch (status) {
        case "pending":
          return "bg-yellow-100 border-l-yellow-500 text-yellow-800"
        case "confirmed":
          return "bg-blue-100 border-l-blue-500 text-blue-800"
        case "arrived":
          return "bg-indigo-100 border-l-indigo-500 text-indigo-800"
        case "service-started":
          return "bg-purple-100 border-l-purple-500 text-purple-800"
        case "completed":
          return "bg-green-100 border-l-green-500 text-green-800"
        case "cancelled":
          return "bg-gray-100 border-l-gray-500 text-gray-500"
        case "no-show":
          return "bg-red-100 border-l-red-500 text-red-800"
        case "blocked":
          return "bg-gray-200 border-l-gray-600 text-gray-800"
      }
    }

    // Fallback to service-based colors if status is not recognized or undefined
    if (service) {
      const serviceLower = service.toLowerCase();
      if (serviceLower.includes("color") || serviceLower.includes("highlights")) {
        return "bg-blue-100 border-l-blue-500"
      } else if (serviceLower.includes("haircut") || serviceLower.includes("style")) {
        return "bg-purple-100 border-l-purple-500"
      } else if (serviceLower.includes("facial") || serviceLower.includes("mask")) {
        return "bg-green-100 border-l-green-500"
      } else if (serviceLower.includes("massage")) {
        return "bg-pink-100 border-l-pink-500"
      }
    }

    // Default fallback color
    return "bg-amber-100 border-l-amber-500"
  }

  // Get service price
  const getServicePrice = (serviceName: string) => {
    // TODO: Replace with real API call to fetch service price
    return 0
  }

  // Get staff avatar color
  const getStaffAvatarColor = (index: number) => {
    const colors = [
      "bg-purple-100 text-purple-800",
      "bg-green-100 text-green-800",
      "bg-amber-100 text-amber-800",
      "bg-rose-100 text-rose-800",
      "bg-blue-100 text-blue-800",
      "bg-lime-100 text-lime-800",
    ]
    return colors[index % colors.length]
  }

  // Navigation functions
  const goToToday = () => setDate(new Date())

  // Navigation based on view type
  const goToPrevious = () => {
    if (viewType === "day") {
      setDate(subDays(date, 1))
    } else if (viewType === "week") {
      setDate(subDays(date, 7))
    } else if (viewType === "month") {
      const prevMonth = new Date(date)
      prevMonth.setMonth(prevMonth.getMonth() - 1)
      setDate(prevMonth)
    }
  }

  const goToNext = () => {
    if (viewType === "day") {
      setDate(addDays(date, 1))
    } else if (viewType === "week") {
      setDate(addDays(date, 7))
    } else if (viewType === "month") {
      const nextMonth = new Date(date)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      setDate(nextMonth)
    }
  }

  // Legacy functions for compatibility
  const goToPreviousDay = () => goToPrevious()
  const goToNextDay = () => goToNext()

  // Handle appointment click
  const handleAppointmentClick = (appointment: any) => {
    // If this is a reflected appointment, find and show the original appointment instead
    if (appointment.isReflected && appointment.originalAppointmentId) {
      console.log('🔄 Clicked on reflected appointment, finding original:', appointment.originalAppointmentId);
      const originalAppointment = appointments.find(apt => apt.id === appointment.originalAppointmentId);
      if (originalAppointment && onAppointmentClick) {
        console.log('✅ Found original appointment:', originalAppointment);
        onAppointmentClick(originalAppointment);
        return;
      } else {
        console.warn('❌ Original appointment not found for reflected appointment:', appointment.originalAppointmentId);
      }
    }

    // If this is an additional service, find and click the parent appointment instead
    if (appointment.isAdditionalService && appointment.parentAppointmentId) {
      const parentAppointment = appointments.find(a => a.id === appointment.parentAppointmentId);
      if (parentAppointment) {
        if (onAppointmentClick) {
          onAppointmentClick(parentAppointment);
        }
        return;
      }
    }

    if (onAppointmentClick) {
      onAppointmentClick(appointment);
    }
  }

  // Check if a staff member is blocked or booked at a given time
  const isStaffBlockedAt = (staffId: string, checkDate: Date, hour: number, minute: number) => {
    // Create a date object for the time we want to check
    const timeToCheck = new Date(checkDate);
    timeToCheck.setHours(hour, minute, 0, 0);

    // Find any blocked time entries or appointments for this staff at this time
    return filteredAppointments.some(appointment => {
      // IMPORTANT: Skip completed appointments - they don't block staff availability
      if (appointment.status === "completed") {
        return false;
      }

      // IMPORTANT: Skip cancelled and no-show appointments - they don't block staff availability
      if (appointment.status === "cancelled" || appointment.status === "no-show") {
        return false;
      }

      // STRICT RULE: Check if staff is the main provider or assigned to any additional service
      const isMainProvider = appointment.staffId === staffId;

      // If staff is the main provider but has completed their service, they are available
      if (isMainProvider && appointment.staffServiceCompleted) {
        return false;
      }

      // Check if staff is assigned to any additional service
      const isAssignedToAdditionalService = appointment.additionalServices &&
        appointment.additionalServices.some((s: any) => s.staffId === staffId);

      // If staff is assigned to an additional service but has completed it, they are available
      if (isAssignedToAdditionalService && appointment.additionalServices) {
        const staffService = appointment.additionalServices.find((s: any) => s.staffId === staffId);
        if (staffService && staffService.completed) {
          return false;
        }
      }

      // If staff is not involved in this appointment at all, skip
      if (!isMainProvider && !isAssignedToAdditionalService) {
        return false;
      }

      // Parse appointment times
      const appointmentStart = parseISO(appointment.date);
      const appointmentEnd = new Date(appointmentStart.getTime() + appointment.duration * 60000);

      // Check if the time to check falls within the appointment or blocked time
      return timeToCheck >= appointmentStart && timeToCheck < appointmentEnd;
    });
  };

  // Check if all staff are blocked at a given time
  const areAllStaffBlockedAt = (checkDate: Date, hour: number, minute: number) => {
    // If we have a staff filter active, only check that staff member
    if (staffFilter) {
      return isStaffBlockedAt(staffFilter, checkDate, hour, minute);
    }

    // Otherwise, check if all available staff are blocked
    return safeStaff.length > 0 && safeStaff.every(staff =>
      isStaffBlockedAt(staff.id, checkDate, hour, minute)
    );
  };

  // Handle add appointment
  const handleAddAppointment = (time?: { hour: number; minute: number }, staffId?: string) => {
    // If a specific time and staff are provided, check if that staff is blocked
    if (time && staffId && isStaffBlockedAt(staffId, date, time.hour, time.minute)) {
      // Don't open the dialog if the staff is blocked at this time
      toast({
        title: "Staff unavailable",
        description: "This staff member is not available at the selected time due to a blocked time entry.",
        variant: "destructive"
      });
      return;
    }

    if (time) {
      const timeString = `${time.hour.toString().padStart(2, "0")}:${time.minute.toString().padStart(2, "0")}`
      setNewAppointmentTime(timeString)
      setNewAppointmentStaffId(staffId)
      setIsNewAppointmentDialogOpen(true)
    } else if (onAddAppointment) {
      onAddAppointment(date)
    } else {
      // Default time is 10:00 AM
      const defaultHour = 10;
      const defaultMinute = 0;

      // Check if all staff are blocked at the default time
      if (areAllStaffBlockedAt(date, defaultHour, defaultMinute)) {
        toast({
          title: "Staff unavailable",
          description: "All staff members are unavailable at this time due to blocked time entries.",
          variant: "destructive"
        });
        return;
      }

      setIsNewAppointmentDialogOpen(true)
    }
  }

  // Handle time slot hover
  const handleTimeSlotHover = (timeSlot: any, staffId: string) => {
    setHoveredTime(timeSlot.isHourStart ? timeSlot.label : null)
    setHoveredTimeSlot(timeSlot)
    setHoveredStaffId(staffId)
  }

  // Handle time slot click
  const handleTimeSlotClick = (timeSlot: any, staffId: string, selectedDay?: Date) => {
    // Check if the staff is blocked at this time
    const dayToCheck = selectedDay || date;
    if (isStaffBlockedAt(staffId, dayToCheck, timeSlot.hour, timeSlot.minute)) {
      toast({
        title: "Staff unavailable",
        description: "This staff member is not available at the selected time due to a blocked time entry.",
        variant: "destructive"
      });
      return;
    }

    // If a specific day is provided (for week view), update the timeSlot with that day
    if (selectedDay) {
      const updatedTimeSlot = {
        ...timeSlot,
        day: selectedDay
      };
      setSelectedTimeSlot(updatedTimeSlot);
    } else {
      setSelectedTimeSlot(timeSlot);
    }
    setSelectedStaffId(staffId);
    setIsTimeSlotActionDialogOpen(true);
  }

  // Handle time slot action
  const handleTimeSlotAction = (action: "appointment" | "group" | "blocked") => {
    // Format time string for all dialog types
    const timeString = `${selectedTimeSlot.hour.toString().padStart(2, "0")}:${selectedTimeSlot.minute.toString().padStart(2, "0")}`

    // If we have a specific day from the week/month view, use that instead of the current date
    const selectedDay = selectedTimeSlot.day || date;
    if (selectedTimeSlot.day) {
      setDate(selectedTimeSlot.day);
    }

    // Close the time slot action dialog
    setIsTimeSlotActionDialogOpen(false)

    if (action === "appointment") {
      // Check if the staff is blocked at this time (only for appointment action)
      if (selectedStaffId && isStaffBlockedAt(selectedStaffId, selectedDay, selectedTimeSlot.hour, selectedTimeSlot.minute)) {
        toast({
          title: "Staff unavailable",
          description: "This staff member is not available at the selected time due to a blocked time entry.",
          variant: "destructive"
        });
        return;
      }

      // Set up and open the appointment dialog
      setNewAppointmentTime(timeString)
      setNewAppointmentStaffId(selectedStaffId || undefined)
      setIsNewAppointmentDialogOpen(true)
    } else if (action === "group") {
      // Check if the staff is blocked at this time (only for group appointment action)
      if (selectedStaffId && isStaffBlockedAt(selectedStaffId, selectedDay, selectedTimeSlot.hour, selectedTimeSlot.minute)) {
        toast({
          title: "Staff unavailable",
          description: "This staff member is not available at the selected time due to a blocked time entry.",
          variant: "destructive"
        });
        return;
      }

      // Set up and open the group appointment dialog
      setNewAppointmentTime(timeString)
      setNewAppointmentStaffId(selectedStaffId || undefined)
      setIsGroupAppointmentDialogOpen(true)
    } else if (action === "blocked") {
      // Set up and open the blocked time dialog
      setNewAppointmentTime(timeString)
      setNewAppointmentStaffId(selectedStaffId || undefined)
      setIsBlockedTimeDialogOpen(true)
    }
  }

  // Handle appointment created
  const handleAppointmentCreated = (newAppointment: any) => {
    console.log("EnhancedSalonCalendar handleAppointmentCreated called with:", newAppointment);
    if (onAppointmentCreated) {
      onAppointmentCreated(newAppointment)
    } else {
      console.error("onAppointmentCreated callback is not defined in EnhancedSalonCalendar");
    }
  }

  // Listen for appointment updates from client portal
  useEffect(() => {
    // Check for updates from localStorage (polling approach)
    const checkForUpdates = () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        const lastUpdate = localStorage.getItem('vanity_appointments_last_update');
        if (lastUpdate) {
          // Refresh appointments from storage
          const storedAppointments = localStorage.getItem("vanity_appointments");
          if (storedAppointments) {
            try {
              const parsedAppointments = JSON.parse(storedAppointments);
              console.log("Detected appointment updates from client portal:", parsedAppointments.length);

              // Compare with current appointments before notifying parent
              // This prevents infinite loops by only updating when there's an actual change
              const currentAppointmentsJSON = JSON.stringify(appointments);
              const parsedAppointmentsJSON = JSON.stringify(parsedAppointments);

              if (currentAppointmentsJSON !== parsedAppointmentsJSON && onAppointmentUpdated) {
                console.log("Appointments have changed, notifying parent component");
                onAppointmentUpdated(parsedAppointments);
              }
            } catch (error) {
              console.error("Error parsing appointments from storage:", error);
            }
          }
        }
      }
    };

    // Listen for custom events from client portal
    const handleAppointmentCreatedEvent = (event: any) => {
      console.log("Received appointment-created event from client portal:", event.detail);
      if (event.detail && event.detail.appointment) {
        if (onAppointmentCreated) {
          onAppointmentCreated(event.detail.appointment);
        }
      }
    };

    // Set up event listener
    window.addEventListener('appointment-created', handleAppointmentCreatedEvent);

    // Set up polling interval (every 30 seconds)
    const intervalId = setInterval(checkForUpdates, 30000);

    // Initial check - skip on first render to prevent infinite loops
    // We'll rely on the parent component to provide the initial appointments

    // Clean up
    return () => {
      window.removeEventListener('appointment-created', handleAppointmentCreatedEvent);
      clearInterval(intervalId);
    };
  }, [onAppointmentCreated, onAppointmentUpdated, appointments]);

  // Handle booking update from summary view
  const handleBookingUpdate = (updatedBooking: any) => {
    if (onAppointmentUpdated) {
      // Check if this is a single appointment update or a full array
      if (Array.isArray(updatedBooking)) {
        // Compare with current appointments before notifying parent
        const currentAppointmentsJSON = JSON.stringify(appointments);
        const updatedBookingJSON = JSON.stringify(updatedBooking);

        if (currentAppointmentsJSON !== updatedBookingJSON) {
          console.log("Appointments array has changed, notifying parent component");
          onAppointmentUpdated(updatedBooking);
        }
      } else {
        // For single appointment updates, we can pass it directly
        // The parent component will handle merging it with the existing appointments
        onAppointmentUpdated(updatedBooking);
      }
    }
  }

  // Scroll to current time on initial load
  useEffect(() => {
    if (scrollContainerRef.current) {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()

      if (currentHour >= 9 && currentHour <= 23) {
        const minutesSinceMorning = (currentHour - 9) * 60 + currentMinute
        const scrollPosition = (minutesSinceMorning / 15) * 15 - 200 // Scroll to position minus some offset
        scrollContainerRef.current.scrollTop = scrollPosition > 0 ? scrollPosition : 0
      }
    }
  }, [])

  // Show loading state if staff is still loading
  if (isStaffLoading && staff.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading staff data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center mr-4">
            <div className="flex">
              <button
                className={`flex items-center px-3 py-1.5 text-sm border border-r-0 rounded-l-md ${viewMode === 'calendar' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setViewMode('calendar')}
              >
                <span className="mr-1">🗓️</span>
                Calendar
              </button>
              <button
                className={`flex items-center px-3 py-1.5 text-sm border rounded-r-md ${viewMode === 'summary' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setViewMode('summary')}
              >
                <span className="mr-1">📋</span>
                Booking Summary
              </button>
            </div>
          </div>

          <Button
            variant="default"
            size="sm"
            className="rounded-md bg-black text-white hover:bg-gray-800"
            onClick={goToToday}
          >
            Today
          </Button>

          <Button variant="ghost" size="icon" onClick={goToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-sm font-medium">
            {viewType === "day" && format(date, "EEE dd MMM yyyy")}
            {viewType === "week" && (
              <>
                {format(startOfWeek(date), "dd MMM")} - {format(endOfWeek(date), "dd MMM yyyy")}
              </>
            )}
            {viewType === "month" && format(date, "MMMM yyyy")}
          </div>

          <Button variant="ghost" size="icon" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <LocationButtons />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8" />
          </div>

          {staffFilter && (
            <div className="flex items-center bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200">
              <span className="text-sm text-blue-700 mr-2">
                <strong>Showing only:</strong> {staff && Array.isArray(staff) ? staff.find(s => s.id === staffFilter)?.name : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded-full"
                onClick={() => setStaffFilter(null)}
              >
                <X className="h-3.5 w-3.5 text-blue-700" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Use the memoized view type selector */}
          {viewTypeSelector}

          <Button
            onClick={() => handleAddAppointment()}
            className="bg-black text-white hover:bg-gray-800"
            disabled={areAllStaffBlockedAt(date, 10, 0)} // Disable if all staff are blocked at 10:00 AM
            title={areAllStaffBlockedAt(date, 10, 0) ? "All staff are unavailable due to blocked time" : "Add new appointment"}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Calendar View Tab Content */}
      {viewMode === "calendar" && (
        <>
          {/* Loading State for Staff Data */}
          {(staff.length === 0 && isStaffLoading) && (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading staff data...</p>
                <p className="text-sm text-gray-500 mt-2">Please wait while we fetch the latest information</p>
              </div>
            </div>
          )}

          {/* No Staff Data Available */}
          {(staff.length === 0 && !isStaffLoading) && (
            <div className="flex items-center justify-center h-64 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-center">
                <div className="text-yellow-600 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-yellow-800 font-medium">Staff data temporarily unavailable</p>
                <p className="text-sm text-yellow-700 mt-2">The calendar will update automatically when staff data is available</p>
                <button
                  onClick={() => {
                    setIsStaffLoading(true);
                    setHasShownError(false);
                    refreshStaff();
                  }}
                  className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                >
                  Retry Loading
                </button>
              </div>
            </div>
          )}

          {/* Day View */}
          {viewType === "day" && safeStaff.length > 0 && (
            <div className="border rounded-md overflow-hidden shadow-sm">
              <div style={{
                display: "grid",
                gridTemplateColumns: `80px repeat(${safeStaff.length}, 1fr)`,
                position: "relative",
                borderCollapse: "collapse"
              }}>
                {/* Vertical grid lines overlay - ensures perfectly straight lines */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "grid",
                  gridTemplateColumns: `80px repeat(${safeStaff.length}, 1fr)`,
                  pointerEvents: "none",
                  zIndex: 2
                }}>
                  {/* First vertical line */}
                  <div style={{
                    borderRight: "1px solid #e2e8f0", // slate-200 - lighter gray
                    height: "100%",
                    gridColumn: "1 / span 1"
                  }}></div>

                  {/* Staff column vertical lines */}
                  {Array(safeStaff.length).fill(0).map((_, index) => (
                    <div
                      key={`vline-${index}`}
                      style={{
                        borderRight: index < safeStaff.length - 1 ? "1px solid #e2e8f0" : "none", // slate-200 - lighter gray
                        height: "100%",
                        gridColumn: `${index + 2} / span 1`
                      }}
                    ></div>
                  ))}
                </div>
                {/* Header row with staff names */}
                <div className="bg-gray-50 p-2" style={{ borderBottom: "1px solid #e2e8f0" }}></div>
                {safeStaff.map((staff, index) => (
                  <div
                    key={staff.id}
                    className={cn(
                      "bg-gray-50 p-4 text-center cursor-pointer transition-all",
                      staffFilter === staff.id ? "bg-blue-50" : "hover:bg-gray-100"
                    )}
                    style={{ borderBottom: "1px solid #e2e8f0" }}
                    onClick={() => {
                      if (staffFilter === staff.id) {
                        // If already filtered by this staff, clear the filter
                        setStaffFilter(null);
                      } else {
                        // Set filter to this staff
                        setStaffFilter(staff.id);
                      }
                    }}
                  >
                    <div className="mx-auto mb-1">
                      <StaffAvatar
                        staff={staff}
                        size="lg"
                        className="mx-auto"
                      />
                    </div>
                    <div className="text-sm font-medium">{getFirstName(staff.name)}</div>
                    {staffFilter === staff.id && (
                      <div className="text-xs text-blue-600 mt-1 flex items-center justify-center">
                        <span>Showing only</span>
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={(e) => {
                          e.stopPropagation();
                          setStaffFilter(null);
                        }} />
                      </div>
                    )}
                  </div>
                ))}

                {/* Early Hours Section */}
                <div
                  style={{
                    gridColumn: `1 / span ${safeStaff.length + 1}`,
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${safeStaff.length}, 1fr)`,
                    position: "relative",
                    borderBottom: "1px solid #e2e8f0"
                  }}
                >
                  {/* Early Hours Label */}
                  <div className="p-2 bg-blue-50">
                    <span className="text-xs font-medium text-blue-800">Before 9 AM</span>
                  </div>

                  {/* Early Hours Appointments by Staff */}
                  {safeStaff.map((staff) => {
                    // Get early hours appointments for this staff
                    const earlyAppointments = todaysAppointments.filter(
                      (appointment) => appointment.staffId === staff.id && appointment.isEarlyHours
                    );

                    // Sort early appointments by time
                    const sortedEarlyAppointments = [...earlyAppointments].sort((a, b) =>
                      parseISO(a.date).getTime() - parseISO(b.date).getTime()
                    );

                    return (
                      <div
                        key={`early-${staff.id}`}
                        className="p-2 bg-blue-50 min-h-[40px] relative cursor-pointer"
                        onClick={() => {
                          // Create a time slot for 7:00 AM when clicking on the early hours section
                          const earlyTimeSlot = {
                            hour: 7,
                            minute: 0,
                            label: "7:00 AM",
                            fullLabel: "07:00"
                          };
                          handleTimeSlotClick(earlyTimeSlot, staff.id);
                        }}
                      >
                        {/* Empty state indicator */}
                        {sortedEarlyAppointments.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-blue-300 opacity-30 hover:opacity-50 transition-opacity">
                              <Plus size={16} />
                            </div>
                          </div>
                        )}

                        {sortedEarlyAppointments.length > 0 && (
                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {sortedEarlyAppointments.map((appointment) => {
                              const appointmentDate = parseISO(appointment.date);
                              const servicePrice = getServicePrice(appointment.service);
                              const isAdditionalService = appointment.isAdditionalService === true;

                              return (
                                <div
                                  key={appointment.id}
                                  className={cn(
                                    "p-1 rounded-sm border-l-4 cursor-pointer text-xs overflow-hidden",
                                    getAppointmentColor(appointment.service, appointment.status, appointment.type, appointment.isReflected),
                                    isAdditionalService ? "border-dashed border opacity-90" : "",
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent triggering the parent div's onClick
                                    handleAppointmentClick(appointment);
                                  }}
                                >
                                  <div className="font-medium flex justify-between items-start min-w-0">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                        {getCleanClientName(appointment.clientName)} - {appointment.service}
                                      </div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                        {format(appointmentDate, "h:mm a")} • {appointment.duration || 30}min
                                        {(() => {
                                          if (!staff || !Array.isArray(staff)) return '';
                                          const staffMember = staff.find(s => s.id === appointment.staffId);
                                          return staffMember ? ` • ${getFirstName(staffMember.name)}` : '';
                                        })()}
                                      </div>
                                      {appointment.bookingReference && (
                                        <div className="text-xs text-pink-600 dark:text-pink-400 font-medium truncate">
                                          Ref: {appointment.bookingReference}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-90 border border-current font-medium flex-shrink-0">
                                        {appointment.status ?
                                          appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).replace('-', ' ')
                                          : 'Pending'
                                        }
                                      </span>
                                      {appointment.bookingReference && (
                                        <div className="text-xs text-pink-700 font-medium bg-pink-50 px-1 py-0.5 rounded mt-1 truncate">
                                          #{appointment.bookingReference.split('-').pop()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs mt-2 font-medium text-gray-800 dark:text-gray-200 truncate">
                                    {appointment.service || 'Service not specified'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Time slots */}
                <div
                  className="relative overflow-auto max-h-[600px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                  ref={scrollContainerRef}
                  style={{
                    gridColumn: `1 / span ${safeStaff.length + 1}`,
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${safeStaff.length}, 1fr)`,
                    position: "relative"
                  }}
                >
                  {/* Current time indicator line - only shown for today */}
                  {isSameDay(date, new Date()) && (() => {
                    const currentTimePosition = getCurrentTimePosition();
                    if (currentTimePosition >= 0) {
                      return (
                        <div
                          style={{
                            position: "absolute",
                            left: 80, /* Start after the time column */
                            right: 0,
                            top: `${currentTimePosition}px`,
                            height: "2px",
                            backgroundColor: "red",
                            zIndex: 10,
                            pointerEvents: "none"
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: "-4px",
                              top: "-4px",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: "red",
                            }}
                          />
                          <div className="absolute -left-16 -top-3 text-xs text-red-600 font-medium">
                            {format(currentTime, "h:mm a")}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Horizontal grid lines overlay */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: "none",
                    zIndex: 1
                  }}>
                    {/* Hour lines (darker) */}
                    {timeSlots
                      .filter((slot) => slot.isHourStart)
                      .map((timeSlot) => (
                        <div
                          key={`hline-hour-${timeSlot.fullLabel}`}
                          style={{
                            position: "absolute",
                            left: 80, /* Start after the time column */
                            right: 0,
                            height: "1px",
                            backgroundColor: "#e2e8f0", // slate-200 - lighter gray
                            top: `${(((timeSlot.hour - 9) * 60) / 15) * 15}px`,
                            zIndex: 5
                          }}
                        />
                      ))}

                    {/* 15-minute interval lines (lighter) */}
                    {timeSlots
                      .filter((slot) => !slot.isHourStart)
                      .map((timeSlot) => (
                        <div
                          key={`hline-15min-${timeSlot.fullLabel}`}
                          style={{
                            position: "absolute",
                            left: 80, /* Start after the time column */
                            right: 0,
                            height: "1px",
                            backgroundColor: "#f1f5f9", // slate-100 - very light gray
                            opacity: 0.8, // subtle transparency
                            top: `${(((timeSlot.hour - 9) * 60 + timeSlot.minute) / 15) * 15}px`,
                            zIndex: 5
                          }}
                        />
                      ))}
                  </div>

                  {/* Time labels */}
                  <div className="relative">
                    {timeSlots
                      .filter((slot) => slot.isHourStart)
                      .map((timeSlot) => (
                        <div
                          key={timeSlot.fullLabel}
                          className="absolute h-[60px] w-full flex items-center justify-center"
                          style={{
                            top: `${(((timeSlot.hour - 9) * 60) / 15) * 15}px`,
                          }}
                        >
                          <span className="text-xs font-medium text-gray-600">{timeSlot.label}</span>
                        </div>
                      ))}
                  </div>

                  {/* Staff columns with appointments */}
                  {safeStaff.map((staff) => (
                    <div
                      key={staff.id}
                      className="relative min-h-[900px]"
                    >
                      {/* 15-minute interval grid lines */}
                      {timeSlots.map((timeSlot) => (
                        <div
                          key={timeSlot.fullLabel}
                          className="absolute w-full cursor-pointer transition-colors duration-100"
                          style={{
                            top: `${(((timeSlot.hour - 9) * 60 + timeSlot.minute) / 15) * 15}px`,
                            height: timeSlot.isHourStart ? "60px" : "15px",
                            backgroundColor: hoveredTimeSlot && hoveredTimeSlot.fullLabel === timeSlot.fullLabel
                              ? "rgba(0, 0, 0, 0.03)"
                              : "transparent",
                            zIndex: 1
                          }}
                          onMouseEnter={() => handleTimeSlotHover(timeSlot, staff.id)}
                          onMouseLeave={() => {
                            setHoveredTimeSlot(null)
                            setHoveredStaffId(null)
                          }}
                          onClick={() => handleTimeSlotClick(timeSlot, staff.id)}
                        >
                          {hoveredTimeSlot &&
                           hoveredTimeSlot.fullLabel === timeSlot.fullLabel &&
                           hoveredStaffId === staff.id && (
                            <div className="absolute right-2 top-0 bg-black text-white text-xs px-1 py-0.5 rounded">
                              {timeSlot.label}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Regular Hours Appointments */}
                      {todaysAppointments
                        .filter((appointment) =>
                          appointment.staffId === staff.id &&
                          !appointment.isEarlyHours &&
                          !appointment.isLateHours
                        )
                        .map((appointment) => {
                          const style = getAppointmentStyle(appointment)
                          const servicePrice = getServicePrice(appointment.service)
                          const isAdditionalService = appointment.isAdditionalService === true

                          return (
                            <div
                              key={appointment.id}
                              className={cn(
                                "absolute left-0 right-0 mx-1 p-2 rounded-sm border-l-4 cursor-pointer z-10 transition-all duration-300 overflow-hidden",
                                getAppointmentColor(appointment.service, appointment.status, appointment.type, appointment.isReflected),
                                appointment.justUpdated ? "animate-pulse shadow-lg ring-2 ring-white" : "",
                                isAdditionalService ? "border-dashed border opacity-90" : "",
                              )}
                              style={style}
                              onClick={() => {
                                // If it's an additional service, find and click the parent appointment instead
                                if (isAdditionalService && appointment.parentAppointmentId) {
                                  const parentAppointment = appointments.find(a => a.id === appointment.parentAppointmentId);
                                  if (parentAppointment) {
                                    handleAppointmentClick(parentAppointment);
                                    return;
                                  }
                                }
                                handleAppointmentClick(appointment);
                              }}
                            >
                              <div className="flex justify-between items-start mb-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1 min-w-0">
                                  {isAdditionalService ? (
                                    <span className="flex items-center truncate">
                                      <span className="mr-1 text-blue-600 flex-shrink-0">+</span>
                                      <span className="truncate">{getCleanClientName(appointment.clientName)} - {appointment.service}</span>
                                    </span>
                                  ) : (
                                    `${getCleanClientName(appointment.clientName)} - ${appointment.service}`
                                  )}
                                </div>
                                <div className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-90 border border-current font-medium flex-shrink-0 ml-1">
                                  {appointment.type === "blocked" ?
                                    "Blocked"
                                    : isAdditionalService ?
                                      "Add'l"
                                      : appointment.status ?
                                        appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).replace('-', ' ')
                                        : 'Pending'
                                  }
                                </div>
                              </div>
                              <div className="text-xs text-gray-700 dark:text-gray-300 mb-1 truncate">
                                {format(parseISO(appointment.date), "h:mm a")}
                                {(() => {
                                  if (!staff || !Array.isArray(staff)) return '';
                                  const staffMember = staff.find(s => s.id === appointment.staffId);
                                  return staffMember ? ` • ${getFirstName(staffMember.name)}` : '';
                                })()}
                              </div>
                              <div className="text-xs min-w-0 mb-1">
                                <div className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                  {appointment.service || 'Service not specified'}
                                </div>
                              </div>
                              <div className="text-xs min-w-0">
                                {isAdditionalService ? (
                                  <div className="italic text-blue-600 font-medium truncate">Additional: {appointment.service}</div>
                                ) : (
                                  <div className="space-y-1 min-w-0">
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center justify-between min-w-0">
                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                          {appointment.isReflected && (
                                            <span className="text-xs text-blue-600 font-medium" title={`Reflected appointment from ${appointment.reflectionType === 'physical-to-home' ? 'physical location' : 'home service'}`}>
                                              🔄
                                            </span>
                                          )}
                                          {appointment._isCrossLocationBlocking && (
                                            <span className="text-xs text-orange-600 font-medium" title="Cross-location blocking appointment">
                                              🏠
                                            </span>
                                          )}
                                        </div>
                                        {appointment.bookingReference && (
                                          <span className="text-xs text-pink-700 font-medium bg-pink-50 px-1.5 py-0.5 rounded truncate">
                                            #{appointment.bookingReference.split('-').pop()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {appointment.notes && (
                                      <div className="text-xs text-gray-500 italic truncate">
                                        {appointment.notes}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                <span>
                                  {format(parseISO(appointment.date), "h:mm")} -
                                  {format(
                                    new Date(parseISO(appointment.date).getTime() + appointment.duration * 60000),
                                    "h:mm a",
                                  )}
                                </span>
                              </div>
                              {isAdditionalService && (
                                <div className="text-xs text-gray-500 mt-1 italic truncate">
                                  Additional service
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  ))}
                </div>

                {/* Late Hours Section */}
                <div
                  style={{
                    gridColumn: `1 / span ${safeStaff.length + 1}`,
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${safeStaff.length}, 1fr)`,
                    position: "relative",
                    borderTop: "1px solid #e2e8f0"
                  }}
                >
                  {/* Late Hours Label */}
                  <div className="p-2 bg-purple-50">
                    <span className="text-xs font-medium text-purple-800">After 12 AM</span>
                  </div>

                  {/* Late Hours Appointments by Staff */}
                  {safeStaff.map((staff) => {
                    // Get late hours appointments for this staff
                    const lateAppointments = todaysAppointments.filter(
                      (appointment) => appointment.staffId === staff.id && appointment.isLateHours
                    );

                    // Sort late appointments by time
                    const sortedLateAppointments = [...lateAppointments].sort((a, b) =>
                      parseISO(a.date).getTime() - parseISO(b.date).getTime()
                    );

                    return (
                      <div
                        key={`late-${staff.id}`}
                        className="p-2 bg-purple-50 min-h-[40px] relative cursor-pointer"
                        onClick={() => {
                          // Create a time slot for 12:30 AM when clicking on the late hours section
                          const lateTimeSlot = {
                            hour: 0,
                            minute: 30,
                            label: "12:30 AM",
                            fullLabel: "00:30"
                          };
                          handleTimeSlotClick(lateTimeSlot, staff.id);
                        }}
                      >
                        {/* Empty state indicator */}
                        {sortedLateAppointments.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-purple-300 opacity-30 hover:opacity-50 transition-opacity">
                              <Plus size={16} />
                            </div>
                          </div>
                        )}

                        {sortedLateAppointments.length > 0 && (
                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {sortedLateAppointments.map((appointment) => {
                              const appointmentDate = parseISO(appointment.date);
                              const servicePrice = getServicePrice(appointment.service);
                              const isAdditionalService = appointment.isAdditionalService === true;

                              return (
                                <div
                                  key={appointment.id}
                                  className={cn(
                                    "p-1 rounded-sm border-l-4 cursor-pointer text-xs overflow-hidden",
                                    getAppointmentColor(appointment.service, appointment.status, appointment.type, appointment.isReflected),
                                    isAdditionalService ? "border-dashed border opacity-90" : "",
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent triggering the parent div's onClick
                                    handleAppointmentClick(appointment);
                                  }}
                                >
                                  <div className="font-medium flex justify-between items-start min-w-0">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                        {getCleanClientName(appointment.clientName)} - {appointment.service}
                                      </div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                        {format(appointmentDate, "h:mm a")} • {appointment.duration || 30}min
                                        {(() => {
                                          if (!staff || !Array.isArray(staff)) return '';
                                          const staffMember = staff.find(s => s.id === appointment.staffId);
                                          return staffMember ? ` • ${getFirstName(staffMember.name)}` : '';
                                        })()}
                                      </div>
                                      {appointment.bookingReference && (
                                        <div className="text-xs text-pink-600 dark:text-pink-400 font-medium truncate">
                                          Ref: {appointment.bookingReference}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-90 border border-current font-medium flex-shrink-0">
                                        {appointment.status ?
                                          appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).replace('-', ' ')
                                          : 'Pending'
                                        }
                                      </span>
                                      {appointment.bookingReference && (
                                        <div className="text-xs text-pink-700 font-medium bg-pink-50 px-1 py-0.5 rounded mt-1 truncate">
                                          #{appointment.bookingReference.split('-').pop()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs mt-2 font-medium text-gray-800 dark:text-gray-200 truncate">
                                    {appointment.service || 'Service not specified'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Week View */}
          {viewType === "week" && safeStaff.length > 0 && (
            <div className="border rounded-md overflow-hidden shadow-sm">
              <div style={{
                display: "grid",
                gridTemplateColumns: `180px repeat(7, 1fr)`,
                position: "relative"
              }}>
                {/* Vertical grid lines overlay - ensures perfectly straight lines */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "grid",
                  gridTemplateColumns: `180px repeat(7, 1fr)`,
                  pointerEvents: "none",
                  zIndex: 2
                }}>
                  {/* First vertical line */}
                  <div style={{
                    borderRight: "1px solid #e2e8f0", // slate-200 - lighter gray
                    height: "100%",
                    gridColumn: "1 / span 1"
                  }}></div>

                  {/* Day column vertical lines */}
                  {Array(7).fill(0).map((_, index) => (
                    <div
                      key={`vline-week-${index}`}
                      style={{
                        borderRight: index < 6 ? "1px solid #e2e8f0" : "none", // slate-200 - lighter gray
                        height: "100%",
                        gridColumn: `${index + 2} / span 1`
                      }}
                    ></div>
                  ))}
                </div>
                {/* Top-left empty cell */}
                <div className="bg-gray-50 border-b p-3 flex items-center justify-center"
                  style={{ borderBottom: "1px solid #d1d5db", borderRight: "1px solid #d1d5db" }}>
                  <div className="text-sm font-medium text-gray-500">Staff / Time</div>
                </div>

                {/* Header row with days of the week */}
                {eachDayOfInterval({ start: startOfWeek(date), end: endOfWeek(date) }).map((day, index) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "bg-gray-50 p-3 text-center",
                      isSameDay(day, new Date()) ? "bg-blue-100" : ""
                    )}
                    style={{
                      borderBottom: "1px solid #d1d5db"
                    }}
                  >
                    <div className="text-sm font-medium">{format(day, "EEE")}</div>
                    <div className="text-lg font-bold">{format(day, "d")}</div>
                    <div className="text-xs text-gray-500">{format(day, "MMM yyyy")}</div>
                  </div>
                ))}

                {/* Staff rows with appointment cells */}
                {safeStaff.map((staff, staffIndex) => (
                  <React.Fragment key={staff.id}>
                    {/* Staff name column */}
                    <div className="bg-gray-50 p-3"
                      style={{
                        borderBottom: "1px solid #d1d5db"
                      }}>
                      <div
                        className={cn(
                          "flex flex-col items-center gap-2 cursor-pointer transition-all",
                          staffFilter === staff.id ? "bg-blue-50 p-2 rounded-lg shadow-sm" : "hover:bg-gray-100 p-2 rounded-lg"
                        )}
                        onClick={() => {
                          if (staffFilter === staff.id) {
                            // If already filtered by this staff, clear the filter
                            setStaffFilter(null);
                          } else {
                            // Set filter to this staff
                            setStaffFilter(staff.id);
                          }
                        }}
                      >
                        <StaffAvatar
                          staff={staff}
                          size="md"
                          className="shadow-sm"
                        />
                        <div className="text-sm font-medium">{getFirstName(staff.name)}</div>
                        {staffFilter === staff.id && (
                          <div className="text-xs text-blue-600 mt-1 flex items-center">
                            <span>Showing only</span>
                            <X className="h-3 w-3 ml-1 cursor-pointer" onClick={(e) => {
                              e.stopPropagation();
                              setStaffFilter(null);
                            }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Day cells for this staff member */}
                    {eachDayOfInterval({ start: startOfWeek(date), end: endOfWeek(date) }).map((day, dayIndex) => {
                      const dayAppointments = filteredAppointments.filter(appointment =>
                        isSameDay(parseISO(appointment.date), day) && appointment.staffId === staff.id
                      );

                      // Sort appointments by time
                      const sortedAppointments = [...dayAppointments].sort((a, b) =>
                        parseISO(a.date).getTime() - parseISO(b.date).getTime()
                      );

                      // Separate out-of-hours appointments
                      const earlyAppointments = sortedAppointments.filter(a => a.isEarlyHours);
                      const regularAppointments = sortedAppointments.filter(a => !a.isEarlyHours && !a.isLateHours);
                      const lateAppointments = sortedAppointments.filter(a => a.isLateHours);

                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "p-3 relative min-h-[120px]",
                            isSameDay(day, new Date()) ? "bg-blue-50/20" : ""
                          )}
                          style={{
                            borderBottom: "1px solid #d1d5db"
                          }}
                          onClick={() => {
                            // Default to 10:00 AM when clicking on an empty cell
                            handleTimeSlotClick({
                              hour: 10,
                              minute: 0,
                              label: "10:00 AM"
                            }, staff.id, day);
                          }}
                        >
                          {/* Empty state - show subtle "+" icon to indicate clickable */}
                          {sortedAppointments.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-gray-300 opacity-30 hover:opacity-50 transition-opacity">
                                <Plus size={24} />
                              </div>
                            </div>
                          )}

                          {/* Quick access buttons for early/late hours when no appointments exist */}
                          {sortedAppointments.length === 0 && (
                            <div className="absolute top-1 right-1 flex space-x-1">
                              {/* Early hours button */}
                              <button
                                className="bg-blue-100 text-blue-600 p-1 rounded-full hover:bg-blue-200 transition-colors"
                                title="Add early appointment (before 9 AM)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Create a time slot for 7:00 AM
                                  const earlyTimeSlot = {
                                    hour: 7,
                                    minute: 0,
                                    label: "7:00 AM",
                                    fullLabel: "07:00",
                                    day: day
                                  };
                                  handleTimeSlotClick(earlyTimeSlot, staff.id, day);
                                }}
                              >
                                <span className="sr-only">Add early appointment</span>
                                <Clock size={12} />
                              </button>

                              {/* Late hours button */}
                              <button
                                className="bg-purple-100 text-purple-600 p-1 rounded-full hover:bg-purple-200 transition-colors"
                                title="Add late appointment (after 12 AM)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Create a time slot for 12:30 AM
                                  const lateTimeSlot = {
                                    hour: 0,
                                    minute: 30,
                                    label: "12:30 AM",
                                    fullLabel: "00:30",
                                    day: day
                                  };
                                  handleTimeSlotClick(lateTimeSlot, staff.id, day);
                                }}
                              >
                                <span className="sr-only">Add late appointment</span>
                                <Moon size={12} />
                              </button>
                            </div>
                          )}

                          {/* Early hours section - only shown when there are appointments */}
                          {earlyAppointments.length > 0 && (
                            <div
                              className="mb-2 bg-blue-50 rounded border border-blue-100 cursor-pointer relative overflow-hidden"
                            >
                              {/* Header with toggle */}
                              <div
                                className="p-1 flex justify-between items-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEarlyHoursExpanded(!earlyHoursExpanded);
                                }}
                              >
                                <div className="text-xs font-medium text-blue-800">
                                  Before 9 AM ({earlyAppointments.length}):
                                </div>
                                <button
                                  className="text-blue-500 hover:text-blue-700 focus:outline-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEarlyHoursExpanded(!earlyHoursExpanded);
                                  }}
                                >
                                  {earlyHoursExpanded ?
                                    <ChevronUp size={14} /> :
                                    <ChevronDown size={14} />
                                  }
                                </button>
                              </div>

                              {/* Expanded content */}
                              {earlyHoursExpanded ? (
                                <div className="px-1 pb-1">
                                  <div className="space-y-1 max-h-[150px] overflow-y-auto">
                                    {earlyAppointments.map((appointment) => {
                                      const appointmentDate = parseISO(appointment.date);
                                      const isAdditionalService = appointment.isAdditionalService === true;

                                      return (
                                        <div
                                          key={appointment.id}
                                          className={cn(
                                            "p-1 rounded-sm border-l-4 cursor-pointer text-xs",
                                            getAppointmentColor(appointment.service, appointment.status, appointment.type, appointment.isReflected),
                                            isAdditionalService ? "border-dashed border opacity-90" : "",
                                          )}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAppointmentClick(appointment);
                                          }}
                                        >
                                          <div className="font-medium flex justify-between">
                                            <span>{format(appointmentDate, "h:mm a")}</span>
                                            <span className="text-xs px-1 py-0.5 rounded-full bg-white bg-opacity-80 border border-current ml-1">
                                              {appointment.status ?
                                                appointment.status.charAt(0).toUpperCase().substring(0, 1)
                                                : 'P'
                                              }
                                            </span>
                                          </div>
                                          <div className="text-xs truncate">
                                            {getCleanClientName(appointment.clientName)} - {appointment.service}
                                            {(() => {
                                              if (!staff || !Array.isArray(staff)) return '';
                                              const staffMember = staff.find(s => s.id === appointment.staffId);
                                              return staffMember ? ` • ${getFirstName(staffMember.name)}` : '';
                                            })()}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="px-1 pb-1">
                                  <div className="text-xs text-blue-600 flex items-center justify-center">
                                    <span>{earlyAppointments.length} appointment{earlyAppointments.length > 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Regular hours appointments */}
                          <div className="space-y-2">
                            {regularAppointments.map((appointment) => {
                              const appointmentDate = parseISO(appointment.date);
                              const servicePrice = getServicePrice(appointment.service);

                              const isAdditionalService = appointment.isAdditionalService === true;

                              return (
                                <div
                                  key={appointment.id}
                                  className={cn(
                                    "p-2 rounded-md border-l-4 cursor-pointer transition-all shadow-sm hover:shadow overflow-hidden",
                                    getAppointmentColor(appointment.service, appointment.status, appointment.type, appointment.isReflected),
                                    isAdditionalService ? "border-dashed border opacity-90" : "",
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent triggering the parent div's onClick

                                    // If it's an additional service, find and click the parent appointment instead
                                    if (isAdditionalService && appointment.parentAppointmentId) {
                                      const parentAppointment = appointments.find(a => a.id === appointment.parentAppointmentId);
                                      if (parentAppointment) {
                                        handleAppointmentClick(parentAppointment);
                                        return;
                                      }
                                    }
                                    handleAppointmentClick(appointment);
                                  }}
                                >
                                  <div className="flex justify-between items-start min-w-0">
                                    <div className="text-sm font-medium truncate flex-1 min-w-0">
                                      {isAdditionalService ? (
                                        <span className="flex items-center truncate">
                                          <span className="mr-1 flex-shrink-0">+</span>
                                          <span className="truncate">{format(appointmentDate, "h:mm a")}</span>
                                        </span>
                                      ) : (
                                        <span className="truncate">
                                          {format(appointmentDate, "h:mm a")}
                                          {(() => {
                                            if (!staff || !Array.isArray(staff)) return '';
                                            const staffMember = staff.find(s => s.id === appointment.staffId);
                                            return staffMember ? ` • ${getFirstName(staffMember.name)}` : '';
                                          })()}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs px-1.5 py-0.5 rounded-full bg-white bg-opacity-80 border border-current flex-shrink-0 ml-1">
                                      {appointment.type === "blocked" ?
                                        "Blk"
                                        : isAdditionalService ?
                                          "Add"
                                          : appointment.status ?
                                            appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).replace('-', ' ').substring(0, 3)
                                            : 'Pen'
                                      }
                                    </div>
                                  </div>
                                  <div className="text-xs mt-1 min-w-0">
                                    {isAdditionalService ? (
                                      <span className="italic truncate">{appointment.service}</span>
                                    ) : (
                                      <div className="space-y-1 min-w-0">
                                        <div className="font-medium truncate">
                                          {appointment.service || 'Service not specified'}
                                        </div>
                                        <div className="flex items-center justify-between min-w-0">
                                          <div className="flex items-center flex-shrink-0">
                                            {appointment.isReflected && (
                                              <span className="text-xs text-blue-600 font-medium mr-1" title={`Reflected appointment from ${appointment.reflectionType === 'physical-to-home' ? 'physical location' : 'home service'}`}>
                                                🔄
                                              </span>
                                            )}
                                            {appointment._isCrossLocationBlocking && (
                                              <span className="text-xs text-orange-600 font-medium mr-1" title="Cross-location blocking appointment">
                                                🏠
                                              </span>
                                            )}
                                          </div>
                                          {appointment.bookingReference && (
                                            <span className="text-xs text-pink-700 font-medium truncate">
                                              #{appointment.bookingReference.split('-').pop()}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {isAdditionalService && (
                                    <div className="text-xs text-gray-500 mt-1 italic truncate">
                                      Add'l service
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Late hours section - only shown when there are appointments */}
                          {lateAppointments.length > 0 && (
                            <div
                              className="mt-2 bg-purple-50 rounded border border-purple-100 cursor-pointer relative overflow-hidden"
                            >
                              {/* Header with toggle */}
                              <div
                                className="p-1 flex justify-between items-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLateHoursExpanded(!lateHoursExpanded);
                                }}
                              >
                                <div className="text-xs font-medium text-purple-800">
                                  After 12 AM ({lateAppointments.length}):
                                </div>
                                <button
                                  className="text-purple-500 hover:text-purple-700 focus:outline-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLateHoursExpanded(!lateHoursExpanded);
                                  }}
                                >
                                  {lateHoursExpanded ?
                                    <ChevronUp size={14} /> :
                                    <ChevronDown size={14} />
                                  }
                                </button>
                              </div>

                              {/* Expanded content */}
                              {lateHoursExpanded ? (
                                <div className="px-1 pb-1">
                                  <div className="space-y-1 max-h-[150px] overflow-y-auto">
                                    {lateAppointments.map((appointment) => {
                                      const appointmentDate = parseISO(appointment.date);
                                      const isAdditionalService = appointment.isAdditionalService === true;

                                      return (
                                        <div
                                          key={appointment.id}
                                          className={cn(
                                            "p-1 rounded-sm border-l-4 cursor-pointer text-xs",
                                            getAppointmentColor(appointment.service, appointment.status, appointment.type, appointment.isReflected),
                                            isAdditionalService ? "border-dashed border opacity-90" : "",
                                          )}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAppointmentClick(appointment);
                                          }}
                                        >
                                          <div className="font-medium flex justify-between">
                                            <span>{format(appointmentDate, "h:mm a")}</span>
                                            <span className="text-xs px-1 py-0.5 rounded-full bg-white bg-opacity-80 border border-current ml-1">
                                              {appointment.status ?
                                                appointment.status.charAt(0).toUpperCase().substring(0, 1)
                                                : 'P'
                                              }
                                            </span>
                                          </div>
                                          <div className="text-xs truncate">
                                            {getCleanClientName(appointment.clientName)} - {appointment.service}
                                            {(() => {
                                              if (!staff || !Array.isArray(staff)) return '';
                                              const staffMember = staff.find(s => s.id === appointment.staffId);
                                              return staffMember ? ` • ${getFirstName(staffMember.name)}` : '';
                                            })()}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="px-1 pb-1">
                                  <div className="text-xs text-purple-600 flex items-center justify-center">
                                    <span>{lateAppointments.length} appointment{lateAppointments.length > 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Month View */}
          {viewType === "month" && safeStaff.length > 0 && (
            <div className="border rounded-md overflow-hidden shadow-sm">
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                position: "relative"
              }}>
                {/* Vertical grid lines overlay - ensures perfectly straight lines */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  pointerEvents: "none",
                  zIndex: 2
                }}>
                  {/* Day column vertical lines */}
                  {Array(7).fill(0).map((_, index) => (
                    <div
                      key={`vline-month-${index}`}
                      style={{
                        borderRight: index < 6 ? "1px solid #e2e8f0" : "none", // slate-200 - lighter gray
                        height: "100%",
                        gridColumn: `${index + 1} / span 1`
                      }}
                    ></div>
                  ))}
                </div>
                {/* Header row with days of the week */}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, index) => (
                  <div
                    key={dayName}
                    className="bg-gray-50 p-2 text-center font-medium"
                    style={{
                      borderBottom: "1px solid #d1d5db"
                    }}
                  >
                    {dayName}
                  </div>
                ))}

                {/* Calendar grid */}
                {(() => {
                  const monthStart = startOfMonth(date);
                  const monthEnd = endOfMonth(date);
                  const startDate = startOfWeek(monthStart);
                  const endDate = endOfWeek(monthEnd);

                  const days = eachDayOfInterval({ start: startDate, end: endDate });

                  return days.map((day) => {
                    const dayAppointments = filteredAppointments.filter(appointment =>
                      isSameDay(parseISO(appointment.date), day)
                    );

                    // Separate out-of-hours appointments
                    const earlyAppointments = dayAppointments.filter(a => a.isEarlyHours);
                    const regularAppointments = dayAppointments.filter(a => !a.isEarlyHours && !a.isLateHours);
                    const lateAppointments = dayAppointments.filter(a => a.isLateHours);

                    // Flag to indicate if there are out-of-hours appointments
                    const hasOutOfHoursAppointments = earlyAppointments.length > 0 || lateAppointments.length > 0;

                    const isCurrentMonth = isSameMonth(day, date);

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "p-1 min-h-[100px] relative cursor-pointer",
                          !isCurrentMonth ? "bg-gray-50" : "",
                          isSameDay(day, new Date()) ? "bg-blue-50" : "",
                          "hover:bg-gray-50 transition-colors"
                        )}
                        style={{
                          borderBottom: "1px solid #d1d5db"
                        }}
                        onClick={() => {
                          // Default to 10:00 AM when clicking on a day cell
                          handleTimeSlotClick({
                            hour: 10,
                            minute: 0,
                            label: "10:00 AM"
                          }, staffFilter || safeStaff[0]?.id, day);
                        }}
                      >
                        <div className={cn(
                          "text-right mb-1",
                          !isCurrentMonth ? "text-gray-400" : "font-medium"
                        )}>
                          {getDate(day)}
                        </div>

                        <div className="space-y-1 max-h-[80px] overflow-y-auto">
                          {dayAppointments.length > 0 ? (
                            dayAppointments
                              .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
                              .slice(0, 3) // Show only first 3 appointments
                              .map((appointment) => (
                                <div
                                  key={appointment.id}
                                  className={cn(
                                    "px-1 py-0.5 text-xs rounded cursor-pointer truncate border-l-2",
                                    getAppointmentColor(appointment.service, appointment.status, appointment.type, appointment.isReflected).replace("border-l-4", "border-l-2"),
                                    appointment.isAdditionalService ? "border-dashed opacity-90" : ""
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent triggering the parent div's onClick

                                    // If it's an additional service, find and click the parent appointment instead
                                    if (appointment.isAdditionalService && appointment.parentAppointmentId) {
                                      const parentAppointment = appointments.find(a => a.id === appointment.parentAppointmentId);
                                      if (parentAppointment) {
                                        handleAppointmentClick(parentAppointment);
                                        return;
                                      }
                                    }
                                    handleAppointmentClick(appointment);
                                  }}
                                >
                                  <div className="space-y-0.5">
                                    <div className="truncate">
                                      {format(parseISO(appointment.date), "h:mm")} - {appointment.isAdditionalService ? "+ " : ""}{getCleanClientName(appointment.clientName)} - {appointment.service || 'Service not specified'}
                                      {(() => {
                                        if (!staff || !Array.isArray(staff)) return '';
                                        const staffMember = staff.find(s => s.id === appointment.staffId);
                                        return staffMember ? ` • ${getFirstName(staffMember.name)}` : '';
                                      })()}
                                      {appointment.bookingReference && ` • Ref: ${appointment.bookingReference}`}
                                    </div>
                                  </div>
                                </div>
                              ))
                          ) : (
                            // Empty state - show subtle "+" icon to indicate clickable
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-gray-300 opacity-30 hover:opacity-50 transition-opacity">
                                <Plus size={24} />
                              </div>
                            </div>
                          )}

                          {dayAppointments.length > 3 && (
                            <div className="text-xs text-center text-gray-500">
                              +{dayAppointments.length - 3} more
                            </div>
                          )}

                          {/* Out-of-hours indicator */}
                          {hasOutOfHoursAppointments && (
                            <div className="mt-1 flex justify-center">
                              {earlyAppointments.length > 0 && (
                                <div className="text-xs px-1 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-100 mr-1">
                                  {earlyAppointments.length} early
                                </div>
                              )}
                              {lateAppointments.length > 0 && (
                                <div className="text-xs px-1 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-100">
                                  {lateAppointments.length} late
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {/* Booking Summary Tab Content */}
      {viewMode === "summary" && (
        <EnhancedBookingSummary
          appointments={appointments}
          onBookingUpdate={handleBookingUpdate}
        />
      )}

      {/* Time Slot Action Dialog */}
      {selectedTimeSlot && (
        <TimeSlotActionDialog
          open={isTimeSlotActionDialogOpen}
          onOpenChange={setIsTimeSlotActionDialogOpen}
          timeSlot={selectedTimeSlot}
          onAction={handleTimeSlotAction}
        />
      )}

      {/* New Appointment Dialog */}
      <NewAppointmentDialogV2
        open={isNewAppointmentDialogOpen}
        onOpenChange={setIsNewAppointmentDialogOpen}
        initialDate={date}
        initialTime={newAppointmentTime}
        initialStaffId={newAppointmentStaffId}
        onAppointmentCreated={handleAppointmentCreated}
        appointments={filteredAppointments}
      />

      {/* Group Appointment Dialog */}
      <GroupAppointmentDialog
        open={isGroupAppointmentDialogOpen}
        onOpenChange={setIsGroupAppointmentDialogOpen}
        initialDate={date}
        initialTime={newAppointmentTime}
        initialStaffId={newAppointmentStaffId}
        onAppointmentCreated={handleAppointmentCreated}
      />

      {/* Blocked Time Dialog */}
      <BlockedTimeDialog
        open={isBlockedTimeDialogOpen}
        onOpenChange={setIsBlockedTimeDialogOpen}
        initialDate={date}
        initialTime={newAppointmentTime}
        initialStaffId={newAppointmentStaffId}
        onBlockCreated={handleAppointmentCreated}
      />
    </div>
  )
}

