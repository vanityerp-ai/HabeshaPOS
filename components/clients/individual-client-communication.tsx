"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Phone, 
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Plus
} from "lucide-react"

interface Client {
  id: string
  name: string
  email: string
  phone: string
  segment?: string
  status: string
}

interface CommunicationRecord {
  id: string
  type: "email" | "sms" | "call"
  subject?: string
  content: string
  status: "sent" | "delivered" | "read" | "failed"
  sentAt: Date
  readAt?: Date
  sentBy: string
}

interface IndividualClientCommunicationProps {
  client: Client
}

export function IndividualClientCommunication({ client }: IndividualClientCommunicationProps) {
  const { toast } = useToast()
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false)
  const [isCallLogDialogOpen, setIsCallLogDialogOpen] = useState(false)
  
  // Form states
  const [emailSubject, setEmailSubject] = useState("")
  const [emailContent, setEmailContent] = useState("")
  const [smsContent, setSmsContent] = useState("")
  const [callNotes, setCallNotes] = useState("")
  const [callDuration, setCallDuration] = useState("")
  const [callOutcome, setCallOutcome] = useState("")

  // Mock communication history
  const [communicationHistory, setCommunicationHistory] = useState<CommunicationRecord[]>([
    {
      id: "comm-1",
      type: "email",
      subject: "Appointment Confirmation",
      content: "Your appointment has been confirmed for tomorrow at 2 PM.",
      status: "read",
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      readAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      sentBy: "System"
    },
    {
      id: "comm-2",
      type: "sms",
      content: "Hi! Just a reminder about your appointment tomorrow. See you at 2 PM!",
      status: "delivered",
      sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      sentBy: "Sarah"
    },
    {
      id: "comm-3",
      type: "call",
      content: "Discussed rescheduling appointment. Client prefers morning slots.",
      status: "sent",
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      sentBy: "Reception"
    }
  ])

  const handleSendEmail = () => {
    if (!emailSubject || !emailContent) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in both subject and content."
      })
      return
    }

    const newEmail: CommunicationRecord = {
      id: `email-${Date.now()}`,
      type: "email",
      subject: emailSubject,
      content: emailContent,
      status: "sent",
      sentAt: new Date(),
      sentBy: "You"
    }

    setCommunicationHistory(prev => [newEmail, ...prev])
    
    toast({
      title: "Email sent",
      description: `Email sent to ${client.name} successfully.`
    })

    setEmailSubject("")
    setEmailContent("")
    setIsEmailDialogOpen(false)
  }

  const handleSendSms = () => {
    if (!smsContent) {
      toast({
        variant: "destructive",
        title: "Missing content",
        description: "Please enter SMS content."
      })
      return
    }

    const newSms: CommunicationRecord = {
      id: `sms-${Date.now()}`,
      type: "sms",
      content: smsContent,
      status: "sent",
      sentAt: new Date(),
      sentBy: "You"
    }

    setCommunicationHistory(prev => [newSms, ...prev])
    
    toast({
      title: "SMS sent",
      description: `SMS sent to ${client.name} successfully.`
    })

    setSmsContent("")
    setIsSmsDialogOpen(false)
  }

  const handleLogCall = () => {
    if (!callNotes) {
      toast({
        variant: "destructive",
        title: "Missing notes",
        description: "Please enter call notes."
      })
      return
    }

    const newCall: CommunicationRecord = {
      id: `call-${Date.now()}`,
      type: "call",
      content: `${callNotes}${callDuration ? ` (Duration: ${callDuration} min)` : ''}${callOutcome ? ` - Outcome: ${callOutcome}` : ''}`,
      status: "sent",
      sentAt: new Date(),
      sentBy: "You"
    }

    setCommunicationHistory(prev => [newCall, ...prev])
    
    toast({
      title: "Call logged",
      description: "Call has been logged successfully."
    })

    setCallNotes("")
    setCallDuration("")
    setCallOutcome("")
    setIsCallLogDialogOpen(false)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCircle2 className="h-3 w-3 text-green-600" />
      case "delivered":
        return <CheckCircle2 className="h-3 w-3 text-blue-600" />
      case "sent":
        return <Clock className="h-3 w-3 text-yellow-600" />
      case "failed":
        return <XCircle className="h-3 w-3 text-red-600" />
      default:
        return <AlertCircle className="h-3 w-3 text-gray-600" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail className="h-4 w-4 text-blue-600" />
      case "sms":
        return <MessageSquare className="h-4 w-4 text-green-600" />
      case "call":
        return <Phone className="h-4 w-4 text-purple-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Communication</CardTitle>
          <CardDescription>Send messages or log calls with {client.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={() => setIsEmailDialogOpen(true)} className="flex-1">
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
            <Button onClick={() => setIsSmsDialogOpen(true)} variant="outline" className="flex-1">
              <MessageSquare className="mr-2 h-4 w-4" />
              Send SMS
            </Button>
            <Button onClick={() => setIsCallLogDialogOpen(true)} variant="outline" className="flex-1">
              <Phone className="mr-2 h-4 w-4" />
              Log Call
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Communication History */}
      <Card>
        <CardHeader>
          <CardTitle>Communication History</CardTitle>
          <CardDescription>All messages and calls with {client.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {communicationHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No communication history yet.
              </div>
            ) : (
              communicationHistory.map((record) => (
                <div key={record.id} className="flex gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getTypeIcon(record.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {record.subject && (
                        <span className="font-medium text-sm">{record.subject}</span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {record.type}
                      </Badge>
                      {getStatusIcon(record.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {record.content}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{format(record.sentAt, "MMM d, yyyy 'at' h:mm a")}</span>
                      <span>by {record.sentBy}</span>
                      {record.readAt && (
                        <span>Read {format(record.readAt, "MMM d 'at' h:mm a")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Send Email to {client.name}</DialogTitle>
            <DialogDescription>
              Send a personalized email to {client.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Enter email subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-content">Message</Label>
              <Textarea
                id="email-content"
                placeholder="Enter your message..."
                rows={6}
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail}>
              <Send className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Dialog */}
      <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send SMS to {client.name}</DialogTitle>
            <DialogDescription>
              Send a text message to {client.phone}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sms-content">Message</Label>
              <Textarea
                id="sms-content"
                placeholder="Enter your SMS message..."
                rows={4}
                maxLength={160}
                value={smsContent}
                onChange={(e) => setSmsContent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-right">
                {smsContent.length}/160 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSmsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendSms}>
              <Send className="mr-2 h-4 w-4" />
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Log Dialog */}
      <Dialog open={isCallLogDialogOpen} onOpenChange={setIsCallLogDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Log Call with {client.name}</DialogTitle>
            <DialogDescription>
              Record details of your phone conversation
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="call-duration">Duration (minutes)</Label>
                <Input
                  id="call-duration"
                  type="number"
                  placeholder="5"
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="call-outcome">Outcome</Label>
                <Select value={callOutcome} onValueChange={setCallOutcome}>
                  <SelectTrigger id="call-outcome">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment_booked">Appointment Booked</SelectItem>
                    <SelectItem value="appointment_rescheduled">Appointment Rescheduled</SelectItem>
                    <SelectItem value="appointment_cancelled">Appointment Cancelled</SelectItem>
                    <SelectItem value="inquiry">General Inquiry</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="call-notes">Call Notes</Label>
              <Textarea
                id="call-notes"
                placeholder="Enter details about the call..."
                rows={4}
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCallLogDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogCall}>
              <Plus className="mr-2 h-4 w-4" />
              Log Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
