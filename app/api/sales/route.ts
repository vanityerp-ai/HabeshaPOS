import { NextResponse } from "next/server"
import { salesRepository } from "@/lib/db"
import { getServerSession } from "next-auth"
import { PERMISSIONS } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const sales = await salesRepository.findAll()
    return NextResponse.json({ sales })
  } catch (error) {
    console.error("Error fetching sales:", error)
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Check user session and permissions
    const session = await getServerSession()

    // If no session or user, return unauthorized
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user role from the session
    const userRole = session.user.role

    // Get the request data first
    const data = await request.json()

    // Check permissions from settings storage (custom roles)
    const { SettingsStorage } = await import("@/lib/settings-storage")
    const storedRoles = SettingsStorage.getRoles()

    // Try to find the user's role (case-insensitive)
    let userRoleData = storedRoles.find(role => role.id === userRole)
    if (!userRoleData) {
      userRoleData = storedRoles.find(role => role.id.toLowerCase() === userRole.toLowerCase())
    }

    let hasPermission = false

    // Check if user has the required permission
    if (userRoleData && userRoleData.permissions) {
      hasPermission = userRoleData.permissions.includes(PERMISSIONS.CREATE_SALE) || userRoleData.permissions.includes(PERMISSIONS.ALL)
    } else {
      // Fallback to default role permissions
      const { ROLE_PERMISSIONS } = await import("@/lib/permissions")
      const roleKey = userRole.toUpperCase() as keyof typeof ROLE_PERMISSIONS
      const defaultPermissions = ROLE_PERMISSIONS[roleKey] || []
      hasPermission = defaultPermissions.includes(PERMISSIONS.CREATE_SALE) || defaultPermissions.includes(PERMISSIONS.ALL)
    }

    if (!hasPermission) {
      return NextResponse.json({ error: "Permission denied - you don't have permission to create sales" }, { status: 403 })
    }

    // Validate required fields
    if (!data.locationId || !data.staffId || !data.items || !data.items.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get checkout settings for dynamic tax rate
    const checkoutSettings = SettingsStorage.getCheckoutSettings()

    // Calculate totals
    const subtotal = data.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0)
    const taxRate = checkoutSettings.taxRate / 100 // Convert percentage to decimal
    const taxAmount = subtotal * taxRate
    const discountAmount = data.discountAmount || 0
    const tipAmount = data.tipAmount || 0
    const totalAmount = subtotal + taxAmount - discountAmount + tipAmount

    // Create sale
    const sale = await salesRepository.create(
      {
        client_id: data.clientId || null,
        staff_id: data.staffId,
        location_id: data.locationId,
        appointment_id: data.appointmentId || null,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        tip_amount: tipAmount,
        total_amount: totalAmount,
        payment_method: data.paymentMethod,
        payment_status: data.paymentStatus,
        notes: data.notes || null,
      },
      data.items.map((item: any) => ({
        item_type: item.type,
        service_id: item.type === "service" ? item.id : null,
        product_id: item.type === "product" ? item.id : null,
        quantity: item.quantity,
        unit_price: item.price,
        discount_amount: item.discountAmount || 0,
        tax_amount: item.price * item.quantity * taxRate,
        total_amount: item.price * item.quantity * (1 + taxRate) - (item.discountAmount || 0),
      })),
    )

    // Also create a transaction record in Prisma for accounting visibility
    try {
      const hasProducts = data.items.some((item: any) => item.type === "product");
      const hasServices = data.items.some((item: any) => item.type === "service");
      
      // Determine transaction type
      let transactionType = "product_sale";
      if (hasServices && !hasProducts) {
        transactionType = "service_sale";
      } else if (hasServices && hasProducts) {
        transactionType = "consolidated_sale";
      }

      // Get location name for reference
      const location = await prisma.location.findUnique({
        where: { id: data.locationId },
        select: { name: true }
      });

      const locationName = location?.name || data.locationId;

      await prisma.transaction.create({
        data: {
          userId: data.staffId,
          amount: totalAmount,
          type: transactionType,
          status: data.paymentStatus === "paid" ? "completed" : data.paymentStatus === "partial" ? "partial" : "pending",
          method: data.paymentMethod || "cash",
          reference: `SALE-${sale.id}`,
          description: `POS Sale - ${data.items.length} item(s)`,
          locationId: data.locationId,
          serviceAmount: hasServices ? data.items
            .filter((item: any) => item.type === "service")
            .reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) : null,
          productAmount: hasProducts ? data.items
            .filter((item: any) => item.type === "product")
            .reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) : null,
          discountAmount: discountAmount || null,
          items: JSON.stringify(data.items)
        }
      });
      
      console.log(`✅ Created transaction record for POS sale ${sale.id} at location ${locationName}`);
    } catch (transactionError) {
      console.error(`⚠️ Failed to create transaction record for POS sale: ${transactionError}`);
      // Don't fail the sale creation if transaction recording fails
    }

    return NextResponse.json({
      success: true,
      sale,
    })
  } catch (error) {
    console.error("Error creating sale:", error)
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 })
  }
}

