# Sales Role Access Control Flow

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Login (Samrawit)                        │
│                  samrawit@habeshasalon.com                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Auth Provider (lib/auth-provider.tsx)              │
│                                                                 │
│  1. Check user role                                             │
│  2. If role === "SALES"                                         │
│     → Redirect to /dashboard/pos                                │
│  3. Set user permissions from ROLE_PERMISSIONS.SALES            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│           Dashboard Layout (app/dashboard/layout.tsx)           │
│                                                                 │
│  1. useSalesRouteGuard() hook activated                         │
│  2. Monitors all route changes                                  │
│  3. Filters navigation menu                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         Route Guard (hooks/use-sales-route-guard.ts)            │
│                                                                 │
│  Allowed Routes for SALES:                                      │
│  ✅ /dashboard/pos                                              │
│  ✅ /dashboard/inventory                                        │
│                                                                 │
│  If user tries to access other routes:                          │
│  ❌ /dashboard → Redirect to /dashboard/pos                     │
│  ❌ /dashboard/appointments → Redirect to /dashboard/pos        │
│  ❌ /dashboard/clients → Redirect to /dashboard/pos             │
│  ❌ Any other page → Redirect to /dashboard/pos                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│        Navigation Menu (components/protected-nav.tsx)           │
│                                                                 │
│  For SALES role, only show:                                     │
│  • Point of Sale                                                │
│  • Inventory                                                    │
│                                                                 │
│  Hide all other menu items                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Page Access (POS or Inventory)                     │
│                                                                 │
│  Each page checks permissions:                                  │
│  if (!hasPermission("view_pos")) {                              │
│    return <AccessDenied />                                      │
│  }                                                              │
│                                                                 │
│  SALES role has:                                                │
│  ✅ VIEW_POS permission                                         │
│  ✅ VIEW_INVENTORY permission                                   │
│  → Access granted                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Access Control Matrix

| Page/Feature | Admin | Manager | Staff | Receptionist | **SALES (Samrawit)** |
|--------------|-------|---------|-------|--------------|---------------------|
| Dashboard Home | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Point of Sale** | ✅ | ✅ | ✅ | ✅ | **✅** |
| **Inventory** | ✅ | ✅ | ❌ | ✅ | **✅** |
| Appointments | ✅ | ✅ | ✅ | ✅ | ❌ |
| Clients | ✅ | ✅ | ❌ | ❌ | ❌ |
| Services | ✅ | ✅ | ✅ | ✅ | ❌ |
| Staff | ✅ | ✅ | ❌ | ✅ | ❌ |
| Accounting | ✅ | ✅ | ❌ | ❌ | ❌ |
| HR | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Settings | ✅ | ✅ | ❌ | ❌ | ❌ |

## Permission Details for SALES Role

### ✅ Granted Permissions

#### POS Permissions:
- `VIEW_POS` - Access Point of Sale page
- `CREATE_SALE` - Process sales transactions
- `EDIT_SALE` - Modify sales
- `APPLY_DISCOUNT` - Apply discounts to sales
- `ISSUE_REFUND` - Issue refunds

#### Inventory Permissions:
- `VIEW_INVENTORY` - View inventory items
- `CREATE_INVENTORY` - Add new products
- `TRANSFER_INVENTORY` - Transfer products between locations

#### Supporting Permissions:
- `VIEW_APPOINTMENTS` - View appointments (for POS)
- `CREATE_APPOINTMENT` - Create appointments (for POS checkout)
- `CREATE_CLIENT` - Add walk-in customers
- `EDIT_CLIENT` - Update client information
- `VIEW_SERVICES` - View service list (for POS)
- `VIEW_STAFF` - View staff list (for POS)
- `VIEW_GIFT_CARDS` - View gift cards
- `CREATE_GIFT_CARD` - Create gift cards
- `REDEEM_GIFT_CARD` - Redeem gift cards
- `VIEW_MEMBERSHIPS` - View memberships
- `CREATE_MEMBERSHIP` - Create memberships
- `VIEW_CHAT` - Access chat
- `SEND_MESSAGES` - Send messages

### ❌ Denied Permissions

- `VIEW_DASHBOARD` - Cannot access dashboard home
- `VIEW_CLIENTS` - Cannot access client management page
- `EDIT_INVENTORY` - Cannot edit existing inventory (only Admin)
- `DELETE_INVENTORY` - Cannot delete inventory
- `DELETE_SALE` - Cannot delete sales
- `VIEW_ACCOUNTING` - Cannot access accounting
- `VIEW_HR` - Cannot access HR
- `VIEW_REPORTS` - Cannot access reports
- `VIEW_SETTINGS` - Cannot access settings
- All other administrative permissions

## Protection Layers

### Layer 1: Auth Provider
```typescript
// lib/auth-provider.tsx
if (roleUpper === "SALES") {
  return "/dashboard/pos"  // Always redirect to POS
}
```

### Layer 2: Route Guard Hook
```typescript
// hooks/use-sales-route-guard.ts
const DEFAULT_ALLOWED_ROUTES = ["/dashboard/pos", "/dashboard/inventory"]

if (!isAllowed) {
  router.replace(resolvedFallback)  // Redirect to POS
}
```

### Layer 3: Navigation Filtering
```typescript
// components/protected-nav.tsx
const isSalesRole = roleUpper === "SALES"
const salesAllowedRoutes = new Set(["/dashboard/pos", "/dashboard/inventory"])

if (isSalesRole) {
  return salesAllowedRoutes.has(item.href)  // Only show allowed items
}
```

### Layer 4: Permission Checks
```typescript
// app/dashboard/pos/page.tsx
if (!hasPermission("view_pos")) {
  return <AccessDenied />  // Show access denied
}
```

## User Journey Examples

### Example 1: Successful Login
```
1. Samrawit enters credentials
2. System validates: Role = SALES
3. Auth provider redirects to /dashboard/pos
4. Route guard allows access
5. Navigation shows: POS, Inventory
6. Page loads successfully
```

### Example 2: Attempting Unauthorized Access
```
1. Samrawit tries to navigate to /dashboard/appointments
2. Route guard detects: Current route not in allowed list
3. Console logs: "🚫 Access denied for SALES role: /dashboard/appointments"
4. Route guard redirects to /dashboard/pos
5. Console logs: "✅ Redirecting to: /dashboard/pos"
6. POS page loads
```

### Example 3: Using POS
```
1. Samrawit is on /dashboard/pos
2. Route guard checks: ✅ Allowed
3. Page checks permission: ✅ Has VIEW_POS
4. Full POS functionality available:
   - Add items to cart
   - Select clients
   - Apply discounts
   - Process payments
   - Issue refunds
```

### Example 4: Using Inventory
```
1. Samrawit navigates to /dashboard/inventory
2. Route guard checks: ✅ Allowed
3. Page checks permission: ✅ Has VIEW_INVENTORY
4. Inventory functionality available:
   - View all products
   - Add new products
   - Transfer products
   - Adjust stock levels
   - View stock by location
```

## Security Features

### 1. Automatic Redirect
- No manual intervention needed
- User automatically sent to allowed page
- Prevents confusion and errors

### 2. Multiple Validation Points
- Auth provider
- Route guard
- Navigation filtering
- Page-level permission checks

### 3. Role-Based (Not User-Based)
- Applies to all SALES role users
- No hardcoded user emails
- Easy to add more sales staff

### 4. Logging and Debugging
- All access attempts logged
- Clear console messages
- Easy to troubleshoot

### 5. No Impact on Other Users
- Only affects SALES role
- Other roles work normally
- Isolated implementation

## Testing Checklist

- [ ] Login as Samrawit → Redirected to POS
- [ ] Navigation shows only POS and Inventory
- [ ] Can access POS page
- [ ] Can access Inventory page
- [ ] Cannot access Dashboard home (redirected)
- [ ] Cannot access Appointments (redirected)
- [ ] Cannot access Clients (redirected)
- [ ] Cannot access any other page (redirected)
- [ ] POS functionality works correctly
- [ ] Inventory functionality works correctly
- [ ] Other users not affected
- [ ] Console shows correct logs

## Maintenance Notes

### To Add More Sales Staff:
1. Create user account
2. Set role to "SALES"
3. Assign locations
4. Done - restrictions apply automatically

### To Modify Allowed Pages:
1. Update `DEFAULT_ALLOWED_ROUTES` in `hooks/use-sales-route-guard.ts`
2. Update `salesAllowedRoutes` in `components/protected-nav.tsx`
3. Update `ROLE_PERMISSIONS.SALES` in `lib/permissions.ts`
4. Test thoroughly

### To Remove Restrictions:
1. Change user role from "SALES" to another role
2. User logs out and back in
3. Restrictions no longer apply

---

**Last Updated**: November 28, 2025
**Status**: ✅ Active and Enforced
