"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/use-toast"
import { SettingsStorage } from "@/lib/settings-storage"
import { locationCache } from "@/lib/location-cache"
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions"

interface User {
  id: string
  name: string
  email: string
  role: "ADMIN" | "MANAGER" | "STAFF" | "CLIENT" | "receptionist"
  locations: string[] // "all" or location IDs like "loc1", "loc2", etc.
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  currentLocation: string
  setCurrentLocation: (location: string) => void
  login: (user: User) => Promise<void>
  logout: () => void
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  getUserPermissions: () => string[]
  getFirstAccessiblePage: () => string
  canAccessLocation: (locationId: string) => boolean
  canAccessStaffData: (staffId: string) => boolean
  canAccessClientData: (clientId: string) => boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  currentLocation: "all",
  setCurrentLocation: () => {},
  login: async () => {},
  logout: () => {},
  hasPermission: () => false,
  hasAnyPermission: () => false,
  getUserPermissions: () => [],
  getFirstAccessiblePage: () => "/dashboard",
  canAccessLocation: () => false,
  canAccessStaffData: () => false,
  canAccessClientData: () => false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [user, setUser] = useState<User | null>(null)
  const [currentLocation, setCurrentLocation] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Update user from NextAuth session
  useEffect(() => {
    if (status === "loading") {
      setIsLoading(true)
      return
    }

    if (session?.user) {
      const sessionUser: User = {
        id: session.user.id,
        name: session.user.name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
        role: session.user.role as User['role'],
        locations: session.user.locations || []
      }
      setUser(sessionUser)

      // Set initial location based on user's access
      if (sessionUser.locations.length > 0 && !sessionUser.locations.includes("all")) {
        // If user doesn't have "all" access, set to their first location
        setCurrentLocation(sessionUser.locations[0])
      }
    } else {
      setUser(null)
      setCurrentLocation("all")
    }

    setIsLoading(false)
  }, [session, status])

  // Update location when user changes and validate against available locations
  // BUT: Don't validate when user explicitly selects a special location
  useEffect(() => {
    if (user) {
      // Skip validation if current location is a special location that user just selected
      // This prevents the validation from overriding user's explicit selection of home service
      if (currentLocation === "home" || currentLocation === "online") {
        console.log("🔍 Auth Provider - Skipping validation for special location:", currentLocation)
        return
      }

      // Add a small delay to ensure location cache is initialized
      const validateLocation = () => {
        console.log("🔍 Auth Provider - validateLocation() called for location:", currentLocation)

        // Get available locations from database cache instead of localStorage
        const availableLocations = locationCache.getAllLocations()
        const availableLocationIds = availableLocations.map(loc => loc.id)

        // Add special locations
        availableLocationIds.push("all")
        availableLocationIds.push("home")
        availableLocationIds.push("online")

        console.log("🔍 Auth Provider - Available location IDs:", availableLocationIds)
        console.log("🔍 Auth Provider - Current location:", currentLocation)
        console.log("🔍 Auth Provider - User locations:", user.locations)
        console.log("🔍 Auth Provider - Is home in available locations?", availableLocationIds.includes("home"))

        // Only validate if we have locations loaded (avoid validation during initial load)
        if (availableLocationIds.length <= 3) { // Only special locations, no database locations yet
          console.log("🔍 Auth Provider - Waiting for locations to load...")
          return
        }

        // If user doesn't have access to all locations, set to their first available location
        // BUT: Don't override if current location is a special location (home, online)
        if (!user.locations.includes("all") && user.locations.length > 0 &&
            currentLocation !== "home" && currentLocation !== "online") {
          // Find the first location that exists in both user's allowed locations and available locations
          const firstValidLocation = user.locations.find(loc => availableLocationIds.includes(loc))
          if (firstValidLocation) {
            console.log("🔍 Auth Provider - Setting to first valid location:", firstValidLocation)
            setCurrentLocation(firstValidLocation)
          } else if (availableLocationIds.length > 0) {
            // Fallback to first available location
            console.log("🔍 Auth Provider - No valid location found, falling back to 'all'")
            setCurrentLocation("all")
          }
        } else if (currentLocation !== "all" && currentLocation !== "home" && currentLocation !== "online" && !availableLocationIds.includes(currentLocation)) {
          // If current location no longer exists, reset to "all"
          console.log("🔍 Auth Provider - Current location not in available locations, resetting to 'all'")
          console.log("🔍 Auth Provider - Current location:", currentLocation)
          console.log("🔍 Auth Provider - Available locations:", availableLocationIds)
          setCurrentLocation("all")
        } else {
          console.log("🔍 Auth Provider - Location validation passed, keeping current location:", currentLocation)
        }
      }

      // Only run validation for non-special locations
      if (currentLocation !== "home" && currentLocation !== "online") {
        // Run validation immediately and then after a short delay to catch late-loading locations
        validateLocation()
        const timeoutId = setTimeout(validateLocation, 500)

        return () => clearTimeout(timeoutId)
      }
    }
  }, [user, currentLocation])

  const login = async (userData: User): Promise<void> => {
    // This is now handled by NextAuth, but we keep the function for compatibility
    toast({
      title: "Logged in successfully",
      description: `Welcome back, ${userData.name}!`,
    })
  }

  const logout = () => {
    // This will be handled by NextAuth signOut, but we keep for compatibility
    setUser(null)
    setCurrentLocation("all")

    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    })
  }

  // Get user permissions based on role
  const getUserPermissions = (): string[] => {
    if (!user) return []

    // Admin and Super Admin always have ALL permissions
    const roleUpper = user.role.toUpperCase()
    if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
      console.log(`✅ Admin/Super Admin detected - granting ALL permissions`)
      return [PERMISSIONS.ALL]
    }

    // First, try to get custom permissions from settings
    const storedRoles = SettingsStorage.getRoles()

    // Try exact match first
    let userRole = storedRoles.find(role => role.id === user.role)

    // If no exact match, try case-insensitive match
    if (!userRole) {
      userRole = storedRoles.find(role => role.id.toLowerCase() === user.role.toLowerCase())
    }

    if (userRole && userRole.permissions && userRole.permissions.length > 0) {
      // If the role has custom permissions defined in settings, use those
      console.log(`✅ Using custom permissions for role "${user.role}":`, userRole.permissions)
      return userRole.permissions
    }

    // Otherwise, fall back to default permissions from constants
    const roleKey = user.role.toUpperCase() as keyof typeof ROLE_PERMISSIONS
    const permissions = ROLE_PERMISSIONS[roleKey] || []

    console.log(`⚠️ Using default permissions for role "${user.role}":`, permissions)
    return permissions
  }

  // Check if user has a specific permission
  const hasPermission = (permission: string): boolean => {
    if (!user) return false

    const permissions = getUserPermissions()

    // Debug logging for permission checks
    console.log(`🔐 Permission check for "${permission}":`)
    console.log(`User role: ${user.role}`)
    console.log(`User permissions:`, permissions)
    console.log(`Has ALL permission: ${permissions.includes(PERMISSIONS.ALL)}`)
    console.log(`Has specific permission: ${permissions.includes(permission)}`)

    // If user has ALL permission, they have access to everything
    if (permissions.includes(PERMISSIONS.ALL)) {
      return true
    }

    // Check if the user has the specific permission
    return permissions.includes(permission)
  }

  // Check if user has any of the specified permissions
  const hasAnyPermission = (permissionList: string[]): boolean => {
    if (!user) return false

    const permissions = getUserPermissions()

    // If user has ALL permission, they have access to everything
    if (permissions.includes(PERMISSIONS.ALL)) {
      return true
    }

    // Check if the user has any of the permissions
    return permissionList.some(permission => permissions.includes(permission))
  }

  // Get the first accessible page for the user based on their permissions
  const getFirstAccessiblePage = (): string => {
    if (!user) return "/login"

    const permissions = getUserPermissions()

    // Priority order for redirection
    const pageChecks = [
      { path: "/dashboard", permission: PERMISSIONS.VIEW_DASHBOARD },
      { path: "/dashboard/appointments", permissions: [PERMISSIONS.VIEW_APPOINTMENTS, PERMISSIONS.VIEW_OWN_APPOINTMENTS] },
      { path: "/dashboard/clients", permission: PERMISSIONS.VIEW_CLIENTS },
      { path: "/dashboard/services", permission: PERMISSIONS.VIEW_SERVICES },
      { path: "/dashboard/pos", permission: PERMISSIONS.VIEW_POS },
      { path: "/dashboard/inventory", permission: PERMISSIONS.VIEW_INVENTORY },
      { path: "/dashboard/staff", permission: PERMISSIONS.VIEW_STAFF },
      { path: "/dashboard/accounting", permission: PERMISSIONS.VIEW_ACCOUNTING },
      { path: "/dashboard/hr", permission: PERMISSIONS.VIEW_HR },
      { path: "/dashboard/reports", permission: PERMISSIONS.VIEW_REPORTS },
      { path: "/dashboard/settings", permission: PERMISSIONS.VIEW_SETTINGS },
    ]

    for (const check of pageChecks) {
      if ('permissions' in check) {
        // Check if user has any of the permissions
        if (check.permissions.some(p => permissions.includes(p) || permissions.includes(PERMISSIONS.ALL))) {
          return check.path
        }
      } else if ('permission' in check) {
        // Check if user has the specific permission
        if (permissions.includes(check.permission) || permissions.includes(PERMISSIONS.ALL)) {
          return check.path
        }
      }
    }

    // Fallback to appointments if no other page is accessible
    return "/dashboard/appointments"
  }

  // Check if user can access a specific location
  const canAccessLocation = (locationId: string): boolean => {
    if (!user) return false

    // Admin can access all locations
    if (user.role === 'ADMIN') {
      return true
    }

    // For non-admin users, explicitly deny access to special locations
    if (locationId === 'all' || locationId === 'online' || locationId === 'home') {
      return false; // Non-admin users cannot access these special locations
    }

    // If the user has "all" in their locations, they can access all locations
    if (user.locations.includes('all')) {
      return true
    }

    // Check if the location is in the user's assigned locations
    return user.locations.includes(locationId)
  }

  // Check if user can access a specific staff member's data
  const canAccessStaffData = (staffId: string): boolean => {
    if (!user) return false

    // Admin and Manager can access all staff data
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return true
    }

    // Staff can only access their own data
    return user.id === staffId
  }

  // Check if user can access a specific client's data
  const canAccessClientData = (clientId: string): boolean => {
    if (!user) return false

    // Admin and Manager can access all client data
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return true
    }

    // Staff can access client data for their location
    if (user.role === 'STAFF') {
      return true // For now, allow staff to access client data
    }

    return false
  }

  if (isLoading) {
    return null // Or a loading spinner
  }

  // Create a wrapped setCurrentLocation function that also updates localStorage
  const updateCurrentLocation = (location: string) => {
    // Save to state
    setCurrentLocation(location)
    // Save to localStorage for persistence
    localStorage.setItem("vanity_location", location)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        currentLocation,
        setCurrentLocation: updateCurrentLocation,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        getUserPermissions,
        getFirstAccessiblePage,
        canAccessLocation,
        canAccessStaffData,
        canAccessClientData,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

