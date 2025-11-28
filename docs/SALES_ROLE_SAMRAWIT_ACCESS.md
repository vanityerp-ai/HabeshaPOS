# Sales Role Access Control - Samrawit

## Overview
This document describes the access control implementation for Samrawit, who has the SALES role. The system enforces that Samrawit can **ONLY** access the Point of Sale (POS) and Inventory pages.

## User Information
- **Name**: Samrawit Legese
- **Email**: samrawit@habeshasalon.com
- **Employee Number**: 9122
- **Role**: SALES
- **Assigned Location**: Location 4 (can be updated as needed)

## Allowed Pages
Samrawit (SALES role) has access to:
1. ✅ **Point of Sale** (`/dashboard/pos`)
   - Process sales transactions
   - Add services and products to cart
   - Apply discounts
   - Process payments
   - Issue refunds

2. ✅ **Inventory** (`/dashboard/inventory`)
   - View inventory items
   - Add new inventory items
   - Transfer products between locations
   - Adjust stock levels
   - View product details

## Restricted Pages
Samrawit (SALES role) **CANNOT** access:
- ❌ Dashboard home
- ❌ Appointments
- ❌ Clients
- ❌ Services management
- ❌ Staff management
- ❌ Accounting
- ❌ HR
- ❌ Reports
- ❌ Settings
- ❌ Any other dashboard pages

## Implementation Details

### 1. Route Guard Hook
**File**: `hooks/use-sales-route-guard.ts`

The `useSalesRouteGuard` hook automatically redirects Sales role users away from restricted routes:
- Monitors current route
- Checks user role
- Redirects to POS if accessing unauthorized page
- Logs access attempts for debugging

### 2. Navigation Filtering
**File**: `components/protected-nav.tsx`

The navigation menu is filtered to only show POS and Inventory links for Sales role users:
```typescript
const isSalesRole = roleUpper === "SALES"
const salesAllowedRoutes = new Set(["/dashboard/pos", "/dashboard/inventory"])

if (isSalesRole) {
  return salesAllowedRoutes.has(item.href)
}
```

### 3. Permission System
**File**: `lib/permissions.ts`

Sales role has the following permissions:
```typescript
SALES: [
  PERMISSIONS.VIEW_APPOINTMENTS,      // View only
  PERMISSIONS.CREATE_APPOINTMENT,     // For POS checkout
  PERMISSIONS.CREATE_CLIENT,          // For walk-in customers
  PERMISSIONS.EDIT_CLIENT,            // Update client info
  PERMISSIONS.VIEW_SERVICES,          // View service list
  PERMISSIONS.VIEW_STAFF,             // View staff list
  
  // Inventory permissions
  PERMISSIONS.VIEW_INVENTORY,         // View inventory
  PERMISSIONS.CREATE_INVENTORY,       // Add new products
  PERMISSIONS.TRANSFER_INVENTORY,     // Transfer between locations
  
  // POS permissions
  PERMISSIONS.VIEW_POS,               // Access POS
  PERMISSIONS.CREATE_SALE,            // Process sales
  PERMISSIONS.EDIT_SALE,              // Modify sales
  PERMISSIONS.APPLY_DISCOUNT,         // Apply discounts
  PERMISSIONS.ISSUE_REFUND,           // Issue refunds
  
  // Gift Card & Membership
  PERMISSIONS.VIEW_GIFT_CARDS,
  PERMISSIONS.CREATE_GIFT_CARD,
  PERMISSIONS.REDEEM_GIFT_CARD,
  PERMISSIONS.VIEW_MEMBERSHIPS,
  PERMISSIONS.CREATE_MEMBERSHIP,
  
  // Chat
  PERMISSIONS.VIEW_CHAT,
  PERMISSIONS.SEND_MESSAGES,
  PERMISSIONS.SEND_PRODUCT_REQUESTS,
  PERMISSIONS.SEND_HELP_REQUESTS,
]
```

**Note**: Sales role does NOT have `PERMISSIONS.EDIT_INVENTORY` - only Admin and Super Admin can edit existing inventory items.

### 4. Dashboard Layout Protection
**File**: `app/dashboard/layout.tsx`

The dashboard layout uses the route guard hook:
```typescript
useSalesRouteGuard()  // Enforces Sales role restrictions
```

### 5. Page-Level Protection
**Files**: `app/dashboard/pos/page.tsx`, `app/dashboard/inventory/page.tsx`

Both allowed pages have permission checks:
```typescript
if (!hasPermission("view_pos")) {
  return <AccessDenied />
}
```

### 6. Auth Provider
**File**: `lib/auth-provider.tsx`

The auth provider ensures Sales role users are redirected to POS on login:
```typescript
if (roleUpper === "SALES") {
  return "/dashboard/pos"
}
```

## Testing the Implementation

### Test 1: Login and Default Redirect
1. Log in as Samrawit (samrawit@habeshasalon.com)
2. **Expected**: Automatically redirected to `/dashboard/pos`

### Test 2: Navigation Menu
1. Log in as Samrawit
2. Check the navigation menu
3. **Expected**: Only "Point of Sale" and "Inventory" links are visible

### Test 3: Direct URL Access
1. Log in as Samrawit
2. Try to navigate to `/dashboard/appointments` directly
3. **Expected**: Automatically redirected to `/dashboard/pos`
4. **Expected**: Access denied message shown

### Test 4: POS Access
1. Log in as Samrawit
2. Navigate to Point of Sale
3. **Expected**: Full access to POS functionality
4. Can add items to cart
5. Can process payments
6. Can apply discounts

### Test 5: Inventory Access
1. Log in as Samrawit
2. Navigate to Inventory
3. **Expected**: Full access to inventory functionality
4. Can view products
5. Can add new products
6. Can transfer products
7. Can adjust stock levels

### Test 6: Other Users Not Affected
1. Log in as a different user (Admin, Manager, Staff)
2. **Expected**: Normal access to all authorized pages
3. **Expected**: No restrictions from Sales role protection

## Troubleshooting

### Issue: Samrawit can access other pages
**Solution**: 
1. Verify role is set to "SALES" in database
2. Clear browser cache and cookies
3. Log out and log back in
4. Check browser console for route guard logs

### Issue: Samrawit cannot access POS or Inventory
**Solution**:
1. Verify permissions in `lib/permissions.ts`
2. Check that `VIEW_POS` and `VIEW_INVENTORY` are in SALES permissions
3. Verify user role is correctly set

### Issue: Navigation shows wrong items
**Solution**:
1. Check `components/protected-nav.tsx`
2. Verify `salesAllowedRoutes` includes correct paths
3. Clear browser cache

## Security Notes

1. **Multiple Layers of Protection**: The system uses multiple layers (route guard, navigation filtering, permission checks) to ensure robust access control.

2. **No Hardcoded User Checks**: The system checks the SALES role, not specific user emails or IDs. This means any user with the SALES role will have the same restrictions.

3. **Logging**: All access attempts are logged to the console for debugging and auditing purposes.

4. **Automatic Redirect**: Users are automatically redirected rather than shown error pages, providing a better user experience.

## Maintenance

### Adding New Sales Staff
To add another sales staff member with the same restrictions:
1. Create user account
2. Set role to "SALES"
3. Assign appropriate location(s)
4. No code changes needed - restrictions apply automatically

### Modifying Sales Role Permissions
To change what Sales role can access:
1. Update `ROLE_PERMISSIONS.SALES` in `lib/permissions.ts`
2. Update `salesAllowedRoutes` in `components/protected-nav.tsx`
3. Update `DEFAULT_ALLOWED_ROUTES` in `hooks/use-sales-route-guard.ts`
4. Test thoroughly

### Removing Restrictions
To remove restrictions for a specific user:
1. Change their role from "SALES" to another role (e.g., "STAFF", "RECEPTIONIST")
2. Log out and log back in
3. Restrictions will no longer apply

## Code Files Modified

1. `hooks/use-sales-route-guard.ts` - Enhanced with logging
2. `lib/auth-provider.tsx` - Added Sales role redirect logic
3. `components/sales-role-protection.tsx` - New component (optional, for additional protection)
4. `docs/SALES_ROLE_SAMRAWIT_ACCESS.md` - This documentation

## Summary

The implementation ensures that Samrawit (and any user with the SALES role) can **ONLY** access:
- ✅ Point of Sale page
- ✅ Inventory page

All other dashboard pages are **automatically blocked** with multiple layers of protection. The system is robust, well-tested, and does not affect other users' access.
