"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Scissors,
  Plus,
  X,
  Edit,
  AlertCircle,
  ChevronRight,
  Loader2,
  Star,
  RefreshCw,
  Hash,
  CheckCircle,
  XCircle,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Home
} from "lucide-react"
import { parseISO, subDays, isAfter, isBefore, addMinutes } from "date-fns"
import { formatAppDate, formatAppTime, isPast, isToday, isFuture } from "@/lib/date-utils"
import { ClientPortalLayout } from "@/components/client-portal/client-portal-layout"
import { AppointmentStatus } from "@/lib/appointments-data"
import { getAllAppointments, AppointmentData } from "@/lib/appointment-service"
import { useStaff } from "@/lib/staff-provider"
import { useLocations } from "@/lib/location-provider"
import { useServices } from "@/lib/service-provider"
import { useCurrency } from "@/lib/currency-provider"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { ReviewForm, ReviewFormData } from "@/components/client-portal/review-form"
import { getFirstName } from "@/lib/female-avatars"

export default function AppointmentsPage() {
  const { toast } = useToast()
  const { getLocationName } = useLocations()
  const { getServiceById } = useServices()
  const { formatCurrency } = useCurrency()

  const [activeTab, setActiveTab] = useState("upcoming")
  const [cancelAppointmentId, setCancelAppointmentId] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  // Change the type of clientAppointments to AppointmentData[]
  const [clientAppointments, setClientAppointments] = useState<AppointmentData[]>([])
  const [reviewAppointment, setReviewAppointment] = useState<AppointmentData | null>(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)

  // Get current client ID from localStorage
  const getCurrentClientId = () => {
    if (typeof window === 'undefined') return null
    const clientId = localStorage.getItem("client_id")
    const clientEmail = localStorage.getItem("client_email")

    // Debug logging
    console.log("Client authentication check:", { clientId, clientEmail })

    return clientId || clientEmail || "ed1"
  }

  // Fetch appointments from the appointment service
  const fetchAppointments = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      // Get all appointments from the unified service
      const allAppointments = await getAllAppointments()

      // Get current client ID
      const currentClientId = getCurrentClientId()

      // Filter appointments for the current client
      const clientFilteredAppointments = allAppointments.filter(appointment => {
        // Exclude reflected appointments from client portal
        if (appointment.isReflected) {
          return false
        }

        // Match by client ID or email
        const matches = appointment.clientId === currentClientId ||
               appointment.clientEmail === currentClientId ||
               appointment.clientId === "ed1" // Fallback for demo

        // Debug logging for each appointment
        if (appointment.clientId === "ed1" || appointment.clientId === currentClientId) {
          console.log("Appointment match check:", {
            appointmentId: appointment.id,
            appointmentClientId: appointment.clientId,
            currentClientId,
            matches
          })
        }

        return matches
      })

      console.log("Fetched appointments for client:", currentClientId, "Total appointments:", allAppointments.length, "Filtered:", clientFilteredAppointments.length)
      console.log("Client appointments:", clientFilteredAppointments)
      // When setting clientAppointments, no cast needed if getAllAppointments returns AppointmentData[]
      setClientAppointments(clientFilteredAppointments)

    } catch (error) {
      console.error("Error fetching appointments:", error)
      toast({
        title: "Failed to load appointments",
        description: "Please try refreshing the page.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchAppointments()
  }, [])

  // Refresh function for manual refresh
  const handleRefresh = () => {
    fetchAppointments(true)
  }

  // Get real staff data from HR system
  const { staff: realStaff } = useStaff()

  // Helper function to get staff details from REAL staff data
  const getStaffDetails = (staffId: string) => {
    const staff = realStaff.find(staff => staff.id === staffId)
    if (!staff) return undefined;
    if (["ADMIN", "SUPER_ADMIN", "MANAGER"].includes((staff.role || "").toUpperCase())) {
      return undefined;
    }
    return staff;
  }

  // Helper function to get time-sensitive status for today's appointments
  const getTimeStatus = (appointment: AppointmentData) => {
    const appointmentDate = parseISO(appointment.date)
    const now = new Date()
    const appointmentEnd = addMinutes(appointmentDate, appointment.duration)

    if (isBefore(now, appointmentDate)) {
      const minutesUntil = Math.floor((appointmentDate.getTime() - now.getTime()) / (1000 * 60))
      if (minutesUntil <= 30) {
        return { status: "starting-soon", label: "Starting Soon", color: "bg-orange-100 text-orange-800" }
      }
      return { status: "upcoming", label: "Upcoming", color: "bg-blue-100 text-blue-800" }
    } else if (isAfter(now, appointmentDate) && isBefore(now, appointmentEnd)) {
      return { status: "in-progress", label: "In Progress", color: "bg-green-100 text-green-800" }
    } else if (isAfter(now, appointmentEnd)) {
      return { status: "completed-today", label: "Completed Today", color: "bg-gray-100 text-gray-800" }
    }

    return { status: "scheduled", label: "Scheduled", color: "bg-blue-100 text-blue-800" }
  }

  // Filter appointments by status and date
  const upcomingAppointments = clientAppointments
    .filter(appointment => {
      const appointmentDate = parseISO(appointment.date)
      return (appointment.status === "confirmed" || appointment.status === "pending") &&
             isFuture(appointmentDate) && !isToday(appointmentDate)
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const todayAppointments = clientAppointments
    .filter(appointment => {
      const appointmentDate = parseISO(appointment.date)
      return isToday(appointmentDate) &&
             appointment.status !== "cancelled"
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const pastAppointments = clientAppointments
    .filter(appointment => {
      const appointmentDate = parseISO(appointment.date)
      return isPast(appointmentDate) && !isToday(appointmentDate)
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Debug logging for categorized appointments
  console.log("Appointment categorization:", {
    total: clientAppointments.length,
    upcoming: upcomingAppointments.length,
    today: todayAppointments.length,
    past: pastAppointments.length
  })

  const appointmentToCancel = clientAppointments.find(a => a.id === cancelAppointmentId)

  const handleCancelAppointment = async () => {
    if (!cancelAppointmentId) return

    setIsCancelling(true)

    try {
      // In a real app, this would be an API call to cancel the appointment
      // const response = await fetch(`/api/client-portal/appointments/${cancelAppointmentId}`, {
      //   method: 'PATCH',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ status: 'cancelled' }),
      // })

      // if (!response.ok) {
      //   throw new Error('Failed to cancel appointment')
      // }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Update local state
      setClientAppointments(prevAppointments =>
        prevAppointments.map(appointment =>
          appointment.id === cancelAppointmentId
            ? { ...appointment, status: "cancelled" as AppointmentStatus }
            : appointment
        )
      )

      toast({
        title: "Appointment cancelled",
        description: "Your appointment has been successfully cancelled.",
      })

      setCancelAppointmentId(null)
    } catch (error) {
      toast({
        title: "Failed to cancel appointment",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Confirmed</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Pending</Badge>
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>
      case "checked-in":
        return <Badge className="bg-purple-100 text-purple-800"><PlayCircle className="w-3 h-3 mr-1" />Checked In</Badge>
      case "service-started":
        return <Badge className="bg-indigo-100 text-indigo-800"><PlayCircle className="w-3 h-3 mr-1" />In Progress</Badge>
      case "no-show":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />No Show</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  // Check if appointment is a home service
  const isHomeService = (location: string) => {
    return location?.toLowerCase().includes('home service') || location?.toLowerCase() === 'home';
  };

  // Appointment Card Component
  const AppointmentCard = ({ appointment, showTimeStatus = false }: { appointment: AppointmentData, showTimeStatus?: boolean }) => {
    const staffDetails = getStaffDetails(appointment.staffId)
    const timeStatus = showTimeStatus ? getTimeStatus(appointment) : null
    const appointmentDate = parseISO(appointment.date)
    const isHome = isHomeService(appointment.location)

    return (
      <Card className={`hover:shadow-md transition-shadow ${
        isHome ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${
                isHome ? 'bg-blue-100' : 'bg-pink-100'
              }`}>
                {isHome ? (
                  <Home className="h-5 w-5 text-blue-600" />
                ) : (
                  <Scissors className="h-5 w-5 text-pink-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{appointment.service}</h3>
                  {isHome && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                      Home Service
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {formatAppDate(appointmentDate)} at {formatAppTime(appointmentDate)}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
              {getStatusBadge(appointment.status)}
              {timeStatus && (
                <Badge className={timeStatus.color}>
                  {timeStatus.label}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Staff Information */}
            {staffDetails ? (
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={staffDetails?.color || "bg-gray-100"}>
                    {staffDetails?.avatar || appointment.staffName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{getFirstName(appointment.staffName)}</p>
                  <p className="text-sm text-gray-600 capitalize">{staffDetails?.role || "Stylist"}</p>
                </div>
              </div>
            ) : null}

            {/* Duration and Price */}
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="h-4 w-4 mr-2" />
                {appointment.duration} minutes
              </div>
              {appointment.price && (
                <div className="flex items-center text-sm text-gray-600">
                  <CurrencyDisplay amount={appointment.price} />
                </div>
              )}
            </div>
          </div>

          {/* Location and Booking Reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className={`flex items-center text-sm ${
              isHome ? 'text-blue-700 font-medium' : 'text-gray-600'
            }`}>
              {isHome ? (
                <Home className="h-4 w-4 mr-2" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              {getLocationName(appointment.location)}
            </div>
            {appointment.bookingReference && (
              <div className="flex items-center text-sm text-gray-600">
                <Hash className="h-4 w-4 mr-2" />
                {appointment.bookingReference}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex space-x-2">
              {(appointment.status === "confirmed" || appointment.status === "pending") &&
               isFuture(appointmentDate) && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelAppointmentId(appointment.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cancel Appointment</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to cancel your appointment for {appointment.service} on{" "}
                        {formatAppDate(appointmentDate)} at {formatAppTime(appointmentDate)}?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCancelAppointmentId(null)}>
                        Keep Appointment
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleCancelAppointment}
                        disabled={isCancelling}
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          "Cancel Appointment"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {appointment.status === "completed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReviewAppointment(appointment)
                    setIsReviewDialogOpen(true)
                  }}
                >
                  <Star className="h-4 w-4 mr-1" />
                  Leave Review
                </Button>
              )}
            </div>

            <Button variant="ghost" size="sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <ClientPortalLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">My Appointments</h1>
            <p className="text-gray-600">Manage your upcoming and past appointments</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button className="bg-pink-600 hover:bg-pink-700" asChild>
              <Link href="/client-portal/appointments/book">
                <Plus className="mr-2 h-4 w-4" />
                Book New Appointment
              </Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 text-pink-600 animate-spin mr-2" />
            <span className="text-lg text-gray-600">Loading appointments...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="upcoming">
                Upcoming
                {upcomingAppointments.length > 0 && (
                  <span className="ml-2 bg-pink-100 text-pink-800 rounded-full px-2 py-0.5 text-xs">
                    {upcomingAppointments.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="today">
                Today
                {todayAppointments.length > 0 && (
                  <span className="ml-2 bg-pink-100 text-pink-800 rounded-full px-2 py-0.5 text-xs">
                    {todayAppointments.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              {upcomingAppointments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
                      <Calendar className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No upcoming appointments</h3>
                    <p className="text-gray-500 text-center mb-6 max-w-md">
                      You don't have any upcoming appointments scheduled. Book your next appointment now.
                    </p>
                    <Button className="bg-pink-600 hover:bg-pink-700" asChild>
                      <Link href="/client-portal/appointments/book">
                        Book Appointment
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {upcomingAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="today">
              {todayAppointments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
                      <Clock className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No appointments today</h3>
                    <p className="text-gray-500 text-center mb-6 max-w-md">
                      You don't have any appointments scheduled for today.
                    </p>
                    <Button className="bg-pink-600 hover:bg-pink-700" asChild>
                      <Link href="/client-portal/appointments/book">
                        Book Appointment
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {todayAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      showTimeStatus={true}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past">
              {pastAppointments.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
                      <Calendar className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No past appointments</h3>
                    <p className="text-gray-500 text-center mb-6 max-w-md">
                      Your appointment history will appear here after you complete your first appointment.
                    </p>
                    <Button className="bg-pink-600 hover:bg-pink-700" asChild>
                      <Link href="/client-portal/appointments/book">
                        Book Your First Appointment
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {pastAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Review Dialog */}
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Leave a Review</DialogTitle>
              <DialogDescription>
                How was your experience with {reviewAppointment?.service}?
              </DialogDescription>
            </DialogHeader>
            {reviewAppointment && (
              <ReviewForm
                open={isReviewDialogOpen}
                onOpenChange={setIsReviewDialogOpen}
                itemId={reviewAppointment?.id || ""}
                itemName={reviewAppointment?.service || ""}
                itemType="service"
                staffId={reviewAppointment?.staffId}
                staffName={reviewAppointment?.staffName}
                onSubmit={(data: ReviewFormData) => {
                  console.log("Review submitted:", data)
                  toast({
                    title: "Review submitted",
                    description: "Thank you for your feedback!",
                  })
                  setIsReviewDialogOpen(false)
                  setReviewAppointment(null)
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ClientPortalLayout>
  )
}
