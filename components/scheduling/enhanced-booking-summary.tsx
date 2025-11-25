"use client"

import { useState, useEffect, useRef } from "react"
import { format, parseISO } from "date-fns"
import { ChevronDown, ChevronRight, Clock, MapPin, CalendarIcon, CheckCircle, ShoppingBag, Scissors, User, Clock as Clock3, CreditCard, Banknote, X, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// DEPRECATED: Mock data removed - now using real API data
import { useStaff } from "@/lib/staff-provider"
import { getFirstName } from "@/lib/female-avatars"
import { useServices } from "@/lib/service-provider"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { useLocations } from "@/lib/location-provider"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { AddServiceDialog } from "./add-service-dialog"
import { AddProductDialog } from "./add-product-dialog"
import { PaymentDialog } from "@/components/pos/payment-dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useTransactions } from "@/lib/transaction-provider"
import { PaymentMethod } from "@/lib/transaction-types"
import { ConsolidatedTransactionService } from "@/lib/consolidated-transaction-service"
import { printReceipt } from "@/components/accounting/receipt-printer.ts"
import { Transaction } from "@/lib/transaction-types"
import { generateSequentialTransactionId } from "@/lib/transaction-utils"

interface BookingItem {
  id: string
  type: "service" | "product"
  name: string
  price: number
  staff?: string
  staffId?: string
  duration?: number
  quantity?: number
  unitPrice?: number
  completed?: boolean
}

interface EnhancedBooking {
  id: string
  clientId: string
  clientName: string
  clientEmail: string
  staffId: string
  staffName: string
  date: string
  location: string
  locationName: string
  status: "confirmed" | "arrived" | "service-started" | "completed" | "cancelled" | "no-show"
  items: BookingItem[]
  paymentStatus?: "paid" | "unpaid" | "partial"
  paymentMethod?: string
  paymentDate?: string
  // Discount information
  discountPercentage?: number
  discountAmount?: number
  originalAmount?: number
  finalAmount?: number
  notes?: string
  statusHistory?: Array<{
    status: string
    timestamp: string
    updatedBy?: string
  }>
}

// We now use the getLocationName function from the useLocations hook

// Convert appointments to enhanced bookings with items
// This function needs to be called with the getLocationName function, staff data, and services data
const getEnhancedBookings = (appointments: any[] = [], locationNameFn: (id: string) => string, staffData: any[] = [], servicesData: any[] = []) => {
  // Filter out reflected appointments (blocking appointments) from booking summary
  const nonReflectedAppointments = appointments.filter(appointment => !appointment.isReflected)

  return nonReflectedAppointments.map((appointment) => {
    // Handle blocked time entries differently
    if (appointment.type === "blocked") {
      // For blocked time, create a simplified booking with minimal information
      return {
        id: appointment.id,
        clientId: "blocked",
        clientName: appointment.title || "Blocked Time",
        clientEmail: "blocked@example.com",
        staffId: appointment.staffId || "",
        staffName: appointment.staffName || "Staff",
        date: appointment.date,
        location: appointment.location || "loc1",
        locationName: locationNameFn(appointment.location || "loc1"),
        status: "confirmed" as const,
        items: [{
          id: `item-${appointment.id}-blocked`,
          type: "service" as const,
          name: appointment.blockType ? `${appointment.blockType} Time` : "Blocked Time",
          price: 0,
          duration: appointment.duration || 30,
        }],
        notes: appointment.notes,
        statusHistory: appointment.statusHistory,
      } as EnhancedBooking;
    }

    // Regular appointment processing
    // Find the service details from real service data
    // Use the services data passed as parameter
    const realServices = servicesData || []
    const service = realServices.find((s) =>
      s.name === appointment.service ||
      s.name.toLowerCase() === appointment.service?.toLowerCase()
    ) // Removed fallback to mock services

    // Debug logging for service lookup
    if (!service) {
      console.warn(`🔍 BOOKING SUMMARY: Service not found for "${appointment.service}"`)
      console.log('Available real services:', realServices.map(s => s.name))
    } else {
      console.log(`✅ BOOKING SUMMARY: Found service "${service.name}" with price ${service.price}`)
    }

    // Create the main service item
    const mainServiceItem: BookingItem = {
      id: `item-${appointment.id}-1`,
      type: "service",
      name: appointment.service,
      price: service?.price || 0,
      staff: appointment.staffName,
      staffId: appointment.staffId,
      duration: appointment.duration,
      completed: appointment.staffServiceCompleted || false,
    }

    // Initialize items array with the main service
    const allItems: BookingItem[] = [mainServiceItem];

    // Add any additional services from the appointment
    if (appointment.additionalServices && appointment.additionalServices.length > 0) {
      appointment.additionalServices.forEach((additionalService: any, index: number) => {
        allItems.push({
          id: additionalService.id || `item-${appointment.id}-service-${index + 2}`,
          type: "service",
          name: additionalService.name,
          price: additionalService.price,
          staff: additionalService.staffName,
          staffId: additionalService.staffId,
          duration: additionalService.duration,
          completed: additionalService.completed || false,
        });
      });
    }

    // Add any products from the appointment
    if (appointment.products && appointment.products.length > 0) {
      appointment.products.forEach((product: any, index: number) => {
        allItems.push({
          id: `item-${appointment.id}-prod-${index}`,
          type: "product",
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
        });
      });
    }

    // If no additional services or products, add some random ones for demo purposes
    if (!appointment.additionalServices && !appointment.products) {
      // Create random additional items for demo purposes
      const additionalItems: BookingItem[] = []

      // Add 0-2 additional services
      if (Math.random() > 0.5 && staffData.length > 0) {
        const availableServices = realServices
        const additionalService = availableServices[Math.floor(Math.random() * availableServices.length)]
        const randomStaff = staffData[Math.floor(Math.random() * staffData.length)]
        additionalItems.push({
          id: `item-${appointment.id}-2`,
          type: "service",
          name: additionalService.name,
          price: additionalService.price,
          staff: randomStaff.name,
          staffId: randomStaff.id,
          duration: additionalService.duration,
          completed: false,
        })
      }

      // Add 0-3 products
      const productCount = Math.floor(Math.random() * 3)
      const productNames = ["Shampoo", "Conditioner", "Hair Spray", "Styling Gel", "Hair Mask"]
      const productPrices = [24.99, 19.99, 15.99, 12.99, 29.99]

      for (let i = 0; i < productCount; i++) {
        const idx = Math.floor(Math.random() * productNames.length)
        additionalItems.push({
          id: `item-${appointment.id}-prod-${i}`,
          type: "product",
          name: productNames[idx],
          price: productPrices[idx],
          quantity: 1,
          unitPrice: productPrices[idx],
        })
      }

      // Add the random items to the allItems array
      allItems.push(...additionalItems);
    }

    // Map the status
    let mappedStatus: "confirmed" | "arrived" | "service-started" | "completed" | "cancelled" | "no-show"
    switch (appointment.status) {
      case "pending":
        mappedStatus = "confirmed" // Treat pending as confirmed for display purposes
        break
      case "confirmed":
        mappedStatus = "confirmed"
        break
      case "arrived":
        mappedStatus = "arrived"
        break
      case "service-started":
        mappedStatus = "service-started"
        break
      case "completed":
        mappedStatus = "completed"
        break
      case "cancelled":
        mappedStatus = "cancelled"
        break
      case "no-show":
        mappedStatus = "no-show"
        break
      default:
        mappedStatus = "confirmed"
    }

    const enhancedBooking = {
      id: appointment.id,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      clientEmail: appointment.clientEmail || (appointment.clientName && typeof appointment.clientName === 'string'
        ? `${appointment.clientName.toLowerCase().replace(/\s+/g, ".")}@example.com`
        : "client@example.com"),
      staffId: appointment.staffId,
      staffName: appointment.staffName,
      date: appointment.date,
      location: appointment.location,
      locationName: locationNameFn(appointment.location),
      status: mappedStatus,
      items: allItems,
      // Preserve payment information if it exists in the original appointment
      paymentStatus: appointment.paymentStatus,
      paymentMethod: appointment.paymentMethod,
      paymentDate: appointment.paymentDate,
      // Include discount information if it exists
      discountPercentage: appointment.discountPercentage,
      discountAmount: appointment.discountAmount,
      originalAmount: appointment.originalAmount,
      finalAmount: appointment.finalAmount,
      // Include notes from the appointment
      notes: appointment.notes,
      // Include status history if it exists
      statusHistory: appointment.statusHistory
    } as EnhancedBooking;

    // Debug payment status mapping for paid appointments
    if (appointment.paymentStatus === "paid") {
      console.log("💳 getEnhancedBookings: Mapping paid appointment", {
        appointmentId: appointment.id,
        clientName: appointment.clientName,
        paymentStatus: appointment.paymentStatus,
        paymentMethod: appointment.paymentMethod
      });
    }

    return enhancedBooking;
  })
}

interface EnhancedBookingSummaryProps {
  appointments?: any[]
  onBookingUpdate?: (updatedBooking: any) => void
}

export function EnhancedBookingSummary({
  appointments = [],
  onBookingUpdate,
}: EnhancedBookingSummaryProps) {
  const { toast } = useToast()
  const { user, currentLocation, setCurrentLocation, hasPermission } = useAuth()
  const { getLocationName } = useLocations()
  const { staff } = useStaff()
  const { services } = useServices()
  const { addTransaction } = useTransactions()
  const [bookings, setBookings] = useState<EnhancedBooking[]>([])
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("confirmed")
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  // Debug log to verify we're using staff data from API/database
  useEffect(() => {
    console.log("EnhancedBookingSummary - Using staff from API/database");
    console.log("EnhancedBookingSummary - Total Staff Count:", staff.length);
    console.log("EnhancedBookingSummary - Staff Names:", staff.map(s => s.name));

    // Verify we have the expected number of staff members (should be 20)
    if (staff.length === 0) {
      console.warn("⚠️ EnhancedBookingSummary - No staff data found! Check API connection.");
    } else if (staff.length !== 20) {
      console.warn(`⚠️ EnhancedBookingSummary - Expected 20 staff members, found ${staff.length}. Check database.`);
    } else {
      console.log("✅ EnhancedBookingSummary - Using correct number of staff members (20)");
    }
  }, [staff.length])

  // Add a ref to track if an update is in progress to prevent infinite loops
  const isUpdatingRef = useRef(false)

  // Check if user has admin or manager privileges
  const hasAdminPrivileges = (): boolean => {
    // Check if user has permission to edit appointments
    return hasPermission("edit_appointment");
  }

  // Dialog states
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false)
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [bookingForPayment, setBookingForPayment] = useState<EnhancedBooking | null>(null)
  const [currentBooking, setCurrentBooking] = useState<any | null>(null)

  // Initialize bookings when appointments change
  useEffect(() => {
    // Skip update if we're already in the middle of updating
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false
      return
    }

    // Compare current bookings with new ones to avoid unnecessary updates
    const newBookings = getEnhancedBookings(appointments, getLocationName, staff, services)

    // Only update if the bookings have actually changed
    // This prevents unnecessary re-renders
    setBookings(prevBookings => {
      // Simple length check as a first filter
      if (prevBookings.length !== newBookings.length) {
        console.log("📊 EnhancedBookingSummary: Bookings length changed", {
          oldLength: prevBookings.length,
          newLength: newBookings.length
        });
        return newBookings
      }

      // Check if any booking has changed by comparing IDs, status, and payment status
      const hasChanged = newBookings.some((newBooking, index) => {
        const prevBooking = prevBookings[index]
        const changed = !prevBooking ||
               prevBooking.id !== newBooking.id ||
               prevBooking.status !== newBooking.status ||
               prevBooking.paymentStatus !== newBooking.paymentStatus;

        if (changed && prevBooking && prevBooking.paymentStatus !== newBooking.paymentStatus) {
          console.log("💰 EnhancedBookingSummary: Payment status changed for booking", {
            bookingId: newBooking.id,
            clientName: newBooking.clientName,
            oldPaymentStatus: prevBooking.paymentStatus,
            newPaymentStatus: newBooking.paymentStatus
          });
        }

        return changed;
      })

      if (hasChanged) {
        console.log("🔄 EnhancedBookingSummary: Bookings updated due to changes");
      }

      return hasChanged ? newBookings : prevBookings
    })
  }, [appointments, getLocationName, staff, services])

  // Filter bookings by location and status
  const filterBookingsByLocation = (bookings: EnhancedBooking[]) => {
    if (currentLocation === "all") {
      return bookings;
    }

    // Special handling for home service location
    if (currentLocation === "home") {
      return bookings.filter(booking => booking.location === "home");
    }

    return bookings.filter(booking => booking.location === currentLocation);
  }

  // Apply location filter to all bookings
  const locationFilteredBookings = filterBookingsByLocation(bookings);

  // Get current date in YYYY-MM-DD format for comparison
  const today = new Date();
  const currentDateStr = today.toISOString().split('T')[0];

  // Filter bookings by status (after location filtering)
  const confirmedBookings = locationFilteredBookings.filter((b) => b.status === "confirmed")
  const arrivedBookings = locationFilteredBookings.filter((b) => b.status === "arrived")
  const serviceStartedBookings = locationFilteredBookings.filter((b) => b.status === "service-started")

  // Filter completed bookings to only show the current day's appointments
  const completedBookings = locationFilteredBookings.filter((b) => {
    // Check if the booking is completed
    if (b.status !== "completed") return false;

    // Get the booking date in YYYY-MM-DD format
    const bookingDate = new Date(b.date);
    const bookingDateStr = bookingDate.toISOString().split('T')[0];

    // Only include completed bookings from the current day
    return bookingDateStr === currentDateStr;
  })

  // Toggle expanded booking
  const toggleExpandBooking = (id: string, event?: React.MouseEvent) => {
    // Stop event propagation if event is provided
    if (event) {
      event.stopPropagation()
    }

    // Use functional update to avoid dependency on current state
    setExpandedBookingId(prevId => prevId === id ? null : id)
  }

  // Update booking status
  const updateBookingStatus = (
    id: string,
    newStatus: "confirmed" | "arrived" | "service-started" | "completed" | "cancelled" | "no-show",
  ) => {
    // Set the updating flag to prevent infinite loops
    isUpdatingRef.current = true;

    // Find the current booking
    const currentBooking = bookings.find((b) => b.id === id);
    if (!currentBooking) return;

    // Enforce status flow rules
    const currentStatus = currentBooking.status;

    // Validate status transitions
    if ((newStatus === "cancelled" || newStatus === "no-show") &&
        (currentStatus === "arrived" || currentStatus === "service-started" || currentStatus === "completed")) {
      toast({
        variant: "destructive",
        title: "Invalid Status Change",
        description: `Cannot change status from ${currentStatus} to ${newStatus}. Bookings can only be cancelled or marked as no-show before arrival.`,
      });
      return;
    }

    // Create a timestamp for the status change
    const timestamp = new Date().toISOString();

    // Update the bookings with the new status and add to statusHistory
    const updatedBookings = bookings.map((booking) => {
      if (booking.id === id) {
        return {
          ...booking,
          status: newStatus,
          // Add the status change to the statusHistory if it exists
          statusHistory: booking.statusHistory ? [
            ...booking.statusHistory,
            {
              status: newStatus,
              timestamp: timestamp,
              updatedBy: "Staff"
            }
          ] : [
            {
              status: newStatus,
              timestamp: timestamp,
              updatedBy: "Staff"
            }
          ]
        };
      }
      return booking;
    });

    setBookings(updatedBookings);

    // Find the updated booking to pass to parent component
    const updatedBooking = updatedBookings.find((b) => b.id === id);
    if (updatedBooking && onBookingUpdate) {
      // Convert back to appointment format for parent component
      const originalAppointment = appointments.find((a) => a.id === id);
      if (originalAppointment) {
        // Create the updated appointment with status history
        const updatedAppointment = {
          ...originalAppointment,
          status: newStatus,
          // Add the status change to the statusHistory if it exists
          statusHistory: originalAppointment.statusHistory ? [
            ...originalAppointment.statusHistory,
            {
              status: newStatus,
              timestamp: timestamp,
              updatedBy: "Staff"
            }
          ] : [
            {
              status: newStatus,
              timestamp: timestamp,
              updatedBy: "Staff"
            }
          ],
          // Add a flag to trigger animation in the UI
          justUpdated: true
        };

        // Use setTimeout to ensure this happens after the current render cycle
        setTimeout(() => {
          onBookingUpdate(updatedAppointment);
        }, 0);
      }
    }

    toast({
      description: `Booking status updated to ${newStatus.replace('-', ' ')}.`,
    });

    // If the status is changed to completed, open the payment dialog
    if (newStatus === "completed") {
      const bookingToProcess = updatedBookings.find((b) => b.id === id);
      if (bookingToProcess) {
        setBookingForPayment(bookingToProcess);
        setPaymentDialogOpen(true);
      }
    }
  }

  // Calculate total for a booking
  const calculateTotal = (items: BookingItem[]) => {
    const serviceTotal = items.reduce((sum, item) => item.type === "service" ? sum + item.price : sum, 0);
    const productTotal = items.reduce((sum, item) => item.type === "product" ? sum + (item.price * (item.quantity || 1)) : sum, 0);
    return { total: serviceTotal + productTotal, serviceTotal, productTotal };
  }

  // Handle adding a service
  const handleAddService = (bookingId: string) => {
    console.log("handleAddService called with bookingId:", bookingId);

    // Find the booking to pass to the AddServiceDialog
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      console.log("Found booking in local state:", booking);

      // Set the booking ID first
      setSelectedBookingId(bookingId);

      // Find the original appointment to get all details
      const originalAppointment = appointments.find(a => a.id === bookingId);
      if (originalAppointment) {
        console.log("Found original appointment:", originalAppointment);

        // Set the current booking in the state to pass to AddServiceDialog
        setCurrentBooking(originalAppointment);

        // Open the dialog after setting the state
        setTimeout(() => {
          setAddServiceDialogOpen(true);
          console.log("AddServiceDialog opened with appointment data");
        }, 50); // Increased timeout to ensure state is updated
      } else {
        // If we can't find the original appointment, use the booking from our state
        console.log("Original appointment not found, using booking from state");
        setCurrentBooking(booking);

        // Open the dialog after setting the state
        setTimeout(() => {
          setAddServiceDialogOpen(true);
          console.log("AddServiceDialog opened with booking data");
        }, 50); // Increased timeout to ensure state is updated
      }
    } else {
      console.error("Booking not found with ID:", bookingId);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not find the booking to add a service to.",
      });
    }
  }

  // Handle adding a product
  const handleAddProduct = (bookingId: string) => {
    setSelectedBookingId(bookingId)
    setAddProductDialogOpen(true)
  }

  // Handle delete item confirmation
  const handleDeleteItemConfirm = (bookingId: string, itemId: string) => {
    setSelectedBookingId(bookingId)
    setSelectedItemId(itemId)
    setDeleteConfirmOpen(true)
  }

  // Handle item deleted
  const handleItemDeleted = (bookingId: string, itemId: string) => {
    // Set the updating flag to prevent infinite loops
    isUpdatingRef.current = true;

    // Find the booking and item
    const booking = bookings.find((b) => b.id === bookingId)
    const item = booking?.items.find((i) => i.id === itemId)

    if (!booking || !item) return

    // Check if this is the primary service (first item in the array)
    const isPrimaryService = booking.items.indexOf(item) === 0

    // Update the bookings state by removing the item
    const updatedBookings = bookings.map((booking) => {
      if (booking.id === bookingId) {
        // Remove the item from the items array
        const updatedItems = booking.items.filter((item) => item.id !== itemId)

        return {
          ...booking,
          items: updatedItems
        }
      }
      return booking
    })

    setBookings(updatedBookings)

    // Update the parent component
    // Use setTimeout to ensure this happens after the current render cycle
    setTimeout(() => {
      handleItemDeletedUpdate(bookingId, itemId)
    }, 0)
  }

  // Handle staff service completion
  const handleStaffServiceCompleted = (bookingId: string, itemId: string) => {
    // Set the updating flag to prevent infinite loops
    isUpdatingRef.current = true;

    // Find the booking and item
    const booking = bookings.find((b) => b.id === bookingId)
    const item = booking?.items.find((i) => i.id === itemId)

    if (!booking || !item || item.type !== "service" || !item.staffId) return

    // Update the bookings state by marking the service as completed
    const updatedBookings = bookings.map((booking) => {
      if (booking.id === bookingId) {
        // Update the item to mark it as completed
        const updatedItems = booking.items.map((i) => {
          if (i.id === itemId) {
            return {
              ...i,
              completed: true
            }
          }
          return i
        })

        return {
          ...booking,
          items: updatedItems
        }
      }
      return booking
    })

    setBookings(updatedBookings)

    // Find the updated booking to pass to parent component
    const updatedBooking = updatedBookings.find((b) => b.id === bookingId)
    if (updatedBooking && onBookingUpdate) {
      // Convert back to appointment format for parent component
      const originalAppointment = appointments.find((a) => a.id === bookingId)
      if (originalAppointment) {
        // Update the appointment with the completed staff service
        const updatedAppointment = {
          ...originalAppointment,
          // Update the additional services to mark the staff as completed
          additionalServices: originalAppointment.additionalServices?.map((service: any) => {
            if (service.id === itemId) {
              return {
                ...service,
                completed: true
              }
            }
            return service
          }) || [],
          // If this is the main service, mark it as completed in the appointment
          staffServiceCompleted: item.id === `item-${bookingId}-1` ? true : originalAppointment.staffServiceCompleted
        }

        // Use setTimeout to ensure this happens after the current render cycle
        setTimeout(() => {
          onBookingUpdate(updatedAppointment)
        }, 0)
      }
    }

    toast({
      title: "Service Completed",
      description: `${item.staff} has completed their service and is now available for other bookings.`,
    })
  }

  // Handle item deleted (continued)
  const handleItemDeletedUpdate = (bookingId: string, itemId: string) => {
    // Find the booking and item
    const booking = bookings.find((b) => b.id === bookingId)
    const item = booking?.items.find((i) => i.id === itemId)

    if (!booking || !item) return

    // Check if this is the primary service (first item in the array)
    const isPrimaryService = booking.items.indexOf(item) === 0

    // Update the parent component
    if (onBookingUpdate) {
      // Find the original appointment to update
      const originalAppointment = appointments.find((a) => a.id === bookingId)
      if (originalAppointment) {
        if (isPrimaryService) {
          // If deleting the primary service, update the service field to empty or to the next service if available
          const nextService = booking.items.find(i => i.id !== itemId && i.type === "service")

          onBookingUpdate({
            ...originalAppointment,
            service: nextService ? nextService.name : "",
            price: nextService ? nextService.price : 0,
            duration: nextService ? nextService.duration : 0,
            staffId: nextService ? nextService.staffId : originalAppointment.staffId,
            staffName: nextService ? nextService.staff : originalAppointment.staffName
          })
        } else if (item.type === "service") {
          // Remove the service from additionalServices
          const updatedServices = originalAppointment.additionalServices
            ? originalAppointment.additionalServices.filter((service: any) => service.name !== item.name)
            : []

          onBookingUpdate({
            ...originalAppointment,
            additionalServices: updatedServices
          })
        } else {
          // Remove the product from products
          const updatedProducts = originalAppointment.products
            ? originalAppointment.products.filter((product: any) => product.name !== item.name)
            : []

          onBookingUpdate({
            ...originalAppointment,
            products: updatedProducts
          })
        }
      }
    }
  }

  // Handle service added
  const handleServiceAdded = (bookingId: string, service: BookingItem) => {
    console.log("handleServiceAdded called with:", { bookingId, service });

    // Set the updating flag to prevent infinite loops
    isUpdatingRef.current = true;

    // Create a new service item with the exact data from the dialog
    const newServiceItem: BookingItem = {
      id: service.id,
      type: "service",
      name: service.name,
      price: service.price,
      duration: service.duration,
      staff: service.staff,
      staffId: service.staffId
    };

    console.log("Created new service item:", newServiceItem);

    // Update the bookings state with the new service
    const updatedBookings = bookings.map((booking) =>
      booking.id === bookingId ? { ...booking, items: [...booking.items, newServiceItem] } : booking,
    );

    setBookings(updatedBookings);
    console.log("Updated bookings state with new service");

    // Find the updated booking to pass to parent component
    const updatedBooking = updatedBookings.find((b) => b.id === bookingId);
    if (updatedBooking && onBookingUpdate) {
      console.log("Found updated booking:", updatedBooking);

      // Convert back to appointment format for parent component
      const originalAppointment = appointments.find((a) => a.id === bookingId);
      if (originalAppointment) {
        console.log("Found original appointment:", originalAppointment);

        // Create the additional service with the exact data
        const additionalService = {
          id: service.id, // Temporary UI ID for tracking
          serviceId: service.serviceId || service.id, // Actual service ID from database
          name: service.name,
          price: service.price,
          duration: service.duration,
          staffId: service.staffId,
          staffName: service.staff,
          // Add the same date as the original appointment to ensure it shows in the calendar
          date: originalAppointment.date,
          // Mark this as an additional service for the parent appointment
          parentAppointmentId: originalAppointment.id,
          // Set the status to match the parent appointment
          status: originalAppointment.status
        };

        console.log("Created additional service for appointment:", additionalService);

        // Update the appointment with the new service
        // Use setTimeout to ensure this happens after the current render cycle
        setTimeout(() => {
          const updatedAppointment = {
            ...originalAppointment,
            // Add the new service to the appointment
            additionalServices: [
              ...(originalAppointment.additionalServices || []),
              additionalService,
            ],
            // Flag to indicate this appointment was just updated (for UI highlighting)
            justUpdated: true
          };

          console.log("Updating appointment with:", updatedAppointment);
          onBookingUpdate(updatedAppointment);
        }, 50);

        // Show a toast notification with the specific service details
        toast({
          title: "Service Added",
          description: `Added ${service.name} with ${service.staff} to the booking.`,
        });
      } else {
        console.error("Original appointment not found for ID:", bookingId);
      }
    } else {
      console.error("Updated booking or onBookingUpdate not available");
    }
  }

  // Handle product added
  const handleProductAdded = (bookingId: string, product: BookingItem) => {
    // Set the updating flag to prevent infinite loops
    isUpdatingRef.current = true;

    // Create a new product item with the exact data from the dialog
    const newProductItem: BookingItem = {
      id: product.id,
      type: "product",
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      unitPrice: product.unitPrice
    };

    // Update the bookings state with the new product
    const updatedBookings = bookings.map((booking) =>
      booking.id === bookingId ? { ...booking, items: [...booking.items, newProductItem] } : booking,
    );

    setBookings(updatedBookings);

    // Find the updated booking to pass to parent component
    const updatedBooking = updatedBookings.find((b) => b.id === bookingId);
    if (updatedBooking && onBookingUpdate) {
      // Convert back to appointment format for parent component
      const originalAppointment = appointments.find((a) => a.id === bookingId);
      if (originalAppointment) {
        // Create the product with the exact data
        const newProduct = {
          id: product.id, // Temporary UI ID for tracking
          productId: product.productId || product.id, // Actual product ID from database
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          unitPrice: product.unitPrice
        };

        // Update the appointment with the new product
        // Use setTimeout to ensure this happens after the current render cycle
        setTimeout(() => {
          onBookingUpdate({
            ...originalAppointment,
            // Add the new product to the appointment
            products: [
              ...(originalAppointment.products || []),
              newProduct,
            ],
          });
        }, 0);

        // Show a toast notification with the specific product details
        toast({
          title: "Product Added",
          description: `Added ${product.quantity}x ${product.name} to the booking.`,
        });
      }
    }
  }

  // Handle payment completion
  // Note: Payment status is persistent and cannot be reversed once set
  const handlePaymentComplete = (
    paymentMethod: string,
    giftCardCode?: string,
    giftCardAmount?: number,
    discountPercentage?: number,
    discountAmount?: number,
    serviceDiscountAmount?: number,
  ) => {
    // Set the updating flag to prevent infinite loops
    isUpdatingRef.current = true;

    if (!bookingForPayment) return;

    // Calculate the total amount paid
    const calculatedTotals = calculateTotal(bookingForPayment.items);
    const originalTotal = calculatedTotals.total;
    const finalTotal = discountAmount ? originalTotal - discountAmount : originalTotal;

    console.log("🔄 EnhancedBookingSummary: Processing payment completion", {
      bookingId: bookingForPayment.id,
      paymentMethod,
      originalTotal,
      discountPercentage,
      discountAmount,
      finalTotal,
      clientName: bookingForPayment.clientName
    });

    // Show success message
    const description = discountAmount && discountAmount > 0
      ? `Payment of $${finalTotal.toFixed(2)} processed via ${paymentMethod} for ${bookingForPayment.clientName} (${discountPercentage}% discount applied: -$${discountAmount.toFixed(2)}).`
      : `Payment of $${finalTotal.toFixed(2)} processed via ${paymentMethod} for ${bookingForPayment.clientName}.`;

    toast({
      title: "Payment Successful",
      description,
    });

    // Record consolidated transaction
    try {
      // Determine payment method enum
      let paymentMethodEnum = PaymentMethod.CASH;
      if (paymentMethod.toLowerCase().includes('card') || paymentMethod.toLowerCase().includes('credit')) {
        paymentMethodEnum = PaymentMethod.CREDIT_CARD;
      } else if (paymentMethod.toLowerCase().includes('mobile')) {
        paymentMethodEnum = PaymentMethod.MOBILE_PAYMENT;
      }

      // Calculate service and product amounts from bookingForPayment.items
      const serviceAmount = bookingForPayment.items.filter(item => item.type === 'service').reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      const productAmount = bookingForPayment.items.filter(item => item.type === 'product').reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      // Calculate original service amount before discount
      const originalServiceAmount = bookingForPayment.items.filter(item => item.type === 'service').reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
      const consolidatedTransaction = {
        ...ConsolidatedTransactionService.createConsolidatedTransactionFromBooking(
          bookingForPayment,
          paymentMethodEnum,
          discountPercentage,
          discountAmount,
          serviceDiscountAmount
        ),
        id: generateSequentialTransactionId('TX-'),
        serviceAmount,
        productAmount,
        originalServiceAmount,
      };

      console.log('📊 BOOKING SUMMARY: Creating consolidated transaction:', {
        transactionId: consolidatedTransaction.id,
        totalAmount: consolidatedTransaction.amount,
        serviceAmount: consolidatedTransaction.serviceAmount,
        productAmount: consolidatedTransaction.productAmount,
        discountApplied: consolidatedTransaction.discountPercentage && consolidatedTransaction.discountPercentage > 0,
        itemCount: consolidatedTransaction.items?.length || 0
      });

      // Add the consolidated transaction
      const result = addTransaction(consolidatedTransaction);

      if (result) {
        setLastTransaction(consolidatedTransaction); // Store for print receipt
        console.log("✅ Booking Summary: Consolidated transaction created successfully:", {
          transactionId: consolidatedTransaction.id,
          totalAmount: consolidatedTransaction.amount,
          serviceAmount: consolidatedTransaction.serviceAmount,
          productAmount: consolidatedTransaction.productAmount,
          discountAmount: consolidatedTransaction.discountAmount
        });
      } else {
        console.error("❌ Booking Summary: Failed to create consolidated transaction");
      }
    } catch (error) {
      console.error("Error recording consolidated transaction:", error);
    }

    // Update the booking with payment information
    // Once payment is made, it cannot be reversed - this is by design
    const updatedBookings = bookings.map((booking) => {
      if (booking.id === bookingForPayment.id) {
        const updatedBooking = {
          ...booking,
          paymentStatus: "paid",
          paymentMethod: paymentMethod,
          paymentDate: new Date().toISOString(),
          transactionRecorded: true, // Flag to prevent duplicate transaction creation
          // Include discount information if applied
          ...(discountPercentage !== undefined && discountAmount !== undefined && {
            discountPercentage: discountPercentage,
            discountAmount: discountAmount,
            originalAmount: originalTotal,
            finalAmount: finalTotal
          })
        };
        console.log("💰 EnhancedBookingSummary: Updated booking with payment status", {
          bookingId: booking.id,
          oldPaymentStatus: booking.paymentStatus,
          newPaymentStatus: updatedBooking.paymentStatus,
          paymentMethod: updatedBooking.paymentMethod,
          discountApplied: (discountAmount ?? 0) > 0,
          discountPercentage,
          discountAmount,
          finalAmount: finalTotal
        });
        return updatedBooking as EnhancedBooking;
      }
      return booking;
    });

    setBookings(updatedBookings);

    // Update the parent component to persist the payment status
    if (onBookingUpdate && bookingForPayment) {
      // Find the original appointment to update
      const originalAppointment = appointments.find((a) => a.id === bookingForPayment.id);
      if (originalAppointment) {
        const updatedAppointment = {
          ...originalAppointment,
          paymentStatus: "paid",
          paymentMethod: paymentMethod,
          paymentDate: new Date().toISOString(),
          // Include discount information if applied
          ...(discountPercentage !== undefined && discountAmount !== undefined && {
            discountPercentage: discountPercentage,
            discountAmount: discountAmount,
            originalAmount: originalTotal,
            finalAmount: finalTotal
          })
        };

        console.log("📤 EnhancedBookingSummary: Sending payment update to parent", {
          appointmentId: originalAppointment.id,
          oldPaymentStatus: originalAppointment.paymentStatus,
          newPaymentStatus: updatedAppointment.paymentStatus,
          paymentMethod: updatedAppointment.paymentMethod,
          discountApplied: (discountAmount ?? 0) > 0,
          discountPercentage,
          discountAmount
        });

        // Update the appointment with payment information
        // Use setTimeout to ensure this happens after the current render cycle
        setTimeout(() => {
          onBookingUpdate(updatedAppointment);
        }, 0);
      }
    }

    // Do not close the dialog immediately; let user print receipt
    // setPaymentDialogOpen(false);
    // Do not setBookingForPayment(null); // Keep dialog open for print receipt
  }

  // Render booking card
  const renderBookingCard = (booking: EnhancedBooking) => {
    const isExpanded = expandedBookingId === booking.id
    const appointmentDate = parseISO(booking.date)
    // Handle cases where clientName might be undefined or not a string
    const initials = booking.clientName && typeof booking.clientName === 'string'
      ? booking.clientName
          .split(" ")
          .map((n) => n[0])
          .join("")
      : "CL" // Default initials for Client

    return (
      <div key={booking.id} className="border rounded-md overflow-hidden mb-4">
        <div className="flex items-start p-4 cursor-pointer relative" onClick={(e) => toggleExpandBooking(booking.id, e)}>
          <div className="border-l-4 border-blue-500 absolute left-0 top-0 bottom-0"></div>
          <Avatar className="h-10 w-10 mr-4">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{booking.clientName}</h3>
                <div className="flex items-center gap-1">
                  <p className="text-sm text-gray-500">{booking.clientEmail}</p>
                  {currentLocation === "all" && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {booking.locationName}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">{booking.items.length} items</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "transform rotate-180")} />
              </div>
            </div>
            <div className="flex items-center mt-2 text-sm text-gray-500">
              <Clock className="h-4 w-4 mr-1" />
              <span className="mr-4">{format(appointmentDate, "EEE, MMM d 'at' h:mm a")}</span>
              <MapPin className="h-4 w-4 mr-1" />
              <span>{booking.locationName}</span>
              {booking.notes && (
                <>
                  <MessageSquare className="h-4 w-4 ml-4 mr-1" />
                  <span>Notes</span>
                </>
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t px-4 py-3">
            <div className="space-y-3">
              {/* Status History Section - Horizontal Layout */}
              {booking.statusHistory && booking.statusHistory.length > 0 && (
                <div className="mb-3 pb-3 border-b">
                  <h4 className="font-medium text-sm mb-1">Status History</h4>
                  <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded-md">
                    <div className="flex flex-wrap gap-2">
                      {booking.statusHistory.map((entry, index, array) => (
                        <div key={`status-${index}`} className="flex items-center bg-white px-1.5 py-0.5 rounded border border-gray-100">
                          <div className={`w-2 h-2 rounded-full mr-1 ${
                            entry.status === 'pending' ? 'bg-yellow-500' :
                            entry.status === 'confirmed' ? 'bg-blue-500' :
                            entry.status === 'arrived' ? 'bg-indigo-500' :
                            entry.status === 'service-started' ? 'bg-purple-500' :
                            entry.status === 'completed' ? 'bg-green-500' :
                            entry.status === 'cancelled' ? 'bg-red-500' :
                            entry.status === 'no-show' ? 'bg-orange-500' :
                            'bg-gray-500'
                          }`}></div>
                          <span className="font-medium capitalize text-xs mr-1">
                            {entry.status.replace('-', ' ')}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {format(parseISO(entry.timestamp), "MMM d, HH:mm")}
                          </span>
                          {/* Add arrow between status entries except for the last one */}
                          {index < array.length - 1 && (
                            <ChevronRight className="h-3 w-3 mx-1 text-gray-300" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes Section */}
              {booking.notes && (
                <div className="mb-3 pb-3 border-b">
                  <h4 className="font-medium text-sm mb-1">Notes</h4>
                  <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded-md">
                    <div className="flex items-start">
                      <MessageSquare className="h-4 w-4 mr-2 mt-0.5 text-gray-500" />
                      <p>{booking.notes}</p>
                    </div>
                  </div>
                </div>
              )}
              <h4 className="font-medium text-sm">Booking Items</h4>
              {booking.items.map((item, index) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <Badge variant={item.type === "service" ? "secondary" : "outline"} className="mr-2">
                        {item.type === "service" ? "Service" : "Product"}
                      </Badge>
                      <span>{item.name}</span>
                      {item.quantity && item.quantity > 1 && (
                        <span className="ml-1 text-sm text-gray-500">x{item.quantity}</span>
                      )}
                      {/* Show completed badge if service is completed */}
                      {item.type === "service" && item.completed && (
                        <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                          Completed
                        </Badge>
                      )}
                    </div>
                    {item.staff && (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">with {item.staff}</p>

                        {/* Complete button for staff services - only visible in service-started tab */}
                        {booking.status === "service-started" &&
                         item.type === "service" &&
                         item.staffId &&
                         !item.completed && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 py-0 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStaffServiceCompleted(booking.id, item.id)
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center">
                    <div className="text-right mr-2">
                      <p className="font-medium">
                        <CurrencyDisplay amount={item.price} />
                      </p>
                      {item.duration && <p className="text-xs text-gray-500">{item.duration} min</p>}
                    </div>

                    {/* Delete button for services and products - only visible in service-started tab and for users with admin privileges */}
                    {booking.status === "service-started" && hasAdminPrivileges() && !item.completed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteItemConfirm(booking.id, item.id)
                        }}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Delete {item.type}</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="border-t pt-3 space-y-2">
                {/* Discount Information (if applied) */}
                {booking.paymentStatus === "paid" && booking.discountPercentage && booking.discountAmount && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-700 font-medium">Discount Applied ({booking.discountPercentage}%)</span>
                      <span className="text-green-600 font-medium">
                        -<CurrencyDisplay amount={booking.discountAmount} />
                      </span>
                    </div>
                    {booking.originalAmount && (
                      <div className="flex items-center justify-between text-xs text-green-600 mt-1">
                        <span>Original Total:</span>
                        <span className="line-through">
                          <CurrencyDisplay amount={booking.originalAmount} />
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total</span>
                  <div className="flex items-center">
                    {booking.paymentStatus === "paid" && (
                      <Badge variant="outline" className="mr-2 bg-green-50 text-green-700 border-green-200">
                        {booking.paymentMethod === "Cash" ? (
                          <Banknote className="h-3 w-3 mr-1 text-yellow-600" />
                        ) : (
                          <CreditCard className="h-3 w-3 mr-1" />
                        )}
                        Paid
                      </Badge>
                    )}
                    <span className="font-medium">
                      <CurrencyDisplay amount={
                        booking.paymentStatus === "paid" && booking.finalAmount
                          ? booking.finalAmount
                          : calculateTotal(booking.items).total
                      } />
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                {booking.status === "confirmed" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateBookingStatus(booking.id, "arrived")
                      }}
                    >
                      <User className="h-4 w-4 mr-1" />
                      Mark as Arrived
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateBookingStatus(booking.id, "cancelled")
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateBookingStatus(booking.id, "no-show")
                      }}
                    >
                      Mark as No-Show
                    </Button>
                  </>
                )}

                {booking.status === "arrived" && (
                  <>
                    {/* Only show Undo button for admin/manager users */}
                    {hasAdminPrivileges() && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateBookingStatus(booking.id, "confirmed")
                        }}
                      >
                        Undo Arrival
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateBookingStatus(booking.id, "service-started")
                      }}
                    >
                      <Clock3 className="h-4 w-4 mr-1" />
                      Start Service
                    </Button>
                  </>
                )}

                {booking.status === "service-started" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddService(booking.id)
                      }}
                    >
                      <Scissors className="h-4 w-4 mr-1" />
                      Add Service
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddProduct(booking.id)
                      }}
                    >
                      <ShoppingBag className="h-4 w-4 mr-1" />
                      Add Product
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateBookingStatus(booking.id, "completed")
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  </>
                )}

                {booking.status === "completed" && (
                  <>
                    {/* Show Pay Now button if not paid yet */}
                    {!booking.paymentStatus && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation()
                          setBookingForPayment(booking)
                          setPaymentDialogOpen(true)
                        }}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Pay Now
                      </Button>
                    )}

                    {/* Only show Reopen button for admin/manager users and if not paid yet */}
                    {hasAdminPrivileges() && !booking.paymentStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateBookingStatus(booking.id, "service-started")
                        }}
                      >
                        Reopen
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-medium text-gray-700">Manage your bookings and additional services</h2>
          <p className="text-sm text-gray-500">
            {currentLocation === "all"
              ? `Showing all ${bookings.length} bookings`
              : `Showing ${locationFilteredBookings.length} bookings at ${
                  getLocationName(currentLocation)
                }`
            }
            {currentLocation !== "all" && (
              <span className="ml-1">
                ({getLocationName("loc1")}: {bookings.filter(b => b.location === "loc1").length},
                {getLocationName("loc2")}: {bookings.filter(b => b.location === "loc2").length},
                {getLocationName("loc3")}: {bookings.filter(b => b.location === "loc3").length},
                {getLocationName("home")}: {bookings.filter(b => b.location === "home" || b.location === "loc4").length})
              </span>
            )}
          </p>
        </div>
      </div>

      <Tabs defaultValue="confirmed" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="confirmed" className="flex items-center justify-center">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Confirmed ({confirmedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="arrived" className="flex items-center justify-center">
            <User className="h-4 w-4 mr-2" />
            Arrived ({arrivedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="service-started" className="flex items-center justify-center">
            <Clock3 className="h-4 w-4 mr-2" />
            Service Started ({serviceStartedBookings.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center justify-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed ({completedBookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="confirmed" className="mt-0">
          {confirmedBookings.length > 0 ? (
            confirmedBookings.map((booking) => renderBookingCard(booking))
          ) : (
            <div className="text-center py-8 text-gray-500">No confirmed bookings</div>
          )}
        </TabsContent>

        <TabsContent value="arrived" className="mt-0">
          {arrivedBookings.length > 0 ? (
            arrivedBookings.map((booking) => renderBookingCard(booking))
          ) : (
            <div className="text-center py-8 text-gray-500">No arrived bookings</div>
          )}
        </TabsContent>

        <TabsContent value="service-started" className="mt-0">
          {serviceStartedBookings.length > 0 ? (
            serviceStartedBookings.map((booking) => renderBookingCard(booking))
          ) : (
            <div className="text-center py-8 text-gray-500">No service-started bookings</div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          {completedBookings.length > 0 ? (
            completedBookings.map((booking) => renderBookingCard(booking))
          ) : (
            <div className="text-center py-8 text-gray-500">No completed bookings</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Service Dialog */}
      {selectedBookingId && (
        <AddServiceDialog
          open={addServiceDialogOpen}
          onOpenChange={setAddServiceDialogOpen}
          bookingId={selectedBookingId}
          onServiceAdded={handleServiceAdded}
          currentBooking={currentBooking}
        />
      )}

      {/* Add Product Dialog */}
      {selectedBookingId && (
        <AddProductDialog
          open={addProductDialogOpen}
          onOpenChange={setAddProductDialogOpen}
          bookingId={selectedBookingId}
          onProductAdded={handleProductAdded}
        />
      )}

      {/* Payment Dialog */}
      {bookingForPayment && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={(open) => {
            setPaymentDialogOpen(open);
            if (!open) setBookingForPayment(null);
          }}
          total={calculateTotal(bookingForPayment.items).total}
          serviceTotal={calculateTotal(bookingForPayment.items).serviceTotal}
          onComplete={(paymentMethod, giftCardCode, giftCardAmount, discountPercentage, discountAmount, serviceDiscountAmount) =>
            handlePaymentComplete(paymentMethod, giftCardCode, giftCardAmount, discountPercentage, discountAmount, serviceDiscountAmount)
          }
          lastTransaction={lastTransaction}
          // Add Print Receipt button after payment
          // The PaymentDialog already supports a Print Receipt button if lastTransaction is set
          // To ensure bilingual, pass getLocationName to printReceipt in PaymentDialog
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!selectedBookingId || !selectedItemId) return "This will remove the item from the booking.";

                const booking = bookings.find(b => b.id === selectedBookingId);
                const item = booking?.items.find(i => i.id === selectedItemId);
                const isPrimaryService = booking?.items.indexOf(item!) === 0;

                if (isPrimaryService) {
                  return "You are about to delete the primary service for this booking. This action cannot be undone.";
                } else {
                  return `This will remove the ${item?.type} "${item?.name}" from the booking. This action cannot be undone.`;
                }
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedBookingId && selectedItemId) {
                  const booking = bookings.find(b => b.id === selectedBookingId);
                  const item = booking?.items.find(i => i.id === selectedItemId);
                  const isPrimaryService = booking?.items.indexOf(item!) === 0;

                  handleItemDeleted(selectedBookingId, selectedItemId)
                  setDeleteConfirmOpen(false)

                  toast({
                    title: "Item Deleted",
                    description: isPrimaryService
                      ? "The primary service has been removed from the booking."
                      : `The ${item?.type} has been removed from the booking.`,
                  })
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

