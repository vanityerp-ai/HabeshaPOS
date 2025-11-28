"use client"

import * as React from "react"
import { useAuth } from "@/lib/auth-provider"
import { useLocations } from "@/lib/location-provider"
import { useLocationFilter } from "@/hooks/use-location-filter"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function LocationSelector() {
  const { currentLocation, setCurrentLocation, user, isAuthenticated } = useAuth()
  const { locations, getLocationName, isHomeServiceEnabled, getActiveLocations, isLoading, hasInitialized } = useLocations()
  const { filterLocations, isAdmin, userLocations } = useLocationFilter()
  const roleUpper = user?.role?.toUpperCase() || ""
  const isSalesRole = roleUpper === "SALES"

  // Memoize the filtered locations to prevent unnecessary re-renders
  const filteredLocations = React.useMemo(() => {
    return locations
      .filter(location => location.status === "Active" && location.name && location.name.trim() !== "")
      .filter(location => !!location.id); // Filter out locations without a valid ID
  }, [locations]);

  // Get all active locations including special ones (online, home) with deduplication and user filtering
  const allActiveLocations = React.useMemo(() => {
    const activeLocations = getActiveLocations()
      .filter(location => location.name && location.name.trim() !== "")
      .filter(location => !!location.id);

    // Remove duplicates based on name (keep the first occurrence)
    const uniqueActiveLocations = activeLocations.filter((location, index, array) =>
      array.findIndex(loc => loc.name.toLowerCase().trim() === location.name.toLowerCase().trim()) === index
    );

    // Apply location filtering based on user access
    const userFilteredLocations = filterLocations(uniqueActiveLocations);

    if (isSalesRole) {
      const onlineLocation = userFilteredLocations.find(loc => loc.id === "online") || {
        id: "online",
        name: "Online Store",
        address: "Client Portal",
        city: "Online",
        state: "Online",
        zipCode: "",
        country: "Online",
        phone: "",
        email: "support@salonhub.com",
        status: "Active",
        description: "Online orders placed through the client portal",
        enableOnlineBooking: false,
        displayOnWebsite: false,
        staffCount: 0,
        servicesCount: 0,
      }
      return [onlineLocation]
    }

    return userFilteredLocations;
  }, [getActiveLocations, filterLocations, isSalesRole]);

  const handleLocationChange = React.useCallback((newLocation: string) => {
    setCurrentLocation(newLocation)
  }, [setCurrentLocation]);

  // Ensure current location is valid for the user
  React.useEffect(() => {
    if (allActiveLocations.length > 0 && currentLocation) {
      const allAvailableIds = [
        ...(isAdmin ? ["all"] : []),
        ...allActiveLocations.map(loc => loc.id)
      ];

      // If current location is not in available locations, set to first available
      if (!allAvailableIds.includes(currentLocation)) {
        const firstAvailable = isAdmin ? "all" : allActiveLocations[0]?.id;
        if (firstAvailable) {
          setCurrentLocation(firstAvailable);
        }
      }
    }
  }, [allActiveLocations, currentLocation, isAdmin, setCurrentLocation]);

  // Memoize the entire select component to prevent unnecessary re-renders
  const selectComponent = React.useMemo(() => {
    // Define the desired order for locations
    const locationOrder = [
      "muaither",
      "medinat khalifa",
      "d-ring road",
      "home",
      "online"
    ]

    // Separate regular locations from special locations
    const regularLocations = allActiveLocations.filter(loc =>
      loc.id !== "home" && loc.id !== "online"
    );
    const onlineLocation = allActiveLocations.find(loc => loc.id === "online");
    const homeLocation = allActiveLocations.find(loc => loc.id === "home");

    // Remove duplicates from regular locations before sorting (by name)
    const uniqueRegularLocations = regularLocations.filter((location, index, array) =>
      array.findIndex(loc => loc.name.toLowerCase().trim() === location.name.toLowerCase().trim()) === index
    );

    // Sort regular locations according to the desired order
    const sortedRegularLocations = uniqueRegularLocations.sort((a, b) => {
      const aIndex = locationOrder.findIndex(name =>
        a.name.toLowerCase().includes(name) || name.includes(a.name.toLowerCase())
      );
      const bIndex = locationOrder.findIndex(name =>
        b.name.toLowerCase().includes(name) || name.includes(b.name.toLowerCase())
      );

      // If both locations are in the order array, sort by their position
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      // If only one is in the order array, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      // If neither is in the order array, maintain alphabetical order
      return a.name.localeCompare(b.name);
    });

    // Determine the correct value for the select
    const allAvailableIds = [
      ...(isAdmin ? ["all"] : []),
      ...sortedRegularLocations.map(loc => loc.id),
      ...(homeLocation && user?.role === "ADMIN" ? ["home"] : []),
      ...(onlineLocation ? ["online"] : [])
    ];

    const selectValue = isSalesRole
      ? "online"
      : currentLocation && allAvailableIds.includes(currentLocation)
        ? currentLocation
        : (isAdmin ? "all" : allAvailableIds[0] || "");

    return (
      <Select
        value={selectValue}
        onValueChange={handleLocationChange}
      >
        <SelectTrigger className="w-[180px] bg-muted/50 border-0" disabled={isSalesRole}>
          <SelectValue placeholder="Select location" />
        </SelectTrigger>
        <SelectContent>
          {/* Only show "All Locations" option for admin users */}
          {isAdmin && <SelectItem value="all">All Locations</SelectItem>}

          {/* Map through regular active locations in custom order */}
          {sortedRegularLocations.map(location => (
            <SelectItem key={location.id} value={location.id}>
              📍 {location.name}
            </SelectItem>
          ))}

          {/* Add Home Service option if enabled and exists - only for admin users and not already in regular locations */}
          {isHomeServiceEnabled && homeLocation && user?.role === "ADMIN" && !sortedRegularLocations.some(loc => loc.id === "home") && (
            <SelectItem value="home" key="home">
              🏠 Home Service
            </SelectItem>
          )}

          {/* Add Online Store option after Home Service */}
          {onlineLocation && (
            <SelectItem value="online" key="online">
              🌐 Online Store
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    );
  }, [currentLocation, handleLocationChange, allActiveLocations, isHomeServiceEnabled, isAdmin, user?.role]);

  // Don't render if locations are still loading or user is not loaded
  if (isLoading || !isAuthenticated || !hasInitialized) {
    return (
      <div className="w-[180px] h-10 bg-muted/50 rounded-md animate-pulse" />
    );
  }

  // If no locations are available after initialization, show a message
  if (hasInitialized && locations.length === 0) {
    return (
      <div className="w-[180px] h-10 bg-muted/50 rounded-md flex items-center justify-center text-sm text-muted-foreground">
        No locations
      </div>
    );
  }

  // If no locations are available after filtering, show a message
  if (allActiveLocations.length === 0) {
    return (
      <div className="w-[180px] h-10 bg-muted/50 rounded-md flex items-center justify-center text-sm text-muted-foreground">
        No access
      </div>
    );
  }

  return selectComponent;
}