"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useStaffCredentials } from "@/hooks/use-staff-credentials"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Shield,
  Users,
  Eye,
  EyeOff,
  MapPin,
  TestTube,
  Loader2,
  Edit,
  Trash2,
  Copy,
  Check,
  AlertTriangle
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

interface StaffMember {
  id: string
  name: string
  employeeNumber?: string
  jobRole?: string
  status: string
  hasCredentials: boolean
  user?: {
    id: string
    email: string
    role: string
    isActive: boolean
    createdAt: string
    updatedAt: string
  }
  locations: {
    id: string
    name: string
    city: string
    isActive: boolean
  }[]
}

interface Location {
  id: string
  name: string
  city: string
}

export function StaffCredentialSettings() {
  const { toast } = useToast()
  const {
    staff,
    locations,
    loading,
    fetchStaffCredentials,
    fetchLocations,
    createCredentials,
    createManualCredentials,
    resetPassword,
    updatePassword,
    updateLocations,
    toggleActive,
    deleteCredentials,
    generateTestCredentials
  } = useStaffCredentials()

  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isManualCreateDialogOpen, setIsManualCreateDialogOpen] = useState(false)
  const [isEditPasswordDialogOpen, setIsEditPasswordDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false)
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false)
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [generatedCredentials, setGeneratedCredentials] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [manualUsername, setManualUsername] = useState("")
  const [manualPassword, setManualPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [updatedPassword, setUpdatedPassword] = useState<string | null>(null)
  const [showUpdatedPassword, setShowUpdatedPassword] = useState(false)

  // Fetch staff and locations data
  useEffect(() => {
    fetchStaffCredentials()
    fetchLocations()
  }, [fetchStaffCredentials, fetchLocations])

  // Password validation helper
  const validatePasswordStrength = (password: string) => {
    const errors: string[] = []
    let strength = 0

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters')
    } else {
      strength += 20
    }

    if (password.length >= 12) {
      strength += 10
    }

    if (/[A-Z]/.test(password)) {
      strength += 20
    } else {
      errors.push('Add at least one uppercase letter')
    }

    if (/[a-z]/.test(password)) {
      strength += 20
    } else {
      errors.push('Add at least one lowercase letter')
    }

    if (/[0-9]/.test(password)) {
      strength += 15
    } else {
      errors.push('Add at least one number')
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      strength += 15
    } else {
      errors.push('Add at least one special character')
    }

    setPasswordStrength(strength)
    setPasswordErrors(errors)
    return errors.length === 0
  }

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      })
    }
  }

  const handleCreateCredentials = async () => {
    if (!selectedStaff || selectedLocations.length === 0) {
      toast({
        title: "Error",
        description: "Please select a staff member and at least one location",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      const credentials = await createCredentials(selectedStaff.id, selectedLocations)
      setGeneratedCredentials(credentials)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerateTestCredentials = async () => {
    try {
      setIsSubmitting(true)
      await generateTestCredentials()
      setIsTestDialogOpen(false)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async (staffMember: StaffMember) => {
    try {
      setSelectedStaff(staffMember)
      const tempPassword = await resetPassword(staffMember.id)
      setGeneratedCredentials({
        username: staffMember.user?.email,
        temporaryPassword: tempPassword
      })
      setShowPassword(false)
      setIsResetPasswordDialogOpen(true)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleManualCreateCredentials = async () => {
    if (!selectedStaff || selectedLocations.length === 0) {
      toast({
        title: "Error",
        description: "Please select a staff member and at least one location",
        variant: "destructive"
      })
      return
    }

    if (!manualUsername || !manualPassword) {
      toast({
        title: "Error",
        description: "Please provide both username and password",
        variant: "destructive"
      })
      return
    }

    if (manualPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      })
      return
    }

    if (!validatePasswordStrength(manualPassword)) {
      toast({
        title: "Error",
        description: "Password does not meet security requirements",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      const credentials = await createManualCredentials(
        selectedStaff.id,
        selectedLocations,
        manualUsername,
        manualPassword
      )
      setGeneratedCredentials(credentials)
      setManualUsername("")
      setManualPassword("")
      setConfirmPassword("")
      setPasswordStrength(0)
      setPasswordErrors([])
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!selectedStaff) return

    if (!newPassword) {
      toast({
        title: "Error",
        description: "Please enter a new password",
        variant: "destructive"
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      })
      return
    }

    if (!validatePasswordStrength(newPassword)) {
      toast({
        title: "Error",
        description: "Password does not meet security requirements",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      // Store the password before clearing it
      const passwordToSave = newPassword
      await updatePassword(selectedStaff.id, passwordToSave)

      // Show success with the updated password
      setUpdatedPassword(passwordToSave)
      setShowUpdatedPassword(false)

      toast({
        title: "Password Updated Successfully",
        description: `Password for ${selectedStaff.name} has been updated. Make sure to save it securely.`,
      })

      // Don't close the dialog immediately - let user copy the password
      // Clear the input fields but keep the dialog open to show the updated password
      setNewPassword("")
      setConfirmPassword("")
      setPasswordStrength(0)
      setPasswordErrors([])
    } catch (error) {
      // Error handling is done in the hook
      setUpdatedPassword(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCredentials = async () => {
    if (!selectedStaff) return

    try {
      setIsSubmitting(true)
      await deleteCredentials(selectedStaff.id)
      setIsDeleteDialogOpen(false)
      setSelectedStaff(null)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateLocations = async () => {
    if (!selectedStaff || selectedLocations.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one location",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      await updateLocations(selectedStaff.id, selectedLocations)
      setIsLocationDialogOpen(false)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (staffMember: StaffMember) => {
    try {
      await toggleActive(staffMember.id)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const filteredStaff = staff.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.employeeNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.jobRole?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const staffWithoutCredentials = staff.filter(member => !member.hasCredentials)

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Staff Credential Management
              </CardTitle>
              <CardDescription>
                Create and manage login credentials for staff members with location-based access control
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsTestDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <TestTube className="h-4 w-4" />
                Check Test Credentials
              </Button>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                disabled={staffWithoutCredentials.length === 0}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Credentials
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search staff members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => {
              fetchStaffCredentials()
              fetchLocations()
            }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Staff</p>
                    <p className="text-2xl font-bold">{staff.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">With Credentials</p>
                    <p className="text-2xl font-bold">{staff.filter(s => s.hasCredentials).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Without Credentials</p>
                    <p className="text-2xl font-bold">{staffWithoutCredentials.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>
            View and manage login credentials for all staff members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Employee #</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Credentials</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.employeeNumber || '-'}</TableCell>
                  <TableCell>{member.jobRole || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.locations.map((location) => (
                        <Badge key={location.id} variant="outline" className="text-xs">
                          {location.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.hasCredentials ? (
                      <div className="space-y-1">
                        <Badge variant="default">
                          <Shield className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {member.user?.email}
                        </p>
                      </div>
                    ) : (
                      <Badge variant="secondary">
                        <KeyRound className="h-3 w-3 mr-1" />
                        None
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.hasCredentials ? (
                          <>
                            <DropdownMenuItem onClick={() => handleResetPassword(member)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedStaff(member)
                                setNewPassword("")
                                setConfirmPassword("")
                                setPasswordStrength(0)
                                setPasswordErrors([])
                                setIsEditPasswordDialogOpen(true)
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedStaff(member)
                                setSelectedLocations(member.locations.map(l => l.id))
                                setIsLocationDialogOpen(true)
                              }}
                            >
                              <MapPin className="h-4 w-4 mr-2" />
                              Update Locations
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(member)}>
                              <Shield className="h-4 w-4 mr-2" />
                              {member.user?.isActive ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedStaff(member)
                                setIsDeleteDialogOpen(true)
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Credentials
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedStaff(member)
                                setSelectedLocations(member.locations.map(l => l.id))
                                setIsCreateDialogOpen(true)
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Auto-Generate Credentials
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedStaff(member)
                                setSelectedLocations(member.locations.map(l => l.id))
                                setManualUsername("")
                                setManualPassword("")
                                setConfirmPassword("")
                                setPasswordStrength(0)
                                setPasswordErrors([])
                                setIsManualCreateDialogOpen(true)
                              }}
                            >
                              <KeyRound className="h-4 w-4 mr-2" />
                              Create Manual Credentials
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Credentials Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Login Credentials</DialogTitle>
            <DialogDescription>
              Generate login credentials for the selected staff member
            </DialogDescription>
          </DialogHeader>

          {selectedStaff && (
            <div className="space-y-4">
              <div>
                <Label>Staff Member</Label>
                <p className="text-sm font-medium">{selectedStaff.name}</p>
                <p className="text-xs text-muted-foreground">
                  Employee #{selectedStaff.employeeNumber} • {selectedStaff.jobRole}
                </p>
              </div>

              <div>
                <Label>Location Access</Label>
                <div className="space-y-2 mt-2">
                  {locations.map((location) => (
                    <div key={location.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={location.id}
                        checked={selectedLocations.includes(location.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLocations([...selectedLocations, location.id])
                          } else {
                            setSelectedLocations(selectedLocations.filter(id => id !== location.id))
                          }
                        }}
                      />
                      <Label htmlFor={location.id} className="text-sm">
                        {location.name} - {location.city}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {generatedCredentials && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">Generated Credentials</h4>
                  <div className="space-y-1">
                    <p className="text-xs">
                      <span className="font-medium">Email:</span> {generatedCredentials.username}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs">
                        <span className="font-medium">Password:</span>
                        {showPassword ? generatedCredentials.temporaryPassword : '••••••••'}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCredentials}
              disabled={isSubmitting || selectedLocations.length === 0}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Credentials Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Test Credentials</DialogTitle>
            <DialogDescription>
              This will check the credential status for staff members across all locations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This will show the current credential status for staff members at each location.
                In a production system, this would create credentials for staff members who don't have them.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Available Locations:</p>
              <div className="grid grid-cols-2 gap-2">
                {locations.map((location) => (
                  <div key={location.id} className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3 w-3" />
                    {location.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateTestCredentials}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Check Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Locations Dialog */}
      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Location Access</DialogTitle>
            <DialogDescription>
              Modify location assignments for the selected staff member
            </DialogDescription>
          </DialogHeader>

          {selectedStaff && (
            <div className="space-y-4">
              <div>
                <Label>Staff Member</Label>
                <p className="text-sm font-medium">{selectedStaff.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedStaff.user?.email}
                </p>
              </div>

              <div>
                <Label>Location Access</Label>
                <div className="space-y-2 mt-2">
                  {locations.map((location) => (
                    <div key={location.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`update-${location.id}`}
                        checked={selectedLocations.includes(location.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLocations([...selectedLocations, location.id])
                          } else {
                            setSelectedLocations(selectedLocations.filter(id => id !== location.id))
                          }
                        }}
                      />
                      <Label htmlFor={`update-${location.id}`} className="text-sm">
                        {location.name} - {location.city}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLocationDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateLocations}
              disabled={isSubmitting || selectedLocations.length === 0}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Locations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Create Credentials Dialog */}
      <Dialog open={isManualCreateDialogOpen} onOpenChange={setIsManualCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Manual Credentials</DialogTitle>
            <DialogDescription>
              Manually set username and password for the selected staff member
            </DialogDescription>
          </DialogHeader>

          {selectedStaff && (
            <div className="space-y-4">
              <div>
                <Label>Staff Member</Label>
                <p className="text-sm font-medium">{selectedStaff.name}</p>
                <p className="text-xs text-muted-foreground">
                  Employee #{selectedStaff.employeeNumber} • {selectedStaff.jobRole}
                </p>
              </div>

              <div>
                <Label>Location Access</Label>
                <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                  {locations.map((location) => (
                    <div key={location.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`manual-${location.id}`}
                        checked={selectedLocations.includes(location.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLocations([...selectedLocations, location.id])
                          } else {
                            setSelectedLocations(selectedLocations.filter(id => id !== location.id))
                          }
                        }}
                      />
                      <Label htmlFor={`manual-${location.id}`} className="text-sm">
                        {location.name} - {location.city}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="manual-username">Username</Label>
                <Input
                  id="manual-username"
                  placeholder="e.g., john.doe"
                  value={manualUsername}
                  onChange={(e) => setManualUsername(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Will be used as: {manualUsername || 'username'}@vanityhub.com
                </p>
              </div>

              <div>
                <Label htmlFor="manual-password">Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="manual-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={manualPassword}
                    onChange={(e) => {
                      setManualPassword(e.target.value)
                      validatePasswordStrength(e.target.value)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="manual-confirm-password">Confirm Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="manual-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {manualPassword && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Password Strength</Label>
                    <span className="text-xs font-medium">
                      {passwordStrength < 40 ? 'Weak' : passwordStrength < 70 ? 'Fair' : passwordStrength < 90 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                  <Progress
                    value={passwordStrength}
                    className={`h-2 ${
                      passwordStrength < 40 ? 'bg-red-200' :
                      passwordStrength < 70 ? 'bg-yellow-200' :
                      passwordStrength < 90 ? 'bg-blue-200' :
                      'bg-green-200'
                    }`}
                  />
                  {passwordErrors.length > 0 && (
                    <div className="text-xs text-red-600 space-y-1">
                      {passwordErrors.map((error, index) => (
                        <p key={index}>• {error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {generatedCredentials && (
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">Credentials Created Successfully!</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs">
                            <span className="font-medium">Email:</span> {generatedCredentials.username}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(generatedCredentials.username, 'Email')}
                          >
                            {copiedField === 'Email' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs">
                            <span className="font-medium">Password:</span> {showPassword ? generatedCredentials.password : '••••••••'}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(generatedCredentials.password, 'Password')}
                            >
                              {copiedField === 'Password' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        ⚠️ Make sure to save these credentials. They won't be shown again.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsManualCreateDialogOpen(false)
                setManualUsername("")
                setManualPassword("")
                setConfirmPassword("")
                setGeneratedCredentials(null)
                setPasswordStrength(0)
                setPasswordErrors([])
              }}
            >
              {generatedCredentials ? 'Close' : 'Cancel'}
            </Button>
            {!generatedCredentials && (
              <Button
                onClick={handleManualCreateCredentials}
                disabled={isSubmitting || selectedLocations.length === 0 || !manualUsername || !manualPassword || !confirmPassword}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Credentials
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Password Dialog */}
      <Dialog open={isEditPasswordDialogOpen} onOpenChange={setIsEditPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Password</DialogTitle>
            <DialogDescription>
              Set a new password for this staff member
            </DialogDescription>
          </DialogHeader>

          {selectedStaff && (
            <div className="space-y-4">
              <div>
                <Label>Staff Member</Label>
                <p className="text-sm font-medium">{selectedStaff.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedStaff.user?.email}
                </p>
                {selectedStaff.user?.updatedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last password update: {new Date(selectedStaff.user.updatedAt).toLocaleDateString()} at {new Date(selectedStaff.user.updatedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Security Note:</strong> Passwords are encrypted and cannot be retrieved.
                  The new password will replace the existing one. Make sure to save it securely.
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="new-password">New Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      validatePasswordStrength(e.target.value)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Password Strength</Label>
                    <span className="text-xs font-medium">
                      {passwordStrength < 40 ? 'Weak' : passwordStrength < 70 ? 'Fair' : passwordStrength < 90 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                  <Progress
                    value={passwordStrength}
                    className={`h-2 ${
                      passwordStrength < 40 ? 'bg-red-200' :
                      passwordStrength < 70 ? 'bg-yellow-200' :
                      passwordStrength < 90 ? 'bg-blue-200' :
                      'bg-green-200'
                    }`}
                  />
                  {passwordErrors.length > 0 && (
                    <div className="text-xs text-red-600 space-y-1">
                      {passwordErrors.map((error, index) => (
                        <p key={index}>• {error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Password Requirements */}
              {!updatedPassword && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <p className="font-medium mb-1">Password Requirements:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>At least 8 characters long</li>
                      <li>At least one uppercase letter</li>
                      <li>At least one lowercase letter</li>
                      <li>At least one number</li>
                      <li>At least one special character</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Show Updated Password */}
              {updatedPassword && (
                <Alert className="bg-green-50 border-green-200">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <p className="font-medium text-green-900 mb-2">Password Updated Successfully!</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-green-800">New Password</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type={showUpdatedPassword ? "text" : "password"}
                            value={updatedPassword}
                            readOnly
                            className="bg-white font-mono text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowUpdatedPassword(!showUpdatedPassword)}
                          >
                            {showUpdatedPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(updatedPassword, "Password")}
                          >
                            {copiedField === "Password" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-green-800">
                        ⚠️ Make sure to save this password securely. You won't be able to see it again.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditPasswordDialogOpen(false)
                setNewPassword("")
                setConfirmPassword("")
                setPasswordStrength(0)
                setPasswordErrors([])
                setUpdatedPassword(null)
                setShowUpdatedPassword(false)
              }}
            >
              {updatedPassword ? "Close" : "Cancel"}
            </Button>
            {!updatedPassword && (
              <Button
                onClick={handleUpdatePassword}
                disabled={isSubmitting || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Credentials Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Credentials</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete login credentials for this staff member?
            </DialogDescription>
          </DialogHeader>

          {selectedStaff && (
            <div className="space-y-4">
              <div>
                <Label>Staff Member</Label>
                <p className="text-sm font-medium">{selectedStaff.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedStaff.user?.email}
                </p>
              </div>

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Warning: This action cannot be undone!</p>
                  <ul className="text-xs space-y-1">
                    <li>• The staff member will no longer be able to log in</li>
                    <li>• All access to the system will be revoked</li>
                    <li>• You can create new credentials later if needed</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setSelectedStaff(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCredentials}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog (Enhanced) */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Password Reset Successful</DialogTitle>
            <DialogDescription>
              A new temporary password has been generated
            </DialogDescription>
          </DialogHeader>

          {selectedStaff && generatedCredentials && (
            <div className="space-y-4">
              <div>
                <Label>Staff Member</Label>
                <p className="text-sm font-medium">{selectedStaff.name}</p>
              </div>

              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-3">
                    <p className="font-medium">New Temporary Credentials:</p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm font-mono">{generatedCredentials.username}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(generatedCredentials.username, 'Email')}
                        >
                          {copiedField === 'Email' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Temporary Password</p>
                          <p className="text-sm font-mono">
                            {showPassword ? generatedCredentials.temporaryPassword : '••••••••'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(generatedCredentials.temporaryPassword, 'Password')}
                          >
                            {copiedField === 'Password' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <p className="font-medium">Important:</p>
                        <ul className="mt-1 space-y-0.5">
                          <li>• Save these credentials now - they won't be shown again</li>
                          <li>• Share them securely with the staff member</li>
                          <li>• The staff member should change this password after first login</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setIsResetPasswordDialogOpen(false)
                setGeneratedCredentials(null)
                setShowPassword(false)
              }}
            >
              I've Saved the Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
