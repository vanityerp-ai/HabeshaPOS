# ⚡ Quick Fix Guide - Samrawit Access Issue

## Problem
Samrawit gets "Failed to fetch locations" error and cannot access POS/Inventory.

## Solution (5 Minutes)

### Step 1: Open Prisma Studio
```bash
npx prisma studio
```
Wait for browser to open (http://localhost:5555)

### Step 2: Fix Samrawit's Location
1. Click **"Staff"** in left sidebar
2. Find row: `samrawit@habeshasalon.com`
3. Look at **"locations"** column
4. If it's empty `[]` or has weird values:
   - Click **Edit** (pencil icon)
   - Change **locations** to: `["loc1"]`
   - Click **Save**

### Step 3: Verify Role
While editing, also check:
- **role**: Must be `SALES` (uppercase)
- **isActive**: Must be `true`

### Step 4: Restart Server
```bash
# In terminal, press Ctrl+C
# Then run:
npm run dev
```

### Step 5: Clear Browser & Test
1. Press `Ctrl+Shift+Delete` → Clear cache
2. Login as samrawit@habeshasalon.com
3. Should redirect to `/dashboard/pos`
4. Should work without errors

## That's It!

After these steps:
- ✅ Samrawit can access POS
- ✅ Samrawit can access Inventory  
- ❌ Samrawit CANNOT access other pages (will redirect to POS)

## If Still Not Working

Check the **"Location"** table in Prisma Studio:
- Must have at least one location with `isActive: true`
- If empty, create one:
  - Click "Add record"
  - name: "Main Location"
  - address: "123 Main St"
  - city: "Doha"
  - isActive: true
  - Save
  - Then go back and update Samrawit's locations to use this location's ID

## Need Help?

See detailed guides:
- `MANUAL_FIX_STEPS.md` - Complete step-by-step
- `FIX_LOCATIONS_ERROR.md` - Troubleshooting

---

**TL;DR**: Open Prisma Studio → Staff table → Find Samrawit → Set locations to `["loc1"]` → Save → Restart server
