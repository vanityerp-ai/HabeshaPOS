# SALES Role Permissions

## Overview
The SALES role is designed for staff members who primarily handle Point of Sale (POS) transactions and inventory management. This role has comprehensive access to sales and inventory functions while maintaining appropriate restrictions on sensitive areas.

## Granted Permissions

### ✅ Point of Sale (POS)
- **`VIEW_POS`** - Access the Point of Sale interface
- **`CREATE_SALE`** - Process new sales transactions
- **`EDIT_SALE`** - Modify sales transactions
- **`APPLY_DISCOUNT`** - Apply discounts to transactions
- **`ISSUE_REFUND`** - Process customer refunds

### ✅ Inventory Management
- **`VIEW_INVENTORY`** - View inventory levels and products
- **`CREATE_INVENTORY`** - Add new products to inventory
- **`TRANSFER_INVENTORY`** - Transfer products between locations

❌ **Note:** Sales role CANNOT edit existing inventory items. Only Admin and Super Admin can edit inventory.

### ✅ Appointments (Limited)
- **`VIEW_APPOINTMENTS`** - View appointment calendar
- **`CREATE_APPOINTMENT`** - Book new appointments for customers

### ✅ Client Management (Limited)
- **`CREATE_CLIENT`** - Add new clients to the system
- **`EDIT_CLIENT`** - Update client information

### ✅ Service Information
- **`VIEW_SERVICES`** - View available services and pricing

### ✅ Staff Information
- **`VIEW_STAFF`** - View staff members and their schedules

### ✅ Gift Cards & Memberships
- **`VIEW_GIFT_CARDS`** - View gift card inventory
- **`CREATE_GIFT_CARD`** - Issue new gift cards
- **`REDEEM_GIFT_CARD`** - Redeem gift cards during sales
- **`VIEW_MEMBERSHIPS`** - View membership information
- **`CREATE_MEMBERSHIP`** - Sell membership packages

### ✅ Communication
- **`VIEW_CHAT`** - Access team chat
- **`SEND_MESSAGES`** - Send messages to team members
- **`SEND_PRODUCT_REQUESTS`** - Request products from management
- **`SEND_HELP_REQUESTS`** - Request assistance

## ❌ Restricted Access

The SALES role does NOT have access to:
- Dashboard analytics
- Delete operations (appointments, clients, inventory)
- **Edit inventory items** (only Admin and Super Admin)
- **Adjust stock levels** (only Admin and Super Admin)
- Staff management (create, edit, delete staff)
- Service management (create, edit, delete services)
- Accounting & financial reports
- HR management
- System settings
- Location management
- Full client history viewing (only Admins)

## Typical Use Cases

### 1. Processing Sales
```
1. Navigate to Point of Sale
2. Select products/services
3. Apply discounts if applicable
4. Process payment
5. Issue receipt
```

### 2. Managing Inventory
```
1. Navigate to Inventory
2. View current stock levels
3. Add new products (with CREATE_INVENTORY permission)
4. Transfer products between locations (with TRANSFER_INVENTORY permission)

Note: Cannot edit existing product details or adjust stock - Admin only
```

### 3. Booking Appointments
```
1. Navigate to Appointments
2. Create new appointment
3. Select service and staff
4. Add or edit client information
5. Confirm booking
```

### 4. Handling Returns/Refunds
```
1. Navigate to Point of Sale
2. Access transaction history
3. Select transaction to refund
4. Process refund
5. Update inventory if applicable
```

## Setting Up a Sales User

### Step 1: Create User Account
1. Go to **Settings → Users**
2. Click **Add User**
3. Fill in user details:
   - Name
   - Email
   - Phone
4. Set **Role** to **SALES**
5. Assign **Locations** they can access

### Step 2: Configure Permissions (Optional)
The SALES role has pre-configured permissions, but you can customize them:
1. Go to **Settings → Roles**
2. Find **SALES** role
3. Modify permissions as needed
4. Save changes

### Step 3: User Login
1. User receives login credentials
2. Access system at your domain
3. Login with email and password
4. Automatically see POS and Inventory menus

## Navigation Menu Access

Sales users will see the following in their navigation menu:
- **Appointments** - Create and view appointments
- **Services** - View service catalog
- **Staff** - View staff schedules
- **Inventory** - Full inventory management
- **Point of Sale** - POS interface
- **Gift Cards & Memberships** - Manage gift cards and memberships

## Security Notes

- Sales users cannot view sensitive financial data
- Cannot modify system-wide settings
- Cannot manage other users or staff
- Location-based access control applies
- All actions are logged for audit purposes

## Best Practices

### For Administrators
1. **Assign Specific Locations** - Limit access to relevant locations
2. **Regular Audits** - Review sales transactions regularly
3. **Inventory Checks** - Verify inventory transfers
4. **Training** - Ensure proper POS and inventory training

### For Sales Users
1. **Verify Inventory** - Always check stock before sales
2. **Accurate Data Entry** - Enter product information correctly
3. **Document Transfers** - Add notes when transferring inventory
4. **Customer Service** - Keep client information up to date

## Troubleshooting

### Issue: Cannot Access Inventory Page
**Solution:** 
- Verify role is set to SALES
- Check location access permissions
- Refresh browser cache (Ctrl+Shift+R)

### Issue: Cannot Transfer Inventory
**Solution:**
- Verify TRANSFER_INVENTORY permission is granted
- Check if source and destination locations are in assigned locations
- Ensure sufficient stock at source location

### Issue: Cannot See POS Menu
**Solution:**
- Verify VIEW_POS permission is granted
- Check if user is logged in with correct role
- Clear browser cache and cookies

## Related Documentation
- [Inventory Management Guide](./INVENTORY_MANAGEMENT.md)
- [Point of Sale Guide](./POS_GUIDE.md)
- [Role-Based Access Control](./RBAC.md)
