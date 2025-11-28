"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useApiStaff } from "@/lib/api-staff-service"
import { useLocations } from "@/lib/location-provider"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Edit, Trash, Save, X, Search, Filter, Calendar, AlertTriangle } from "lucide-react"
import { StaffMember, getDocumentValidityStatus, getValidityStatusColor, validateEmployeeNumberUniqueness, generateEmployeeNumber } from "@/lib/staff-storage"
import { ProfileImageUpload } from "@/components/ui/profile-image-upload"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { convertDisplayDateToISO } from "@/lib/date-validation"

interface HRStaffManagementProps {
  search: string
}

interface EditingStaff extends StaffMember {
  isEditing?: boolean
}

export function HRStaffManagement({ search }: HRStaffManagementProps) {
  const { user, hasPermission } = useAuth()
  const { toast } = useToast()
  const { locations: availableLocations, getLocationName } = useLocations()

  // Filter out only Home service (keep Online store but remove duplicates)
  const physicalLocations = availableLocations.filter(location =>
    location.name !== 'Home service'
  )

  const {
    staff,
    addStaffMember,
    updateStaffMember,
    deleteStaffMember,
    refreshData,
    isLoading,
    error
  } = useApiStaff()

  const [staffList, setStaffList] = useState<EditingStaff[]>([])
  const [filteredStaff, setFilteredStaff] = useState<EditingStaff[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // New staff form state
  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    phone: "",
    role: "stylist",
    locations: [] as string[],
    status: "Active",
    homeService: false,
    employeeNumber: "",
    dateOfBirth: "",
    qidNumber: "",
    passportNumber: "",
    qidValidity: "",
    passportValidity: "",
    medicalValidity: "",
    profileImage: "",
    profileImageType: ""
  })

  // Validation states
  const [employeeNumberError, setEmployeeNumberError] = useState<string>("")
  const [imageUploadError, setImageUploadError] = useState<string>("")

  // Fetch staff data on component mount
  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Update staff list when staff data changes
  useEffect(() => {
    setStaffList(staff.map(s => ({ ...s, isEditing: false })))
  }, [staff])

  // Filter staff based on search, role, and status
  useEffect(() => {
    let filtered = staffList.filter((staff) => {
      // Search filter
      if (search && !staff.name.toLowerCase().includes(search.toLowerCase()) &&
          !staff.email.toLowerCase().includes(search.toLowerCase()) &&
          !staff.role.toLowerCase().includes(search.toLowerCase())) {
        return false
      }

      // Role filter
      if (roleFilter !== "all" && staff.role !== roleFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== "all" && staff.status !== statusFilter) {
        return false
      }

      return true
    })

    setFilteredStaff(filtered)
  }, [staffList, search, roleFilter, statusFilter])

  const handleEdit = (staffId: string) => {
    setStaffList(prev => prev.map(s =>
      s.id === staffId ? { ...s, isEditing: true } : { ...s, isEditing: false }
    ))
  }

  const handleCancelEdit = (staffId: string) => {
    setStaffList(prev => prev.map(s =>
      s.id === staffId ? { ...s, isEditing: false } : s
    ))
    // Refresh to restore original values
    refreshData()
  }

  const [savingStaffId, setSavingStaffId] = useState<string | null>(null)

  const handleSave = async (staffId: string) => {
    const staffToUpdate = staffList.find(s => s.id === staffId)
    if (!staffToUpdate) return

    setSavingStaffId(staffId) // Set loading state

    try {
      // Validate employee number before saving
      if (staffToUpdate.employeeNumber) {
        const validation = validateEmployeeNumberUniqueness(staffToUpdate.employeeNumber, staff, staffId)
        if (!validation.isValid) {
          toast({
            variant: "destructive",
            title: "Invalid Employee Number",
            description: validation.error,
          })
          setSavingStaffId(null)
          return
        }
      }

      // Convert date format for API (DD-MM-YY to YYYY-MM-DD) only if it's a valid date format
      const staffDataForAPI = {
        ...staffToUpdate,
        dateOfBirth: staffToUpdate.dateOfBirth && staffToUpdate.dateOfBirth.match(/^\d{2}-\d{2}-\d{2}$/)
          ? convertDisplayDateToISO(staffToUpdate.dateOfBirth)
          : staffToUpdate.dateOfBirth || ""
      }

      const result = await updateStaffMember(staffDataForAPI)
      if (result.staff) {
        setStaffList(prev => prev.map(s =>
          s.id === staffId ? { ...result.staff!, isEditing: false } : s
        ))
        toast({
          title: "Staff Updated",
          description: `${staffToUpdate.name} has been updated successfully.`,
        })
      } else {
        throw new Error("Failed to update staff member")
      }
    } catch (error) {
      console.error("Error updating staff:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update staff member. Please try again.",
      })
    } finally {
      setSavingStaffId(null) // Clear loading state
    }
  }

  const handleFieldChange = (staffId: string, field: keyof StaffMember, value: any) => {
    setStaffList(prev => prev.map(s =>
      s.id === staffId ? { ...s, [field]: value } : s
    ))
  }

  const handleLocationChange = (staffId: string, locationId: string, checked: boolean) => {
    setStaffList(prev => prev.map(s => {
      if (s.id === staffId) {
        // For single location assignment: if checking a location, replace all locations with just this one
        // If unchecking, remove this location (staff must have at least one location)
        const newLocations = checked
          ? [locationId] // Replace with single location
          : s.locations.filter(loc => loc !== locationId)
        return { ...s, locations: newLocations }
      }
      return s
    }))
  }

  const handleDelete = (staff: StaffMember) => {
    setStaffToDelete(staff)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!staffToDelete) return

    try {
      const success = await deleteStaffMember(staffToDelete.id)
      if (success) {
        toast({
          title: "Staff Deleted",
          description: `${staffToDelete.name} has been removed from your staff directory.`,
        })
        setIsDeleteDialogOpen(false)
        setStaffToDelete(null)
      } else {
        throw new Error("Failed to delete staff member")
      }
    } catch (error) {
      console.error("Error deleting staff:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete staff member. Please try again.",
      })
    }
  }

  const handleAddStaff = async () => {
    try {
      // Validate employee number if provided
      if (newStaff.employeeNumber && !validateNewStaffEmployeeNumber(newStaff.employeeNumber)) {
        return
      }

      // Auto-generate employee number if not provided
      const employeeNumber = newStaff.employeeNumber || generateEmployeeNumber(staff)

      const result = await addStaffMember({
        ...newStaff,
        employeeNumber,
        dateOfBirth: newStaff.dateOfBirth && newStaff.dateOfBirth.match(/^\d{2}-\d{2}-\d{2}$/)
          ? convertDisplayDateToISO(newStaff.dateOfBirth)
          : newStaff.dateOfBirth || "",
        avatar: newStaff.name.split(' ').map(n => n[0]).join(''),
        color: "bg-blue-100 text-blue-800",
        profileImage: newStaff.profileImage || undefined,
        profileImageType: newStaff.profileImageType || undefined
      })

      if (result.staff) {
        toast({
          title: "Staff Added",
          description: `${newStaff.name} has been added to your staff directory.`,
        })
        setIsAddDialogOpen(false)
        setNewStaff({
          name: "",
          email: "",
          phone: "",
          role: "stylist",
          locations: [],
          status: "Active",
          homeService: false,
          employeeNumber: "",
          dateOfBirth: "",
          qidNumber: "",
          passportNumber: "",
          qidValidity: "",
          passportValidity: "",
          medicalValidity: "",
          profileImage: "",
          profileImageType: ""
        })
        setEmployeeNumberError("")
        setImageUploadError("")
      } else {
        throw new Error("Failed to add staff member")
      }
    } catch (error) {
      console.error("Error adding staff:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to add staff member. Please try again.";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      })
    }
  }

  const handleNewStaffLocationChange = (locationId: string, checked: boolean) => {
    setNewStaff(prev => ({
      ...prev,
      locations: checked
        ? [locationId] // Replace with single location
        : prev.locations.filter(loc => loc !== locationId)
    }))
  }

  // Validate employee number for new staff
  const validateNewStaffEmployeeNumber = (employeeNumber: string) => {
    const validation = validateEmployeeNumberUniqueness(employeeNumber, staff)
    setEmployeeNumberError(validation.error || "")
    return validation.isValid
  }

  // Validate employee number for existing staff
  const validateExistingStaffEmployeeNumber = (employeeNumber: string, staffId: string) => {
    const validation = validateEmployeeNumberUniqueness(employeeNumber, staff, staffId)
    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "Invalid Employee Number",
        description: validation.error,
      })
      return false
    }
    return true
  }

  // Handle profile image change for new staff
  const handleNewStaffImageChange = (imageData: string | null, imageType?: string) => {
    setNewStaff(prev => ({
      ...prev,
      profileImage: imageData || "",
      profileImageType: imageType || ""
    }))
    setImageUploadError("")
  }

  // Handle image upload error
  const handleImageUploadError = (error: string) => {
    setImageUploadError(error)
    toast({
      variant: "destructive",
      title: "Image Upload Error",
      description: error,
    })
  }

  const roles = [
    "super_admin", "org_admin", "location_manager", "stylist",
    "colorist", "barber", "nail_technician", "esthetician", "receptionist"
  ]

  const statuses = ["Active", "Inactive", "On Leave"]

  return (
    <div className="space-y-6">
      {/* Header with filters and add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">Staff Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage your staff members with Excel-style editing capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map(role => (
                <SelectItem key={role} value={role}>
                  {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasPermission("add_staff") && (
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          )}
        </div>
      </div>

      {/* Excel-style staff table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Directory ({filteredStaff.length} members)</CardTitle>
          <CardDescription>
            Click edit to modify staff information inline, or use the action buttons for more options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[1800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Photo</TableHead>
                  <TableHead className="w-[100px]">Employee #</TableHead>
                  <TableHead className="w-[160px]">Name</TableHead>
                  <TableHead className="w-[120px]">Date of Birth</TableHead>
                  <TableHead className="w-[180px]">Email</TableHead>
                  <TableHead className="w-[120px]">Phone</TableHead>
                  <TableHead className="w-[120px]">Role</TableHead>
                  <TableHead className="w-[160px]">Primary Location</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Home Service</TableHead>
                  <TableHead className="w-[120px]">QID No</TableHead>
                  <TableHead className="w-[120px]">Passport No</TableHead>
                  <TableHead className="w-[120px]">QID Validity</TableHead>
                  <TableHead className="w-[120px]">Passport Validity</TableHead>
                  <TableHead className="w-[120px]">Medical Validity</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="h-24 text-center">
                      No staff members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((staff) => (
                    <TableRow key={staff.id}>
                      {/* Profile Picture */}
                      <TableCell>
                        {staff.isEditing ? (
                          <ProfileImageUpload
                            currentImage={staff.profileImage}
                            fallbackInitials={staff.avatar}
                            onImageChange={(imageData, imageType) => {
                              handleFieldChange(staff.id, 'profileImage', imageData || "")
                              if (imageType) {
                                handleFieldChange(staff.id, 'profileImageType', imageType)
                              }
                            }}
                            onError={handleImageUploadError}
                            size="sm"
                          />
                        ) : (
                          <StaffAvatar
                            staff={staff}
                            size="md"
                          />
                        )}
                      </TableCell>

                      {/* Employee Number */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.employeeNumber || ""}
                            onChange={(e) => {
                              const value = e.target.value
                              handleFieldChange(staff.id, 'employeeNumber', value)
                              // Validate on blur or when value changes
                              if (value) {
                                validateExistingStaffEmployeeNumber(value, staff.id)
                              }
                            }}
                            className="h-8 w-20"
                            placeholder="9100"
                          />
                        ) : (
                          <div className="font-mono text-sm">{staff.employeeNumber || "N/A"}</div>
                        )}
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.name}
                            onChange={(e) => handleFieldChange(staff.id, 'name', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <div className="font-medium">{staff.name}</div>
                        )}
                      </TableCell>

                      {/* Date of Birth */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.dateOfBirth || ""}
                            onChange={(e) => handleFieldChange(staff.id, 'dateOfBirth', e.target.value)}
                            className="h-8 w-24"
                            placeholder="DD-MM-YY"
                          />
                        ) : (
                          <div className="text-sm">
                            {staff.dateOfBirth || "Not set"}
                          </div>
                        )}
                      </TableCell>

                      {/* Email */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            type="email"
                            value={staff.email}
                            onChange={(e) => handleFieldChange(staff.id, 'email', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <div>{staff.email}</div>
                        )}
                      </TableCell>

                      {/* Phone */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.phone}
                            onChange={(e) => handleFieldChange(staff.id, 'phone', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <div>{staff.phone}</div>
                        )}
                      </TableCell>

                      {/* Role */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Select
                            value={staff.role}
                            onValueChange={(value) => handleFieldChange(staff.id, 'role', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map(role => (
                                <SelectItem key={role} value={role}>
                                  {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline">
                            {staff.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Locations */}
                      <TableCell>
                        {staff.isEditing ? (
                          <div className="space-y-1">
                            {physicalLocations.map(location => (
                              <div key={location.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${staff.id}-${location.id}`}
                                  checked={staff.locations.includes(location.id)}
                                  onCheckedChange={(checked) =>
                                    handleLocationChange(staff.id, location.id, checked as boolean)
                                  }
                                />
                                <Label
                                  htmlFor={`${staff.id}-${location.id}`}
                                  className="text-xs"
                                >
                                  {location.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {staff.locations.map((loc) => (
                              <Badge key={loc} variant="secondary" className="text-xs">
                                {getLocationName(loc)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Select
                            value={staff.status}
                            onValueChange={(value) => handleFieldChange(staff.id, 'status', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statuses.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={staff.status === "Active" ? "success" : "secondary"}>
                            {staff.status}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Home Service */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Checkbox
                            checked={staff.homeService}
                            onCheckedChange={(checked) =>
                              handleFieldChange(staff.id, 'homeService', checked as boolean)
                            }
                          />
                        ) : (
                          <Badge variant={staff.homeService ? "default" : "outline"}>
                            {staff.homeService ? "Yes" : "No"}
                          </Badge>
                        )}
                      </TableCell>

                      {/* QID No */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.qidNumber || ""}
                            onChange={(e) => handleFieldChange(staff.id, 'qidNumber', e.target.value)}
                            className="h-8 w-28"
                            placeholder="QID Number"
                          />
                        ) : (
                          <div className="text-sm font-mono">
                            {staff.qidNumber || "Not set"}
                          </div>
                        )}
                      </TableCell>

                      {/* Passport No */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.passportNumber || ""}
                            onChange={(e) => handleFieldChange(staff.id, 'passportNumber', e.target.value)}
                            className="h-8 w-28"
                            placeholder="Passport No"
                          />
                        ) : (
                          <div className="text-sm font-mono">
                            {staff.passportNumber || "Not set"}
                          </div>
                        )}
                      </TableCell>

                      {/* QID Validity */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.qidValidity || ""}
                            onChange={(e) => handleFieldChange(staff.id, 'qidValidity', e.target.value)}
                            className="h-8 w-24"
                            placeholder="DD-MM-YY"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {staff.qidValidity ? (
                              <>
                                <Badge
                                  variant="outline"
                                  className={getValidityStatusColor(getDocumentValidityStatus(staff.qidValidity))}
                                >
                                  {staff.qidValidity}
                                </Badge>
                                {getDocumentValidityStatus(staff.qidValidity) === 'expired' && (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                                {getDocumentValidityStatus(staff.qidValidity) === 'expiring' && (
                                  <Calendar className="h-4 w-4 text-yellow-500" />
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400 text-sm">Not set</span>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Passport Validity */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.passportValidity || ""}
                            onChange={(e) => handleFieldChange(staff.id, 'passportValidity', e.target.value)}
                            className="h-8 w-24"
                            placeholder="DD-MM-YY"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {staff.passportValidity ? (
                              <>
                                <Badge
                                  variant="outline"
                                  className={getValidityStatusColor(getDocumentValidityStatus(staff.passportValidity))}
                                >
                                  {staff.passportValidity}
                                </Badge>
                                {getDocumentValidityStatus(staff.passportValidity) === 'expired' && (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                                {getDocumentValidityStatus(staff.passportValidity) === 'expiring' && (
                                  <Calendar className="h-4 w-4 text-yellow-500" />
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400 text-sm">Not set</span>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Medical Validity */}
                      <TableCell>
                        {staff.isEditing ? (
                          <Input
                            value={staff.medicalValidity || ""}
                            onChange={(e) => handleFieldChange(staff.id, 'medicalValidity', e.target.value)}
                            className="h-8 w-24"
                            placeholder="DD-MM-YY"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {staff.medicalValidity ? (
                              <>
                                <Badge
                                  variant="outline"
                                  className={getValidityStatusColor(getDocumentValidityStatus(staff.medicalValidity))}
                                >
                                  {staff.medicalValidity}
                                </Badge>
                                {getDocumentValidityStatus(staff.medicalValidity) === 'expired' && (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                                {getDocumentValidityStatus(staff.medicalValidity) === 'expiring' && (
                                  <Calendar className="h-4 w-4 text-yellow-500" />
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400 text-sm">Not set</span>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        {staff.isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSave(staff.id)}
                              disabled={savingStaffId === staff.id}
                              className="hover:bg-green-50 hover:text-green-600"
                            >
                              {savingStaffId === staff.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelEdit(staff.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {hasPermission("edit_staff") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(staff.id)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {hasPermission("delete_staff") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(staff)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>
              Create a new staff member. This will also create a corresponding user account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-name" className="text-right">Name</Label>
              <Input
                id="new-name"
                value={newStaff.name}
                onChange={(e) => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-email" className="text-right">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-phone" className="text-right">Phone</Label>
              <Input
                id="new-phone"
                value={newStaff.phone}
                onChange={(e) => setNewStaff(prev => ({ ...prev, phone: e.target.value }))}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-role" className="text-right">Role</Label>
              <Select
                value={newStaff.role}
                onValueChange={(value) => setNewStaff(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role} value={role}>
                      {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Label className="text-right pt-2">Primary Location</Label>
              <div className="col-span-3 space-y-2">
                {physicalLocations.map(location => (
                  <div key={location.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`new-${location.id}`}
                      checked={newStaff.locations.includes(location.id)}
                      onCheckedChange={(checked) =>
                        handleNewStaffLocationChange(location.id, checked as boolean)
                      }
                    />
                    <Label htmlFor={`new-${location.id}`}>{location.name}</Label>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  Select one primary location where this staff member will be based.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Home Service</Label>
              <div className="col-span-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="new-homeService"
                    checked={newStaff.homeService}
                    onCheckedChange={(checked) =>
                      setNewStaff(prev => ({ ...prev, homeService: checked as boolean }))
                    }
                  />
                  <Label htmlFor="new-homeService">Available for home service</Label>
                </div>
              </div>
            </div>

            {/* Profile Picture Upload */}
            <div className="grid grid-cols-4 gap-4">
              <Label className="text-right pt-2">Profile Picture</Label>
              <div className="col-span-3">
                <ProfileImageUpload
                  currentImage={newStaff.profileImage}
                  fallbackInitials={newStaff.name.split(' ').map(n => n[0]).join('') || "?"}
                  onImageChange={handleNewStaffImageChange}
                  onError={handleImageUploadError}
                  size="md"
                />
                {imageUploadError && (
                  <p className="text-sm text-red-600 mt-1">{imageUploadError}</p>
                )}
              </div>
            </div>

            {/* Document Validity Fields */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-employeeNumber" className="text-right">Employee #</Label>
              <div className="col-span-3">
                <Input
                  id="new-employeeNumber"
                  value={newStaff.employeeNumber}
                  onChange={(e) => {
                    const value = e.target.value
                    setNewStaff(prev => ({ ...prev, employeeNumber: value }))
                    validateNewStaffEmployeeNumber(value)
                  }}
                  className={employeeNumberError ? "border-red-500" : ""}
                  placeholder="9100 (auto-generated if empty)"
                />
                {employeeNumberError && (
                  <p className="text-sm text-red-600 mt-1">{employeeNumberError}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-dateOfBirth" className="text-right">Date of Birth</Label>
              <div className="col-span-3">
                <Input
                  id="new-dateOfBirth"
                  value={newStaff.dateOfBirth}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="col-span-3"
                  placeholder="DD-MM-YY"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-qidNumber" className="text-right">QID No</Label>
              <Input
                id="new-qidNumber"
                value={newStaff.qidNumber}
                onChange={(e) => setNewStaff(prev => ({ ...prev, qidNumber: e.target.value }))}
                className="col-span-3"
                placeholder="QID Number"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-passportNumber" className="text-right">Passport No</Label>
              <Input
                id="new-passportNumber"
                value={newStaff.passportNumber}
                onChange={(e) => setNewStaff(prev => ({ ...prev, passportNumber: e.target.value }))}
                className="col-span-3"
                placeholder="Passport Number"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-qidValidity" className="text-right">QID Validity</Label>
              <Input
                id="new-qidValidity"
                value={newStaff.qidValidity}
                onChange={(e) => setNewStaff(prev => ({ ...prev, qidValidity: e.target.value }))}
                className="col-span-3"
                placeholder="DD-MM-YY"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-passportValidity" className="text-right">Passport Validity</Label>
              <Input
                id="new-passportValidity"
                value={newStaff.passportValidity}
                onChange={(e) => setNewStaff(prev => ({ ...prev, passportValidity: e.target.value }))}
                className="col-span-3"
                placeholder="DD-MM-YY"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-medicalValidity" className="text-right">Medical Validity</Label>
              <Input
                id="new-medicalValidity"
                value={newStaff.medicalValidity}
                onChange={(e) => setNewStaff(prev => ({ ...prev, medicalValidity: e.target.value }))}
                className="col-span-3"
                placeholder="DD-MM-YY"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff}>
              Add Staff Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Staff Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {staffToDelete?.name}? This action cannot be undone.
              This will also remove their user account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
