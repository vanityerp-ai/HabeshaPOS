// Comprehensive Validation Schemas
import { z } from 'zod'

// Base validation schemas
export const baseSchemas = {
  // Enhanced string validation
  string: (options: {
    min?: number
    max?: number
    pattern?: RegExp
    transform?: boolean
    allowEmpty?: boolean
  } = {}) => {
    let schema = z.string()
    
    if (!options.allowEmpty) {
      schema = schema.min(1, 'This field is required')
    }
    
    if (options.min !== undefined) {
      schema = schema.min(options.min, `Must be at least ${options.min} characters`)
    }
    
    if (options.max !== undefined) {
      schema = schema.max(options.max, `Must not exceed ${options.max} characters`)
    }
    
    if (options.pattern) {
      schema = schema.regex(options.pattern, 'Invalid format')
    }
    
    if (options.transform) {
      schema = schema.transform(str => str.trim())
    }
    
    return schema
  },

  // Enhanced email validation
  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email must not exceed 254 characters')
    .transform(email => email.toLowerCase().trim())
    .refine(email => !email.includes('..'), 'Email cannot contain consecutive dots')
    .refine(email => !email.startsWith('.'), 'Email cannot start with a dot')
    .refine(email => !email.endsWith('.'), 'Email cannot end with a dot'),

  // Enhanced phone validation
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .transform(phone => phone.replace(/\s+/g, ''))
    .refine(phone => phone.length >= 7, 'Phone number too short')
    .refine(phone => phone.length <= 15, 'Phone number too long'),

  // Enhanced password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
    .refine(password => !password.includes(' '), 'Password cannot contain spaces')
    .refine(password => !/(.)\1{2,}/.test(password), 'Password cannot have more than 2 consecutive identical characters'),

  // Enhanced name validation
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .transform(name => name.trim())
    .refine(name => name.split(' ').length <= 5, 'Name cannot have more than 5 parts')
    .refine(name => !name.includes('  '), 'Name cannot contain multiple consecutive spaces'),

  // Enhanced URL validation
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL must not exceed 2048 characters')
    .refine(url => {
      try {
        const parsed = new URL(url)
        return ['http:', 'https:'].includes(parsed.protocol)
      } catch {
        return false
      }
    }, 'URL must use HTTP or HTTPS protocol'),

  // Enhanced UUID validation
  uuid: z.string()
    .uuid('Invalid UUID format')
    .transform(uuid => uuid.toLowerCase()),

  // Enhanced date validation
  date: z.string()
    .datetime('Invalid date format')
    .refine(date => {
      const parsed = new Date(date)
      return parsed.getTime() > 0
    }, 'Invalid date value'),

  // Enhanced number validation
  positiveNumber: z.number()
    .positive('Must be a positive number')
    .finite('Must be a finite number'),

  // Enhanced currency validation
  currency: z.number()
    .min(0, 'Amount cannot be negative')
    .max(999999.99, 'Amount too large')
    .multipleOf(0.01, 'Amount can only have 2 decimal places'),

  // Enhanced percentage validation
  percentage: z.number()
    .min(0, 'Percentage cannot be negative')
    .max(100, 'Percentage cannot exceed 100%'),

  // Enhanced file validation
  file: z.object({
    name: z.string().min(1, 'File name is required'),
    size: z.number().max(10 * 1024 * 1024, 'File size cannot exceed 10MB'),
    type: z.string().min(1, 'File type is required')
  }).refine(file => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    return allowedTypes.includes(file.type)
  }, 'File type not allowed')
}

// Business entity schemas
export const entitySchemas = {
  // Enhanced client schema
  client: z.object({
    firstName: baseSchemas.name,
    lastName: baseSchemas.name,
    email: baseSchemas.email.optional(),
    phone: baseSchemas.phone,
    address: baseSchemas.string({ max: 255, transform: true }).optional(),
    city: baseSchemas.string({ max: 100, transform: true }).optional(),
    state: baseSchemas.string({ max: 100, transform: true }).optional(),
    zipCode: z.string()
      .max(20, 'ZIP code too long')
      .regex(/^[A-Za-z0-9\s-]+$/, 'Invalid ZIP code format')
      .optional(),
    country: baseSchemas.string({ max: 100, transform: true }).optional(),
    dateOfBirth: z.string()
      .datetime()
      .refine(date => {
        const birth = new Date(date)
        const now = new Date()
        const age = now.getFullYear() - birth.getFullYear()
        return age >= 13 && age <= 120
      }, 'Invalid date of birth')
      .optional(),
    notes: baseSchemas.string({ max: 1000, transform: true }).optional(),
    preferredLocation: baseSchemas.uuid.optional(),
    emergencyContact: z.object({
      name: baseSchemas.name,
      phone: baseSchemas.phone,
      relationship: baseSchemas.string({ max: 50, transform: true })
    }).optional(),
    preferences: z.object({
      communicationMethod: z.enum(['email', 'phone', 'sms']).default('email'),
      marketingOptIn: z.boolean().default(false),
      reminderPreference: z.enum(['none', '24h', '2h', '30m']).default('24h')
    }).optional()
  }),

  // Enhanced appointment schema
  appointment: z.object({
    clientId: baseSchemas.uuid,
    serviceId: baseSchemas.uuid,
    staffId: baseSchemas.uuid,
    locationId: baseSchemas.uuid,
    date: z.string()
      .datetime()
      .refine(date => {
        const appointmentDate = new Date(date)
        const now = new Date()
        return appointmentDate > now
      }, 'Appointment must be in the future'),
    duration: z.number()
      .min(15, 'Duration must be at least 15 minutes')
      .max(480, 'Duration cannot exceed 8 hours')
      .multipleOf(15, 'Duration must be in 15-minute increments'),
    notes: baseSchemas.string({ max: 500, transform: true }).optional(),
    price: baseSchemas.currency.optional(),
    status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
      .default('scheduled'),
    reminderSent: z.boolean().default(false),
    cancellationReason: baseSchemas.string({ max: 200, transform: true }).optional(),
    rescheduleCount: z.number().min(0).max(3).default(0)
  }).refine(data => {
    if (data.status === 'cancelled' && !data.cancellationReason) {
      return false
    }
    return true
  }, {
    message: 'Cancellation reason is required for cancelled appointments',
    path: ['cancellationReason']
  }),

  // Enhanced service schema
  service: z.object({
    name: baseSchemas.string({ min: 1, max: 100, transform: true }),
    description: baseSchemas.string({ max: 500, transform: true }).optional(),
    categoryId: baseSchemas.uuid,
    duration: z.number()
      .min(15, 'Duration must be at least 15 minutes')
      .max(480, 'Duration cannot exceed 8 hours')
      .multipleOf(15, 'Duration must be in 15-minute increments'),
    price: baseSchemas.currency,
    locations: z.array(baseSchemas.uuid).min(1, 'At least one location is required'),
    isActive: z.boolean().default(true),
    requirements: z.array(z.string().max(100)).optional(),
    contraindications: z.array(z.string().max(100)).optional(),
    aftercareInstructions: baseSchemas.string({ max: 1000, transform: true }).optional(),
    bookingBuffer: z.number().min(0).max(60).default(0), // minutes before/after
    maxAdvanceBooking: z.number().min(1).max(365).default(30), // days
    cancellationPolicy: z.object({
      allowCancellation: z.boolean().default(true),
      minimumNotice: z.number().min(0).max(72).default(24), // hours
      cancellationFee: baseSchemas.currency.default(0)
    }).optional()
  }),

  // Enhanced product schema
  product: z.object({
    name: baseSchemas.string({ min: 1, max: 100, transform: true }),
    description: baseSchemas.string({ max: 500, transform: true }).optional(),
    categoryId: baseSchemas.uuid,
    brand: baseSchemas.string({ max: 100, transform: true }).optional(),
    sku: z.string()
      .max(50, 'SKU too long')
      .regex(/^[A-Za-z0-9-_]+$/, 'SKU can only contain letters, numbers, hyphens, and underscores')
      .optional(),
    barcode: z.string()
      .regex(/^[0-9]{8,14}$/, 'Invalid barcode format')
      .optional(),
    price: baseSchemas.currency,
    cost: baseSchemas.currency.optional(),
    stockQuantity: z.number().min(0, 'Stock quantity cannot be negative').default(0),
    minStockLevel: z.number().min(0, 'Minimum stock level cannot be negative').default(0),
    maxStockLevel: z.number().min(0, 'Maximum stock level cannot be negative').optional(),
    isActive: z.boolean().default(true),
    weight: z.number().min(0, 'Weight cannot be negative').optional(),
    dimensions: z.object({
      length: z.number().min(0),
      width: z.number().min(0),
      height: z.number().min(0)
    }).optional(),
    tags: z.array(z.string().max(50)).optional(),
    images: z.array(baseSchemas.url).max(10, 'Maximum 10 images allowed').optional()
  }).refine(data => {
    if (data.maxStockLevel && data.maxStockLevel < data.minStockLevel) {
      return false
    }
    return true
  }, {
    message: 'Maximum stock level must be greater than minimum stock level',
    path: ['maxStockLevel']
  }),

  // Enhanced transaction schema
  transaction: z.object({
    clientId: baseSchemas.uuid.optional(),
    locationId: baseSchemas.uuid,
    staffId: baseSchemas.uuid,
    items: z.array(z.object({
      type: z.enum(['SERVICE', 'PRODUCT']),
      id: baseSchemas.uuid,
      quantity: z.number().min(1, 'Quantity must be at least 1').max(100, 'Quantity too large'),
      price: baseSchemas.currency,
      discount: baseSchemas.percentage.optional(),
      tax: baseSchemas.percentage.optional()
    })).min(1, 'At least one item is required'),
    paymentMethod: z.enum(['CASH', 'CARD', 'GIFT_CARD', 'BANK_TRANSFER', 'CHECK']),
    subtotal: baseSchemas.currency,
    tax: baseSchemas.currency,
    discount: baseSchemas.currency,
    total: baseSchemas.currency,
    notes: baseSchemas.string({ max: 500, transform: true }).optional(),
    receiptNumber: z.string().max(50).optional(),
    paymentReference: z.string().max(100).optional()
  }).refine(data => {
    // Validate that total equals subtotal + tax - discount
    const calculatedTotal = data.subtotal + data.tax - data.discount
    return Math.abs(data.total - calculatedTotal) < 0.01
  }, {
    message: 'Total amount does not match calculated total',
    path: ['total']
  }),

  // Enhanced staff schema
  staff: z.object({
    firstName: baseSchemas.name,
    lastName: baseSchemas.name,
    email: baseSchemas.email,
    phone: baseSchemas.phone,
    role: z.enum(['STAFF', 'MANAGER', 'ADMIN', 'SALES', 'RECEPTIONIST', 'LOCATION_MANAGER']),
    locationIds: z.array(baseSchemas.uuid).min(1, 'At least one location is required'),
    specialties: z.array(baseSchemas.uuid).optional(),
    isActive: z.boolean().default(true),
    hireDate: z.string().datetime(),
    emergencyContact: z.object({
      name: baseSchemas.name,
      phone: baseSchemas.phone,
      relationship: baseSchemas.string({ max: 50, transform: true })
    }),
    workSchedule: z.object({
      monday: z.object({ start: z.string(), end: z.string(), isWorking: z.boolean() }).optional(),
      tuesday: z.object({ start: z.string(), end: z.string(), isWorking: z.boolean() }).optional(),
      wednesday: z.object({ start: z.string(), end: z.string(), isWorking: z.boolean() }).optional(),
      thursday: z.object({ start: z.string(), end: z.string(), isWorking: z.boolean() }).optional(),
      friday: z.object({ start: z.string(), end: z.string(), isWorking: z.boolean() }).optional(),
      saturday: z.object({ start: z.string(), end: z.string(), isWorking: z.boolean() }).optional(),
      sunday: z.object({ start: z.string(), end: z.string(), isWorking: z.boolean() }).optional()
    }).optional(),
    commissionRate: baseSchemas.percentage.optional(),
    hourlyRate: baseSchemas.currency.optional()
  }),

  // Enhanced location schema
  location: z.object({
    name: baseSchemas.string({ min: 1, max: 100, transform: true }),
    address: baseSchemas.string({ min: 1, max: 255, transform: true }),
    city: baseSchemas.string({ min: 1, max: 100, transform: true }),
    state: baseSchemas.string({ min: 1, max: 100, transform: true }),
    zipCode: z.string()
      .min(1, 'ZIP code is required')
      .max(20, 'ZIP code too long')
      .regex(/^[A-Za-z0-9\s-]+$/, 'Invalid ZIP code format'),
    country: baseSchemas.string({ min: 1, max: 100, transform: true }),
    phone: baseSchemas.phone,
    email: baseSchemas.email.optional(),
    website: baseSchemas.url.optional(),
    timezone: z.string().min(1, 'Timezone is required'),
    isActive: z.boolean().default(true),
    businessHours: z.object({
      monday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      tuesday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      wednesday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      thursday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      friday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      saturday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      sunday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional()
    }).optional(),
    coordinates: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180)
    }).optional(),
    amenities: z.array(z.string().max(50)).optional(),
    parkingInfo: baseSchemas.string({ max: 200, transform: true }).optional()
  })
}

// Form validation schemas
export const formSchemas = {
  // Login form
  login: z.object({
    email: baseSchemas.email,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().default(false)
  }),

  // Registration form
  register: z.object({
    firstName: baseSchemas.name,
    lastName: baseSchemas.name,
    email: baseSchemas.email,
    password: baseSchemas.password,
    confirmPassword: z.string(),
    phone: baseSchemas.phone.optional(),
    agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms and conditions')
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  }),

  // Contact form
  contact: z.object({
    name: baseSchemas.name,
    email: baseSchemas.email,
    phone: baseSchemas.phone.optional(),
    subject: baseSchemas.string({ min: 1, max: 100, transform: true }),
    message: baseSchemas.string({ min: 10, max: 1000, transform: true }),
    preferredContact: z.enum(['email', 'phone']).default('email')
  }),

  // Booking form
  booking: z.object({
    serviceId: baseSchemas.uuid,
    staffId: baseSchemas.uuid.optional(),
    locationId: baseSchemas.uuid,
    date: z.string().datetime(),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
    notes: baseSchemas.string({ max: 500, transform: true }).optional(),
    clientInfo: z.object({
      firstName: baseSchemas.name,
      lastName: baseSchemas.name,
      email: baseSchemas.email,
      phone: baseSchemas.phone
    })
  }),

  // Settings form
  settings: z.object({
    businessName: baseSchemas.string({ min: 1, max: 100, transform: true }),
    businessEmail: baseSchemas.email,
    businessPhone: baseSchemas.phone,
    currency: z.string().length(3, 'Currency code must be 3 characters'),
    timezone: z.string().min(1, 'Timezone is required'),
    dateFormat: z.enum(['DD-MM-YYYY']).default('DD-MM-YYYY'),
    timeFormat: z.enum(['12h', '24h']),
    defaultBookingDuration: z.number().min(15).max(480).multipleOf(15),
    allowOnlineBooking: z.boolean().default(true),
    requireDepositForBooking: z.boolean().default(false),
    depositPercentage: baseSchemas.percentage.optional(),
    cancellationPolicy: baseSchemas.string({ max: 1000, transform: true }).optional(),
    privacyPolicy: baseSchemas.string({ max: 5000, transform: true }).optional(),
    termsOfService: baseSchemas.string({ max: 5000, transform: true }).optional()
  })
}

// API validation schemas
export const apiSchemas = {
  // Pagination
  pagination: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc')
  }),

  // Search
  search: z.object({
    query: baseSchemas.string({ min: 1, max: 100, transform: true }),
    filters: z.record(z.any()).optional(),
    facets: z.array(z.string()).optional()
  }),

  // Bulk operations
  bulkOperation: z.object({
    action: z.enum(['create', 'update', 'delete']),
    items: z.array(z.any()).min(1).max(100),
    options: z.record(z.any()).optional()
  })
}

// Export all schemas
export const validationSchemas = {
  base: baseSchemas,
  entity: entitySchemas,
  form: formSchemas,
  api: apiSchemas
}
