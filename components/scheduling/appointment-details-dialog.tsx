"use client"

import { useState } from "react"
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
import { parseISO, format } from "date-fns"
import { formatAppDate, formatAppTime } from "@/lib/date-utils"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Clock, Scissors, User, DollarSign, History, Check, X, AlertTriangle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Appointment, AppointmentStatusHistory } from "@/lib/types/appointment"

interface AppointmentDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Appointment
  onStatusChange?: (appointmentId: string, newStatus: string) => void
}

export function AppointmentDetailsDialog({
  open,
  onOpenChange,
  appointment,
  onStatusChange,
}: AppointmentDetailsDialogProps) {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const [status, setStatus] = useState<string>(appointment?.status || "pending")
  const [isUpdating, setIsUpdating] = useState(false)

  if (!appointment) return null

  const appointmentDate = parseISO(appointment.date)
  const statusColors = {
    pending: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    "checked-in": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    "no-show": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  }

  // Check if status can be updated (prevent reversing completed status)
  const canUpdateStatus = (newStatus: string) => {
    if (appointment.status === "completed") {
      return false
    }
    if (appointment.status === "cancelled" || appointment.status === "no-show") {
      return false
    }
    return true
  }

  const handleStatusChange = async () => {
    if (!canUpdateStatus(status)) {
      toast({
        variant: "destructive",
        title: "Cannot Update Status",
        description: "This appointment's status cannot be changed once it is completed, cancelled, or marked as no-show.",
      })
      return
    }

    setIsUpdating(true)
    try {
      // In a real app, this would update the appointment via API
      if (onStatusChange) {
        onStatusChange(appointment.id, status)
      }

      toast({
        description: `Appointment status updated to ${status}.`,
      })

      setIsUpdating(false)
      // Keep the dialog open so the user can see the updated status history
      // The parent component will update the appointment prop with the new status history
    } catch (error) {
      console.error("Failed to update appointment:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update appointment status.",
      })
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Appointment Details</DialogTitle>
          <DialogDescription>View and manage appointment information</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{appointment.clientName}</h3>
              <p className="text-sm text-muted-foreground">Client ID: {appointment.clientId}</p>
            </div>
            <Badge className={statusColors[appointment.status as keyof typeof statusColors] || "bg-gray-100"}>
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Status Timeline</h4>
            </div>

            <div className="relative">
              <div className="flex justify-between mb-8">
                {['pending', 'confirmed', 'checked-in', 'completed'].map((step, index) => {
                  const statusEntry = appointment.statusHistory?.find(h => h.status === step);
                  const isCompleted = statusEntry !== undefined;
                  const isCurrent = appointment.status === step;
                  const creationEntry = appointment.statusHistory?.[0];
                  
                  return (
                    <div key={step} className="flex flex-col items-center relative z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center
                          ${isCompleted ? 'bg-primary text-primary-foreground' : 
                            isCurrent ? 'bg-primary/20 text-primary border-2 border-primary' : 
                            'bg-muted text-muted-foreground'}`}
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : 
                         isCurrent ? <div className="w-2 h-2 bg-primary rounded-full" /> : 
                         <div className="w-2 h-2 bg-muted-foreground rounded-full" />}
                      </div>
                      <span className="mt-2 text-sm font-medium capitalize">{step.replace('-', ' ')}</span>
                      {statusEntry?.timestamp && (
                        <span className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(statusEntry.timestamp), "MMM d, h:mm a")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Connecting Line */}
              <div className="absolute top-4 left-0 right-0 h-[2px] bg-muted -translate-y-1/2" />
              <div 
                className="absolute top-4 left-0 h-[2px] bg-primary -translate-y-1/2 transition-all duration-300"
                style={{
                  width: (() => {
                    const steps = ['pending', 'confirmed', 'checked-in', 'completed'];
                    const currentIndex = steps.indexOf(appointment.status);
                    const completedSteps = appointment.statusHistory?.filter(h => steps.includes(h.status)).length || 0;
                    return `${(completedSteps / (steps.length - 1)) * 100}%`;
                  })()
                }}
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Date & Time:</span>
              <span>{formatAppDate(appointmentDate)} at {formatAppTime(appointmentDate)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Service:</span>
              <span>{appointment.service}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Duration:</span>
              <span>{appointment.duration} minutes</span>
            </div>

            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Staff:</span>
              <span>{appointment.staffName}</span>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Payment:</span>
              <span>Not processed</span>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-6">
            <ScrollArea className="h-[100px] rounded-md border p-2">
              {(appointment.statusHistory || []).map((history, index) => (
                <div key={index} className="flex justify-between items-center py-1">
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[history.status]}>
                      {history.status.charAt(0).toUpperCase() + history.status.slice(1)}
                    </Badge>
                    {history.updatedBy && <span className="text-sm text-muted-foreground">by {history.updatedBy}</span>}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(parseISO(history.timestamp), "HH:mm")}
                  </span>
                </div>
              ))}
            </ScrollArea>

            {hasPermission("edit_appointment") && canUpdateStatus(appointment.status) && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Update Status</h4>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="checked-in">Checked In</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no-show">No-show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            {hasPermission("edit_appointment") && (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Edit Appointment
              </Button>
            )}

            {hasPermission("edit_appointment") && status !== appointment.status && (
              <Button onClick={handleStatusChange} disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update Status"}
              </Button>
            )}

            {(!hasPermission("edit_appointment") || status === appointment.status) && (
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

