"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useLocations } from "@/lib/location-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { parseISO, format } from "date-fns"
import { formatAppDate, formatAppTime } from "@/lib/date-utils"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  MapPin,
  User,
  Calendar,
  CheckCircle2,
  Clock3,
  AlertCircle,
  ChevronDown,
  Info,
  Scissors,
  ShoppingBag,
  DollarSign,
  CreditCard,
  Home
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { useCurrency } from "@/lib/currency-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PaymentDialog } from "@/components/pos/payment-dialog"
import { useTransactions } from "@/lib/transaction-provider"
import { TransactionType, TransactionSource, TransactionStatus, PaymentMethod } from "@/lib/transaction-types"
import { transactionDeduplicationService } from "@/lib/transaction-deduplication-service"
import { ConsolidatedTransactionService } from "@/lib/consolidated-transaction-service"
import { Appointment, AppointmentStatusHistory } from "@/lib/types/appointment"
// DEPRECATED: Mock data removed - now using real API data
import { useServices } from "@/lib/service-provider"
import { RescheduleAppointmentDialog } from "./reschedule-appointment-dialog"
import { ChangeStaffDialog } from "./change-staff-dialog"
import { EditAppointmentDetailsDialog } from "./edit-appointment-details-dialog"

// Extended appointment status type to include "arrived" and "service-started"
type ExtendedAppointmentStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "service-started"
  | "completed"
  | "cancelled"
  | "no-show";

interface EnhancedAppointmentDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Appointment
  onStatusChange?: (appointmentId: string, newStatus: string, timestamp?: string) => void
  onAppointmentUpdated?: (appointment: Appointment) => void
  existingAppointments?: Appointment[]
}

export function EnhancedAppointmentDetailsDialog({
  open,
  onOpenChange,
  appointment,
  onStatusChange,
  onAppointmentUpdated,
  existingAppointments = [],
}: EnhancedAppointmentDetailsDialogProps) {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const { formatCurrency } = useCurrency()
  const { addTransaction, transactions } = useTransactions()
  const { services } = useServices()
  const { getLocationById } = useLocations()
  const [activeTab, setActiveTab] = useState("details")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<any>(null)

  // Dialog states for other actions
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false)
  const [isChangeStaffDialogOpen, setIsChangeStaffDialogOpen] = useState(false)
  const [isEditDetailsDialogOpen, setIsEditDetailsDialogOpen] = useState(false)

  if (!appointment) return null

  const appointmentDate = parseISO(appointment.date)

  // Handle appointment updates from child dialogs
  const handleAppointmentUpdate = (updatedAppointment: Appointment) => {
    if (onAppointmentUpdated) {
      onAppointmentUpdated(updatedAppointment)
    }
  }

  // Get initials for avatar
  const getInitials = (name: string | undefined) => {
    if (!name || typeof name !== 'string') {
      return 'N/A';
    }
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  // Check if appointment is a home service
  const isHomeService = (location: string) => {
    return location?.toLowerCase().includes('home service') || location?.toLowerCase() === 'home';
  };

  // Status colors for badges
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-green-100 text-green-800 border-green-200",
    arrived: "bg-blue-100 text-blue-800 border-blue-200",
    "service-started": "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-gray-100 text-gray-800 border-gray-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    "no-show": "bg-orange-100 text-orange-800 border-orange-200",
    blocked: "bg-slate-100 text-slate-800 border-slate-200",
  };

  // Status icons
  const statusIcons = {
    pending: <AlertCircle className="h-5 w-5" />,
    confirmed: <CheckCircle2 className="h-5 w-5" />,
    arrived: <User className="h-5 w-5" />,
    "service-started": <Clock3 className="h-5 w-5" />,
    completed: <CheckCircle2 className="h-5 w-5" />,
    blocked: <Clock className="h-5 w-5" />,
  };

  // Find status history entries
  const findStatusEntry = (status: string) => {
    return appointment.statusHistory?.find(h => h.status === status);
  };

  // Check if a status can be updated based on the current status and status history
  const canUpdateToStatus = (newStatus: ExtendedAppointmentStatus): boolean => {
    // Define the status progression order
    const statusProgression = ['pending', 'confirmed', 'arrived', 'service-started', 'completed'];

    // Terminal statuses that cannot be changed
    const terminalStatuses = ['completed', 'cancelled', 'no-show'];

    // If current status is a terminal status, no changes allowed
    if (terminalStatuses.includes(appointment.status)) {
      return false;
    }

    // For cancellation statuses, allow only if not in a terminal status
    if (newStatus === 'cancelled' || newStatus === 'no-show') {
      return !terminalStatuses.includes(appointment.status);
    }

    // For normal progression, only allow moving forward in the workflow
    const currentIndex = statusProgression.indexOf(appointment.status);
    const newIndex = statusProgression.indexOf(newStatus);

    // Only allow moving to the next status in the progression
    return newIndex === currentIndex + 1;
  };

  // Check if the appointment has a specific status in its history
  const hasStatusInHistory = (status: string): boolean => {
    return appointment.statusHistory?.some(entry => entry.status === status) || false;
  };

  // Handle status update
  const handleStatusChange = (newStatus: ExtendedAppointmentStatus) => {
    // Check if the status can be updated
    if (!canUpdateToStatus(newStatus)) {
      toast({
        variant: "destructive",
        title: "Cannot Update Status",
        description: "Status updates must follow the proper workflow and cannot be reversed.",
      });
      return;
    }

    // If completing appointment and there's a total amount, show payment dialog
    if (newStatus === 'completed' && calculateTotal() > 0) {
      setIsPaymentDialogOpen(true);
      return;
    }

    // Otherwise, proceed with status update
    performStatusUpdate(newStatus);
  };

  // Perform the actual status update
  const performStatusUpdate = (newStatus: ExtendedAppointmentStatus) => {
    setIsUpdating(true);
    try {
      if (onStatusChange) {
        const timestamp = new Date().toISOString();
        onStatusChange(appointment.id, newStatus, timestamp);
      }

      toast({
        description: `Appointment status updated to ${newStatus.replace('-', ' ')}.`,
      });

      // Close the dialog after status update
      setTimeout(() => {
        onOpenChange(false);
      }, 500);

      setIsUpdating(false);
    } catch (error) {
      console.error("Failed to update appointment:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update appointment status.",
      });
      setIsUpdating(false);
    }
  };

  // Handle payment completion
  const handlePaymentComplete = (paymentMethod: string, giftCardCode?: string, giftCardAmount?: number, discountPercentage?: number, discountAmount?: number) => {
    try {
      // Record the transaction
      recordAppointmentTransaction(paymentMethod, discountPercentage, discountAmount);

      // Update appointment with payment information AND status to completed
      const updatedAppointment = {
        ...appointment,
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod: paymentMethod,
        paymentDate: new Date().toISOString(),
        transactionRecorded: true, // Flag to prevent duplicate transaction creation
        statusHistory: [
          ...(appointment.statusHistory || []),
          {
            status: 'completed',
            timestamp: new Date().toISOString(),
            updatedBy: 'Staff'
          }
        ]
      };

      console.log("💰 Enhanced Dialog: Payment completed, updating appointment", {
        appointmentId: appointment.id,
        clientName: appointment.clientName,
        paymentMethod,
        paymentStatus: 'paid',
        total: calculateTotal()
      });

      // Notify parent component of the update
      if (onAppointmentUpdated) {
        onAppointmentUpdated(updatedAppointment);
      }

      // Close payment dialog
      setIsPaymentDialogOpen(false);

      const finalAmount = discountAmount ? calculateTotal() - discountAmount : calculateTotal();
      const description = discountAmount && discountAmount > 0
        ? `Payment of ${formatCurrency(finalAmount)} completed successfully (${discountPercentage}% discount applied: -${formatCurrency(discountAmount)}).`
        : `Payment of ${formatCurrency(finalAmount)} completed successfully.`;

      toast({
        title: "Payment Processed",
        description,
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: "Failed to process payment. Please try again.",
      });
    }
  };

  // Record appointment transaction using consolidated approach
  const recordAppointmentTransaction = (paymentMethod: string, discountPercentage?: number, discountAmount?: number) => {
    try {
      console.log("Enhanced dialog - Recording consolidated transaction for appointment:", appointment);

      // Ensure price is set from service data if missing
      if (appointment.service && !appointment.price) {
        // TODO: Replace with real API call to fetch service price
        console.log(`Enhanced dialog - Price lookup needed for service: ${appointment.service}`);
      }

      const originalAmount = calculateTotal();

      console.log("Enhanced dialog - Recording consolidated appointment transaction:", {
        originalAmount,
        discountPercentage,
        discountAmount
      });

      if (originalAmount <= 0) {
        console.log("Enhanced dialog - No amount to charge, skipping transaction");
        return;
      }

      // Check if transaction should be recorded using deduplication service
      const existingTransactions = transactions.filter(tx => 
        tx.reference?.type === 'appointment' && 
        tx.reference?.id === appointment.id
      );

      if (existingTransactions.length > 0) {
        console.log("Enhanced dialog - Transaction already exists for this appointment, skipping");
        return;
      }

      // Determine payment method enum
      let paymentMethodEnum = PaymentMethod.CASH;
      if (paymentMethod.toLowerCase().includes('card') || paymentMethod.toLowerCase().includes('credit')) {
        paymentMethodEnum = PaymentMethod.CREDIT_CARD;
      } else if (paymentMethod.toLowerCase().includes('mobile')) {
        paymentMethodEnum = PaymentMethod.MOBILE_PAYMENT;
      }

      // Create consolidated transaction using the new service
      const consolidatedTransaction = ConsolidatedTransactionService.createConsolidatedTransaction(
        appointment,
        paymentMethodEnum,
        discountPercentage,
        discountAmount
      );

      console.log('📊 CREATING CONSOLIDATED TRANSACTION:', {
        transactionId: consolidatedTransaction.id,
        totalAmount: consolidatedTransaction.amount,
        serviceAmount: consolidatedTransaction.serviceAmount,
        productAmount: consolidatedTransaction.productAmount,
        discountApplied: consolidatedTransaction.discountPercentage && consolidatedTransaction.discountPercentage > 0,
        itemCount: consolidatedTransaction.items?.length || 0
      });

      // Add the consolidated transaction
      const result = addTransaction(consolidatedTransaction);
      console.log("🔍 Enhanced dialog - Consolidated transaction add result:", result);

      if (result) {
        console.log("✅ Consolidated transaction created successfully:", {
          transactionId: consolidatedTransaction.id,
          totalAmount: consolidatedTransaction.amount,
          serviceAmount: consolidatedTransaction.serviceAmount,
          productAmount: consolidatedTransaction.productAmount,
          discountAmount: consolidatedTransaction.discountAmount
        });

        // Store the transaction for the payment dialog
        setLastTransaction(consolidatedTransaction);
      } else {
        console.error("❌ Failed to create consolidated transaction");
      }

      // Verify consolidated transaction recording
      console.log("Enhanced dialog - Consolidated transaction recording verification:", {
        originalTotal: originalAmount,
        consolidatedAmount: consolidatedTransaction.amount,
        serviceAmount: consolidatedTransaction.serviceAmount,
        productAmount: consolidatedTransaction.productAmount,
        discountAmount: consolidatedTransaction.discountAmount,
        breakdown: {
          services: `${consolidatedTransaction.serviceAmount || 0}`,
          products: `${consolidatedTransaction.productAmount || 0}`,
          total: `${consolidatedTransaction.serviceAmount || 0} + ${consolidatedTransaction.productAmount || 0} = ${consolidatedTransaction.amount}`
        }
      });

      // Force a localStorage check to verify the consolidated transaction was saved
      setTimeout(() => {
        const storedTransactions = localStorage.getItem('vanity_transactions');
        if (storedTransactions) {
          const parsed = JSON.parse(storedTransactions);
          console.log("Enhanced dialog - Transactions in localStorage after appointment completion:", parsed.length);
          const appointmentTransactions = parsed.filter((tx: any) =>
            tx.source === 'calendar' &&
            tx.reference?.type === 'appointment' &&
            tx.reference?.id === appointment.id
          );
          console.log("Enhanced dialog - This appointment's consolidated transactions in localStorage:", appointmentTransactions.length);

          const consolidatedTransactions = appointmentTransactions.filter((tx: any) => tx.type === 'consolidated_sale');
          const serviceTransactions = appointmentTransactions.filter((tx: any) => tx.type === 'service_sale');
          const productTransactions = appointmentTransactions.filter((tx: any) => tx.type === 'product_sale');

          console.log("Enhanced dialog - Consolidated transaction breakdown:", {
            consolidatedTransactions: consolidatedTransactions.length,
            serviceTransactions: serviceTransactions.length,
            productTransactions: productTransactions.length,
            consolidatedDetails: consolidatedTransactions.map(tx => ({
              id: tx.id,
              amount: tx.amount,
              serviceAmount: tx.serviceAmount,
              productAmount: tx.productAmount,
              discountAmount: tx.discountAmount,
              itemCount: tx.items?.length || 0
            })),
            allTransactionTypes: appointmentTransactions.map(tx => ({ id: tx.id, type: tx.type, amount: tx.amount }))
          });
        }
      }, 1000);

      console.log("Enhanced dialog - Appointment transactions recorded for:", appointment.id);
    } catch (error) {
      console.error("Error recording appointment transaction:", error);
      throw error;
    }
  };

  // Get status display name
  const getStatusDisplayName = (status: string | undefined) => {
    // Handle undefined or null status
    if (!status) {
      // For blocked time entries, return "Blocked"
      if (appointment.type === "blocked") {
        return "Blocked";
      }
      // Default fallback
      return "Unknown";
    }
    return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
  };

  // Get location name - handles both standard IDs and database-generated IDs
  const getLocationName = (locationId: string) => {
    // Debug logging to help identify location ID issues
    console.log("🔍 Appointment location ID:", locationId);

    // Handle standard location IDs
    switch (locationId) {
      case "loc1":
        return "D-Ring Road Salon";
      case "loc2":
        return "Muaither Salon";
      case "loc3":
        return "Medinat Khalifa Salon";
      case "loc4":
        return "Home Service";
      case "home":
        return "Home Service";
      default:
        // Handle database-generated location IDs by checking if it's a long ID
        if (locationId && locationId.length > 10) {
          // This is likely a database-generated ID, try to map it using the locations context
          const location = getLocationById(locationId);
          if (location) {
            console.log("🔍 Found location by ID:", location.name);
            return location.name;
          }
        }

        console.warn("⚠️ Unknown location ID:", locationId);
        return "Unknown Location";
    }
  };

  // Calculate total amount from all services and products
  const calculateTotal = () => {
    let total = 0;

    // Add main service price
    if (typeof appointment.price === 'number') {
      total += appointment.price;
    }

    // Add additional services prices
    if (appointment.additionalServices && appointment.additionalServices.length > 0) {
      appointment.additionalServices.forEach((service: any) => {
        if (typeof service.price === 'number') {
          total += service.price;
        }
      });
    }

    // Add products prices
    if (appointment.products && appointment.products.length > 0) {
      appointment.products.forEach((product: any) => {
        if (typeof product.price === 'number') {
          total += product.price;
        }
      });
    }

    return total;
  };

  // Calculate service total (excluding products)
  const calculateServiceTotal = () => {
    let total = 0;

    // Add main service price
    if (typeof appointment.price === 'number') {
      total += appointment.price;
    }

    // Add additional services prices
    if (appointment.additionalServices && appointment.additionalServices.length > 0) {
      appointment.additionalServices.forEach((service: any) => {
        if (typeof service.price === 'number') {
          total += service.price;
        }
      });
    }

    return total;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[550px] md:max-w-[600px] p-0 overflow-hidden ${
        isHomeService(appointment.location) ? 'border-l-4 border-l-blue-500' : ''
      }`}>
        <DialogHeader className={`p-6 pb-2 sticky top-0 z-10 ${
          isHomeService(appointment.location) ? 'bg-blue-50/50' : 'bg-background'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <DialogTitle>{appointment.type === "blocked" ? "Blocked Time" : "Appointment Details"}</DialogTitle>
              {isHomeService(appointment.location) && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                  <Home className="h-3 w-3 mr-1" />
                  Home Service
                </Badge>
              )}
            </div>
            <Badge
              className={`${statusColors[appointment.status as keyof typeof statusColors] || statusColors.pending}`}
            >
              {getStatusDisplayName(appointment.status)}
            </Badge>
          </div>
          <DialogDescription>
            {appointment.type === "blocked"
              ? "View details for this blocked time slot"
              : "View and manage appointment details"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid ${appointment.type === "blocked" ? "grid-cols-1" : "grid-cols-2"} mx-6`}>
            <TabsTrigger value="details">Details</TabsTrigger>
            {appointment.type !== "blocked" && (
              <TabsTrigger value="actions">Actions</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="p-6 pt-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-6">
              {/* Client Info or Blocked Time Info */}
              {appointment.type === "blocked" ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 bg-slate-100 text-slate-800">
                    <AvatarFallback>{appointment.blockType ? appointment.blockType.charAt(0).toUpperCase() : "B"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{appointment.title || "Blocked Time"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {appointment.blockType ?
                        appointment.blockType.charAt(0).toUpperCase() + appointment.blockType.slice(1) + " Time"
                        : "Blocked Time"
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 bg-gray-100 text-gray-800">
                    <AvatarFallback>{getInitials(appointment.clientName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{appointment.clientName}</h3>
                      {appointment.bookingReference && (
                        <Badge className="bg-pink-100 text-pink-800 border-pink-200 ml-2">
                          Ref: {appointment.bookingReference}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Status Timeline - Only show for regular appointments, not for blocked time */}
              {appointment.type !== "blocked" && (
                <div className="relative pt-2 pb-8">
                  <div className="flex justify-between">
                    {['pending', 'confirmed', 'arrived', 'service-started', 'completed'].map((step, index) => {
                      const statusEntry = findStatusEntry(step);
                      const isCompleted = statusEntry !== undefined;
                      const isCurrent = appointment.status === step;

                      // For pending status, always show timestamp even if not in status history
                      const showTimestamp = step === 'pending'
                        ? (statusEntry?.timestamp || appointment.statusHistory?.[0]?.timestamp)
                        : statusEntry?.timestamp;

                      return (
                        <div key={step} className="flex flex-col items-center relative z-10">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center
                              ${isCompleted ?
                                step === 'pending' ? 'bg-yellow-500 text-white' :
                                step === 'confirmed' ? 'bg-blue-500 text-white' :
                                step === 'arrived' ? 'bg-indigo-500 text-white' :
                                step === 'service-started' ? 'bg-purple-500 text-white' :
                                'bg-green-500 text-white'
                              :
                                isCurrent ?
                                  step === 'pending' ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500' :
                                  step === 'confirmed' ? 'bg-blue-100 text-blue-800 border-2 border-blue-500' :
                                  step === 'arrived' ? 'bg-indigo-100 text-indigo-800 border-2 border-indigo-500' :
                                  step === 'service-started' ? 'bg-purple-100 text-purple-800 border-2 border-purple-500' :
                                  'bg-green-100 text-green-800 border-2 border-green-500'
                                :
                                'bg-gray-100 text-gray-400'
                              }`}
                          >
                            {statusIcons[step as keyof typeof statusIcons] || <AlertCircle className="h-5 w-5" />}
                          </div>
                          <span className="mt-2 text-xs font-medium">
                            {step === 'service-started' ? 'Service Started' : step.charAt(0).toUpperCase() + step.slice(1)}
                          </span>
                          {showTimestamp && (
                            step === 'pending' ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 mt-1 cursor-help">
                                      <span className="text-xs text-muted-foreground">
                                        {format(parseISO(showTimestamp), "dd-MM-yyyy HH:mm")}
                                      </span>
                                      <Info className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Booking created on {format(parseISO(showTimestamp), "dd-MM-yyyy 'at' HH:mm")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-xs text-muted-foreground mt-1">
                                {format(parseISO(showTimestamp), "dd-MM-yyyy HH:mm")}
                              </span>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Connecting Line */}
                  <div className="absolute top-4 left-0 right-0 h-[2px] bg-gray-200 -translate-y-1/2" />
                  <div
                    className="absolute top-4 left-0 h-[2px] -translate-y-1/2 transition-all duration-300"
                    style={{
                      width: (() => {
                        const steps = ['pending', 'confirmed', 'arrived', 'service-started', 'completed'];
                        const currentIndex = steps.indexOf(appointment.status);
                        if (currentIndex === -1) return '0%';
                        return `${(currentIndex / (steps.length - 1)) * 100}%`;
                      })(),
                      background: 'linear-gradient(to right, #eab308, #3b82f6, #6366f1, #a855f7, #22c55e)'
                    }}
                  />
                </div>
              )}

              {/* Service Details - Moved to the top for easy access */}
              <div className="space-y-4">
                {appointment.type !== "blocked" && (
                  <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-md">
                    <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                      <Scissors className="h-5 w-5 text-gray-500" />
                    </div>
                    <div className="w-full">
                      <h4 className="font-medium">Services</h4>
                      <div className="text-sm text-gray-600 space-y-2 mt-1">
                        {/* Main service */}
                        <div className="flex justify-between">
                          <span className="font-medium">{appointment.service}</span>
                          <span className="font-medium"><CurrencyDisplay amount={typeof appointment.price === 'number' ? appointment.price : 0} /></span>
                        </div>

                        {/* Additional services */}
                        {appointment.additionalServices && appointment.additionalServices.length > 0 && (
                          <>
                            {appointment.additionalServices.map((service: any, index: number) => (
                              <div key={`service-${index}`} className="flex justify-between">
                                <span>{service.name}</span>
                                <span><CurrencyDisplay amount={typeof service.price === 'number' ? service.price : 0} /></span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Products Section - Only show if there are products */}
                {appointment.products && appointment.products.length > 0 && (
                  <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-md">
                    <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                      <ShoppingBag className="h-5 w-5 text-gray-500" />
                    </div>
                    <div className="w-full">
                      <h4 className="font-medium">Products</h4>
                      <div className="text-sm text-gray-600 space-y-2 mt-1">
                        {appointment.products.map((product: any, index: number) => (
                          <div key={`product-${index}`} className="flex justify-between">
                            <span>{product.quantity ? `${product.quantity}x ${product.name}` : product.name}</span>
                            <span><CurrencyDisplay amount={typeof product.price === 'number' ? product.price : 0} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Total Amount - Only show if there are services or products */}
                {(appointment.price ||
                  (appointment.additionalServices && appointment.additionalServices.length > 0) ||
                  (appointment.products && appointment.products.length > 0)) && (
                  <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-md">
                    <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                      <DollarSign className="h-5 w-5 text-gray-500" />
                    </div>
                    <div className="w-full">
                      <h4 className="font-medium">Total</h4>

                      {/* Show discount information if payment completed with discount */}
                      {appointment.paymentStatus === 'paid' && appointment.discountPercentage && appointment.discountAmount && (
                        <div className="space-y-2 mt-2">
                          <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-green-700 font-medium">
                                Discount Applied ({appointment.discountPercentage}%)
                              </span>
                              <span className="text-green-600 font-medium">
                                -<CurrencyDisplay amount={appointment.discountAmount} />
                              </span>
                            </div>
                            {appointment.originalAmount && (
                              <div className="flex justify-between items-center text-xs text-green-600 mt-1">
                                <span>Original Total:</span>
                                <span className="line-through">
                                  <CurrencyDisplay amount={appointment.originalAmount} />
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="text-sm font-medium mt-1 flex justify-between">
                        <span>
                          {appointment.paymentStatus === 'paid' && appointment.discountAmount ? 'Final Amount' : 'Total Amount'}
                        </span>
                        <span className="font-bold">
                          <CurrencyDisplay amount={
                            appointment.paymentStatus === 'paid' && appointment.finalAmount
                              ? appointment.finalAmount
                              : calculateTotal()
                          } />
                        </span>
                      </div>

                      {/* Payment status badge */}
                      {appointment.paymentStatus === 'paid' && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                          <span className="text-sm text-gray-600">Payment Status</span>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Paid via {appointment.paymentMethod}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {appointment.type === "blocked" ? (
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                      <Clock className="h-5 w-5 text-gray-500" />
                    </div>
                    <div>
                      <h4 className="font-medium">Type</h4>
                      <p className="text-sm text-gray-600">
                        {appointment.blockType ?
                          appointment.blockType.charAt(0).toUpperCase() + appointment.blockType.slice(1)
                          : "Blocked Time"
                        }
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                    <Calendar className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">Date & Time</h4>
                    <p className="text-sm text-gray-600">
                      {formatAppDate(appointmentDate)}
                      <br />
                      {formatAppTime(appointmentDate)} - {formatAppTime(new Date(appointmentDate.getTime() + appointment.duration * 60000))}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">Staff</h4>
                    <p className="text-sm text-gray-600">
                      {appointment.staffName} (Barber)
                    </p>
                  </div>
                </div>

                <div className={`flex items-start gap-3 p-3 rounded-md ${
                  isHomeService(appointment.location)
                    ? 'bg-blue-50 border border-blue-200'
                    : ''
                }`}>
                  <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                    {isHomeService(appointment.location) ? (
                      <Home className="h-5 w-5 text-blue-600" />
                    ) : (
                      <MapPin className="h-5 w-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">Location</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`text-sm ${
                        isHomeService(appointment.location) ? 'text-blue-700 font-medium' : 'text-gray-600'
                      }`}>
                        {getLocationName(appointment.location)}
                      </p>
                      {isHomeService(appointment.location) && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                          Home Visit
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                    <Clock className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">Duration</h4>
                    <p className="text-sm text-gray-600">
                      {appointment.duration} minutes
                    </p>
                  </div>
                </div>

                {/* Booking Reference - Only show if available */}
                {appointment.bookingReference && (
                  <div className="flex items-start gap-3 bg-pink-50 p-3 rounded-md">
                    <div className="w-5 h-5 mt-0.5 flex-shrink-0">
                      <Info className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-pink-800">Booking Reference</h4>
                      <p className="text-sm font-bold text-pink-700">
                        {appointment.bookingReference}
                      </p>
                      <p className="text-xs text-pink-600 mt-1">
                        Use this reference number for any inquiries about this appointment
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="p-6 pt-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Update Status</h3>
                <p className="text-sm text-muted-foreground">
                  Current status: <span className="font-medium">{getStatusDisplayName(appointment.status)}</span>
                </p>

                <div className="grid grid-cols-1 gap-2 mt-4">
                  {/* Show status options based on the current status and progression */}
                  {(() => {
                    const steps = ['pending', 'confirmed', 'arrived', 'service-started', 'completed'];
                    const currentIndex = steps.indexOf(appointment.status);
                    const terminalStatuses = ['completed', 'cancelled', 'no-show'];

                    // If the appointment is in a terminal status, show the status info
                    if (terminalStatuses.includes(appointment.status)) {
                      return (
                        <div className="p-4 rounded-md bg-gray-50 text-center">
                          {appointment.status === "completed" && (
                            <div className="flex flex-col items-center">
                              <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                              <p className="font-medium text-gray-700">This appointment has been completed</p>
                              <p className="text-sm text-gray-500 mt-1">
                                Completed on {findStatusEntry('completed')?.timestamp ?
                                  format(parseISO(findStatusEntry('completed')!.timestamp), "dd-MM-yyyy 'at' HH:mm") :
                                  'unknown date'}
                              </p>
                            </div>
                          )}

                          {appointment.status === "cancelled" && (
                            <div className="flex flex-col items-center">
                              <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                              <p className="font-medium text-gray-700">This appointment has been cancelled</p>
                              <p className="text-sm text-gray-500 mt-1">
                                Cancelled on {findStatusEntry('cancelled')?.timestamp ?
                                  format(parseISO(findStatusEntry('cancelled')!.timestamp), "dd-MM-yyyy 'at' HH:mm") :
                                  'unknown date'}
                              </p>
                            </div>
                          )}

                          {appointment.status === "no-show" && (
                            <div className="flex flex-col items-center">
                              <AlertCircle className="h-8 w-8 text-orange-500 mb-2" />
                              <p className="font-medium text-gray-700">Client did not show up for this appointment</p>
                              <p className="text-sm text-gray-500 mt-1">
                                Marked as no-show on {findStatusEntry('no-show')?.timestamp ?
                                  format(parseISO(findStatusEntry('no-show')!.timestamp), "dd-MM-yyyy 'at' HH:mm") :
                                  'unknown date'}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // For non-terminal statuses, show only the next available status option
                    return (
                      <>
                        {/* Show the next status in the progression */}
                        {currentIndex >= 0 && currentIndex < steps.length - 1 && (
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => handleStatusChange(steps[currentIndex + 1] as ExtendedAppointmentStatus)}
                            disabled={isUpdating}
                          >
                            {steps[currentIndex + 1] === "confirmed" && (
                              <><CheckCircle2 className="mr-2 h-4 w-4 text-blue-500" />Confirm Appointment</>
                            )}
                            {steps[currentIndex + 1] === "arrived" && (
                              <><User className="mr-2 h-4 w-4 text-indigo-500" />Mark as Arrived</>
                            )}
                            {steps[currentIndex + 1] === "service-started" && (
                              <><Clock3 className="mr-2 h-4 w-4 text-purple-500" />Service Started</>
                            )}
                            {steps[currentIndex + 1] === "completed" && (
                              <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />Mark as Completed</>
                            )}
                          </Button>
                        )}

                        {/* Show cancellation options only if not already cancelled or no-show */}
                        {!hasStatusInHistory('cancelled') && !hasStatusInHistory('no-show') && (
                          <>
                            <Button
                              variant="outline"
                              className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleStatusChange("cancelled")}
                              disabled={isUpdating}
                            >
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Cancel Appointment
                            </Button>

                            <Button
                              variant="outline"
                              className="justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => handleStatusChange("no-show")}
                              disabled={isUpdating}
                            >
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Mark as No-Show
                            </Button>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <Separator />

              {/* Only show Other Actions if not in a terminal status */}
              {!['completed', 'cancelled', 'no-show'].includes(appointment.status) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Other Actions</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => setIsRescheduleDialogOpen(true)}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Reschedule Appointment
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => setIsChangeStaffDialogOpen(true)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Change Staff
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start"
                      onClick={() => setIsEditDetailsDialogOpen(true)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Edit Details
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Payment Dialog */}
      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open);
          if (!open) setLastTransaction(null);
        }}
        total={calculateTotal()}
        serviceTotal={calculateServiceTotal()}
        onComplete={handlePaymentComplete}
        lastTransaction={lastTransaction}
      />

      {/* Reschedule Dialog */}
      <RescheduleAppointmentDialog
        open={isRescheduleDialogOpen}
        onOpenChange={setIsRescheduleDialogOpen}
        appointment={appointment}
        onAppointmentUpdated={handleAppointmentUpdate}
        existingAppointments={existingAppointments}
      />

      {/* Change Staff Dialog */}
      <ChangeStaffDialog
        open={isChangeStaffDialogOpen}
        onOpenChange={setIsChangeStaffDialogOpen}
        appointment={appointment}
        onAppointmentUpdated={handleAppointmentUpdate}
        existingAppointments={existingAppointments}
      />

      {/* Edit Details Dialog */}
      <EditAppointmentDetailsDialog
        open={isEditDetailsDialogOpen}
        onOpenChange={setIsEditDetailsDialogOpen}
        appointment={appointment}
        onAppointmentUpdated={handleAppointmentUpdate}
      />
    </Dialog>
  )
}

