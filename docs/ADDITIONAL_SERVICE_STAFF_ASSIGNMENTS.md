# Additional Service Staff Assignments

## Overview
This feature allows assigning different staff members to additional services within a single appointment, enabling multi-staff bookings while maintaining a unified receipt.

## Architecture

### Database Schema
Staff assignments for additional services are stored in the `appointment_services` table:

```sql
CREATE TABLE appointment_services (
  id TEXT PRIMARY KEY,
  appointmentId TEXT NOT NULL,
  serviceId TEXT NOT NULL,
  staffId TEXT,  -- Staff member assigned to this service
  price DECIMAL NOT NULL,
  duration INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (appointmentId) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (serviceId) REFERENCES services(id),
  FOREIGN KEY (staffId) REFERENCES staff_members(id),
  UNIQUE (appointmentId, serviceId)
);
```

### Data Flow

#### 1. Creating Additional Services with Staff Assignments

**Frontend → API:**
```typescript
// Data sent to PUT /api/appointments/[id]
{
  additionalServices: [
    {
      id: "service-1234567890-temp",  // Temporary UI ID
      serviceId: "clxxx....",          // Real database service ID
      name: "Haircut",
      price: 50,
      duration: 30,
      staffId: "cm123...",             // Staff member ID
      staffName: "Jane Smith"
    }
  ]
}
```

**API → Database:**
```typescript
// Saved to appointment_services table
await prisma.appointment.update({
  where: { id: appointmentId },
  data: {
    services: {
      create: [
        {
          serviceId: "clxxx....",
          staffId: "cm123...",  // ✅ Saved to database
          price: 50,
          duration: 30
        }
      ]
    }
  }
})
```

#### 2. Retrieving Staff Assignments

**Database → API:**
```typescript
// GET /api/appointments or GET /api/appointments/[id]
const appointments = await prisma.appointment.findMany({
  include: {
    services: {
      include: {
        service: { select: { name: true } },
        staff: true  // ✅ Load staff info
      }
    }
  }
})
```

**API → Frontend:**
```typescript
// Response format
{
  id: "appointment-id",
  // ... main appointment fields
  additionalServices: [
    {
      id: "clxxx....",
      serviceId: "clxxx....",
      name: "Haircut",
      price: 50,
      duration: 30,
      staffId: "cm123...",
      staffName: "Jane Smith"  // ✅ Retrieved from database
    }
  ]
}
```

#### 3. Visual Calendar Blocking

**Frontend (Client-Side Only):**
```typescript
// Generate visual blocking entries for calendar display
const appointmentsWithBlocking = React.useMemo(() => {
  const result = [...appointments];
  
  appointments.forEach(appointment => {
    appointment.additionalServices?.forEach(service => {
      if (service.staffId && service.staffName) {
        result.push({
          id: `block-${appointment.id}-${service.serviceId}-${service.staffId}`,
          // ... visual blocking entry data
          isVisualBlockingOnly: true  // Flag for UI filtering
        });
      }
    });
  });
  
  return result;
}, [appointments]);
```

### Key Components

#### 1. API Routes

**File:** `app/api/appointments/[id]/route.ts`
- **PUT Endpoint:** Saves staff assignments to `appointment_services.staffId`
- **GET Endpoint:** Retrieves staff assignments with `include: { staff: true }`

**File:** `app/api/appointments/route.ts`
- **GET Endpoint:** Returns all appointments with staff assignments
- **POST Endpoint:** Creates new appointments (main service only, additional services added via PUT)

#### 2. Frontend Components

**File:** `app/dashboard/appointments/page.tsx`
- Fetches appointments from API
- Generates visual blocking entries client-side
- Handles appointment click events (redirects blocking entries to parent)
- Filters out visual entries from actual appointment list

**File:** `components/scheduling/enhanced-booking-summary.tsx`
- Displays booking summary
- Filters out `isVisualBlockingOnly` entries
- Shows all services under one appointment (unified receipt)

#### 3. Calendar Display

**File:** `components/scheduling/enhanced-salon-calendar.tsx`
- Receives `appointmentsWithBlocking` array
- Displays visual blocking entries for staff availability
- All blocking is visual only - no database records created

## Multi-Device Synchronization

### How It Works

1. **Database as Single Source of Truth**
   - All staff assignments stored in PostgreSQL
   - No localStorage dependencies
   - Accessible from any device/browser

2. **Real-Time Change Tracking**
   - Changes tracked via `DataChange` table
   - `useEntityChanges('Appointment')` hook listens for updates
   - Automatic refresh when changes detected

3. **Change Propagation**
   ```
   Device A: Add additional service with staff
   ↓
   API: Save to database + trackChange()
   ↓
   DataChange table: New record created
   ↓
   Device B: useEntityChanges hook detects change
   ↓
   Device B: Automatically refreshes appointments
   ↓
   Device B: Sees updated staff assignment
   ```

### Benefits

✅ **Multi-location support:** All locations see the same data  
✅ **Multi-device support:** Works across browsers and devices  
✅ **Persistent storage:** Data survives browser restarts  
✅ **Real-time sync:** Changes propagate in ~1-5 seconds  
✅ **Staff availability:** System knows who is booked when  
✅ **Unified receipts:** One appointment = one receipt  

## Testing

### Manual Testing

1. **Add Additional Service with Staff Assignment:**
   - Open appointment in Calendar View
   - Click "Add Service" button
   - Select service and assign different staff
   - Save changes

2. **Verify Database Storage:**
   ```bash
   npx tsx scripts/test-additional-service-storage.ts
   ```

3. **Verify Multi-Device Sync:**
   - Open app in Browser A, create appointment with additional service
   - Open app in Browser B (same or different device)
   - Browser B should automatically show the updated appointment within seconds

### Automated Testing

Run the verification script:
```bash
npx tsx scripts/test-additional-service-storage.ts
```

Expected output:
```
✅ Additional service storage is working!
✅ Staff assignments are being saved to the database!
```

## Database Migration

The `staffId` column was added to `appointment_services` table via migration:

**Migration:** `20251127174410_add_staff_to_appointment_services`

```sql
-- Add staffId column to appointment_services
ALTER TABLE "appointment_services" 
ADD COLUMN "staffId" TEXT;

-- Add foreign key constraint
ALTER TABLE "appointment_services" 
ADD CONSTRAINT "appointment_services_staffId_fkey" 
FOREIGN KEY ("staffId") 
REFERENCES "staff_members"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;
```

## Troubleshooting

### Issue: Staff assignments not showing
**Solution:** Ensure the migration has been applied:
```bash
npx prisma migrate deploy
```

### Issue: TypeScript errors about staff property
**Solution:** Regenerate Prisma client:
```bash
npx prisma generate
```

### Issue: Changes not syncing across devices
**Solution:** Check that change tracking is enabled and working:
```bash
# Verify DataChange table has recent entries
npx prisma studio
# Navigate to DataChange model and check timestamp
```

## Future Enhancements

1. **Staff Conflict Detection:** Prevent double-booking same staff
2. **Staff Notifications:** Alert staff when assigned to additional services
3. **Service Duration Validation:** Ensure appointment duration covers all services
4. **Bulk Staff Assignment:** Assign multiple services to same staff quickly
