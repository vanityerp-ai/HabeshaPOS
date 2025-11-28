# Manual Fix Steps - Samrawit Locations Error

## Current Situation
- ✅ Access control is working correctly
- ❌ Locations API is returning 500 error
- ❌ This prevents dashboard from loading

## Quick Manual Fix

### Step 1: Open Prisma Studio
```bash
npx prisma studio
```
Wait for it to open in your browser (usually http://localhost:5555)

### Step 2: Check Locations Table

1. Click on **"Location"** table in the left sidebar
2. Verify there are active locations
3. Note down at least one location ID (e.g., the `id` column value)
4. Common format: `clxxx...` (long UUID) or `loc1`, `loc2`, etc.

**If no locations exist:**
- You need to create at least one location first
- Click "Add record" in Location table
- Fill in:
  - name: "Main Location"
  - address: "123 Main St"
  - city: "Doha"
  - isActive: true
- Save

### Step 3: Check Samrawit's Record

1. Click on **"Staff"** table in the left sidebar
2. Find the row where email = `samrawit@habeshasalon.com`
3. Check the **"locations"** column

**What you should see:**
- An array like: `["loc1"]` or `["clxxx..."]`
- Should NOT be empty: `[]`
- Should NOT be null

**If locations is empty or invalid:**
1. Click the **Edit** button (pencil icon) for Samrawit's row
2. Find the **"locations"** field
3. Enter a valid location ID from Step 2
   - Format: `["your-location-id-here"]`
   - Example: `["loc1"]` or `["clxxx-your-actual-id"]`
4. Click **Save**

### Step 4: Verify Role

While in Samrawit's record, also verify:
- **role**: Should be exactly `SALES` (uppercase)
- **isActive**: Should be `true`
- **email**: Should be `samrawit@habeshasalon.com`

### Step 5: Restart Development Server

1. Go to terminal where `npm run dev` is running
2. Press `Ctrl+C` to stop
3. Run again:
   ```bash
   npm run dev
   ```

### Step 6: Clear Browser Cache

1. Open browser
2. Press `Ctrl+Shift+Delete`
3. Select "All time"
4. Check "Cached images and files"
5. Click "Clear data"

### Step 7: Test Login

1. Go to login page
2. Login as: `samrawit@habeshasalon.com`
3. **Expected**: Redirected to `/dashboard/pos`
4. **Expected**: POS page loads without errors

### Step 8: Verify Console

Press F12 to open browser console, you should see:
```
✅ Successfully fetched X locations
✅ Access granted for SALES role: /dashboard/pos
```

Should NOT see:
```
❌ Failed to fetch locations
```

## Alternative: SQL Fix

If Prisma Studio doesn't work, you can use SQL directly:

### Check Samrawit's current data:
```sql
SELECT id, name, email, role, locations, "isActive"
FROM "Staff"
WHERE email = 'samrawit@habeshasalon.com';
```

### Get a valid location ID:
```sql
SELECT id, name
FROM "Location"
WHERE "isActive" = true
LIMIT 1;
```

### Update Samrawit's locations:
```sql
UPDATE "Staff"
SET locations = ARRAY['YOUR-LOCATION-ID-HERE']::text[]
WHERE email = 'samrawit@habeshasalon.com';
```

Replace `YOUR-LOCATION-ID-HERE` with an actual location ID from the query above.

### Verify the update:
```sql
SELECT name, email, role, locations
FROM "Staff"
WHERE email = 'samrawit@habeshasalon.com';
```

## Troubleshooting

### Issue: Prisma Studio won't open
**Solution**: 
- Check if port 5555 is already in use
- Try: `npx prisma studio --port 5556`

### Issue: Can't find Samrawit in Staff table
**Solution**:
- Check if she exists in User table instead
- Search by email: samrawit@habeshasalon.com
- She might need to be created in Staff table

### Issue: Still getting 500 error after fix
**Solution**:
1. Check server logs in terminal
2. Look for the actual error message
3. The error might be something else (database connection, etc.)

### Issue: Locations table is empty
**Solution**:
- You need to seed locations first
- Or create them manually in Prisma Studio
- At minimum, create one location with:
  - name, address, city, isActive: true

## Expected Result

After completing these steps:

✅ Samrawit can log in
✅ Redirected to `/dashboard/pos`
✅ POS page loads successfully
✅ Can navigate to Inventory
✅ Cannot access other pages (redirected to POS)
✅ No "Failed to fetch locations" error

## If Still Not Working

1. **Check server terminal** for error messages
2. **Check browser console** (F12) for errors
3. **Verify DATABASE_URL** in .env file
4. **Try restarting PostgreSQL** database
5. **Check if database has data**:
   ```bash
   npx prisma studio
   ```
   - Should see data in Location and Staff tables

## Summary

The main issue is that Samrawit needs:
1. ✅ Valid location assignment in database
2. ✅ Role set to "SALES"
3. ✅ isActive set to true

Once these are correct, the locations API will work and she can access POS and Inventory.

---

**Priority**: Fix Samrawit's location assignment in database using Prisma Studio (Step 1-3)
