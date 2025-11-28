# SALES Role Permissions

## Overview
The SALES role is **STRICTLY LIMITED** to Point of Sale (POS) transactions and inventory management **ONLY**. This role has NO access to appointments, clients, services, staff management, or any other modules. It is designed for dedicated cashier/inventory staff who should focus solely on sales and stock management.

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


### ✅ Gift Cards & Memberships
- **`VIEW_GIFT_CARDS`** - View gift card inventory
- **`CREATE_GIFT_CARD`** - Issue new gift cards
- **`REDEEM_GIFT_CARD`** - Redeem gift cards during sales
- **`VIEW_MEMBERSHIPS`** - View membership information
- **`CREATE_MEMBERSHIP`** - Sell membership packages


## ❌ Restricted Access

The SALES role does NOT have access to:
- **Dashboard** - No access to analytics or overview
- **Appointments** - Cannot view, create, or manage appointments
- **Clients** - Cannot access client management (no view, create, edit)
- **Services** - Cannot view or manage services
- **Staff** - Cannot view or manage staff members
- **Delete operations** - No delete permissions for any entity
- **Edit inventory items** - Only Admin and Super Admin can edit products
- **Adjust stock levels** - Only Admin and Super Admin
- **Accounting** - No access to financial reports or accounting
- **HR Management** - No access to HR module
- **Reports** - No access to reporting
- **Settings** - No access to system settings
- **Location management** - Cannot manage locations
- **Chat/Communication** - No access to team chat

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
