/**
 * Permissions System
 *
 * This file defines the permission constants and role-based permission sets
 * for the application's role-based access control (RBAC) system.
 */

// Permission Categories
export const PERMISSION_CATEGORIES = {
  DASHBOARD: 'dashboard',
  APPOINTMENTS: 'appointments',
  CLIENTS: 'clients',
  SERVICES: 'services',
  STAFF: 'staff',
  INVENTORY: 'inventory',
  POS: 'pos',
  ACCOUNTING: 'accounting',
  HR: 'hr',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  CLIENT_PORTAL: 'client_portal',
  CHAT: 'chat',
};

// Permission Actions
export const PERMISSION_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  MANAGE: 'manage',
  APPROVE: 'approve',
  EXPORT: 'export',
  IMPORT: 'import',
  VIEW_OWN: 'view_own',
  EDIT_OWN: 'edit_own',
};

// Permission Constants
export const PERMISSIONS = {
  // Special permission for full access
  ALL: 'all',

  // Dashboard permissions
  VIEW_DASHBOARD: 'view_dashboard',

  // Appointment permissions
  VIEW_APPOINTMENTS: 'view_appointments',
  CREATE_APPOINTMENT: 'create_appointment',
  EDIT_APPOINTMENT: 'edit_appointment',
  DELETE_APPOINTMENT: 'delete_appointment',
  VIEW_OWN_APPOINTMENTS: 'view_own_appointments',
  EDIT_OWN_APPOINTMENTS: 'edit_own_appointments',

  // Client permissions
  VIEW_CLIENTS: 'view_clients',
  CREATE_CLIENT: 'create_client',
  EDIT_CLIENT: 'edit_client',
  DELETE_CLIENT: 'delete_client',
  VIEW_OWN_CLIENTS: 'view_own_clients',

  // Service permissions
  VIEW_SERVICES: 'view_services',
  CREATE_SERVICE: 'create_service',
  EDIT_SERVICE: 'edit_service',
  DELETE_SERVICE: 'delete_service',

  // Staff permissions
  VIEW_STAFF: 'view_staff',
  CREATE_STAFF: 'create_staff',
  EDIT_STAFF: 'edit_staff',
  DELETE_STAFF: 'delete_staff',
  VIEW_STAFF_SCHEDULE: 'view_staff_schedule',
  EDIT_STAFF_SCHEDULE: 'edit_staff_schedule',
  VIEW_OWN_SCHEDULE: 'view_own_schedule',
  EDIT_OWN_SCHEDULE: 'edit_own_schedule',

  // Inventory permissions
  VIEW_INVENTORY: 'view_inventory',
  CREATE_INVENTORY: 'create_inventory',
  EDIT_INVENTORY: 'edit_inventory',
  DELETE_INVENTORY: 'delete_inventory',

  // POS permissions
  VIEW_POS: 'view_pos',
  CREATE_SALE: 'create_sale',
  EDIT_SALE: 'edit_sale',
  DELETE_SALE: 'delete_sale',
  APPLY_DISCOUNT: 'apply_discount',
  ISSUE_REFUND: 'issue_refund',

  // Accounting permissions
  VIEW_ACCOUNTING: 'view_accounting',
  MANAGE_ACCOUNTING: 'manage_accounting',

  // HR permissions
  VIEW_HR: 'view_hr',
  MANAGE_HR: 'manage_hr',

  // Reports permissions
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  // Company Documents permissions
  VIEW_COMPANY_DOCUMENTS: 'view_company_documents',
  MANAGE_COMPANY_DOCUMENTS: 'manage_company_documents',

  // Settings permissions
  VIEW_SETTINGS: 'view_settings',
  EDIT_SETTINGS: 'edit_settings',
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_LOCATIONS: 'manage_locations',

  // Client Portal permissions
  VIEW_CLIENT_PORTAL: 'view_client_portal',
  MANAGE_CLIENT_PORTAL: 'manage_client_portal',

  // Chat permissions
  VIEW_CHAT: 'view_chat',
  SEND_MESSAGES: 'send_messages',
  CREATE_CHANNELS: 'create_channels',
  MANAGE_CHANNELS: 'manage_channels',
  MODERATE_CHAT: 'moderate_chat',
  VIEW_ALL_CHANNELS: 'view_all_channels',
  SEND_PRODUCT_REQUESTS: 'send_product_requests',
  SEND_HELP_REQUESTS: 'send_help_requests',

  // Loyalty Program permissions
  VIEW_LOYALTY: 'view_loyalty',
  MANAGE_LOYALTY: 'manage_loyalty',
  CREATE_REWARD: 'create_reward',
  EDIT_REWARD: 'edit_reward',
  DELETE_REWARD: 'delete_reward',
  MANAGE_LOYALTY_TIERS: 'manage_loyalty_tiers',
  ADJUST_LOYALTY_POINTS: 'adjust_loyalty_points',

  // Gift Card permissions
  VIEW_GIFT_CARDS: 'view_gift_cards',
  CREATE_GIFT_CARD: 'create_gift_card',
  EDIT_GIFT_CARD: 'edit_gift_card',
  DELETE_GIFT_CARD: 'delete_gift_card',
  REDEEM_GIFT_CARD: 'redeem_gift_card',
  REFUND_GIFT_CARD: 'refund_gift_card',
  MANAGE_GIFT_CARD_SETTINGS: 'manage_gift_card_settings',

  // Membership permissions
  VIEW_MEMBERSHIPS: 'view_memberships',
  CREATE_MEMBERSHIP: 'create_membership',
  EDIT_MEMBERSHIP: 'edit_membership',
  DELETE_MEMBERSHIP: 'delete_membership',
  CANCEL_MEMBERSHIP: 'cancel_membership',
  RENEW_MEMBERSHIP: 'renew_membership',
  MANAGE_MEMBERSHIP_TIERS: 'manage_membership_tiers',
  MANAGE_MEMBERSHIP_SETTINGS: 'manage_membership_settings',
};

// Role-based permission sets
export const ROLE_PERMISSIONS = {
  // Admin has all permissions (same as Super Admin)
  ADMIN: [PERMISSIONS.ALL],

  // Super Admin has all permissions
  SUPER_ADMIN: [PERMISSIONS.ALL],

  // Organization Admin has all permissions except some sensitive ones
  ORG_ADMIN: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_APPOINTMENTS, PERMISSIONS.CREATE_APPOINTMENT, PERMISSIONS.EDIT_APPOINTMENT, PERMISSIONS.DELETE_APPOINTMENT,
    PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.CREATE_CLIENT, PERMISSIONS.EDIT_CLIENT, PERMISSIONS.DELETE_CLIENT,
    PERMISSIONS.VIEW_SERVICES, PERMISSIONS.CREATE_SERVICE, PERMISSIONS.EDIT_SERVICE, PERMISSIONS.DELETE_SERVICE,
    PERMISSIONS.VIEW_STAFF, PERMISSIONS.CREATE_STAFF, PERMISSIONS.EDIT_STAFF, PERMISSIONS.DELETE_STAFF,
    PERMISSIONS.VIEW_STAFF_SCHEDULE, PERMISSIONS.EDIT_STAFF_SCHEDULE,
    PERMISSIONS.VIEW_INVENTORY, PERMISSIONS.CREATE_INVENTORY, PERMISSIONS.EDIT_INVENTORY, PERMISSIONS.DELETE_INVENTORY,
    PERMISSIONS.VIEW_POS, PERMISSIONS.CREATE_SALE, PERMISSIONS.EDIT_SALE, PERMISSIONS.DELETE_SALE, PERMISSIONS.APPLY_DISCOUNT, PERMISSIONS.ISSUE_REFUND,
    PERMISSIONS.VIEW_ACCOUNTING, PERMISSIONS.MANAGE_ACCOUNTING,
    PERMISSIONS.VIEW_HR, PERMISSIONS.MANAGE_HR,
    PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_COMPANY_DOCUMENTS, PERMISSIONS.MANAGE_COMPANY_DOCUMENTS,
    PERMISSIONS.VIEW_SETTINGS, PERMISSIONS.EDIT_SETTINGS, PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_ROLES, PERMISSIONS.MANAGE_LOCATIONS,
    PERMISSIONS.VIEW_CLIENT_PORTAL, PERMISSIONS.MANAGE_CLIENT_PORTAL,
    PERMISSIONS.VIEW_CHAT, PERMISSIONS.SEND_MESSAGES, PERMISSIONS.CREATE_CHANNELS, PERMISSIONS.MANAGE_CHANNELS, PERMISSIONS.MODERATE_CHAT, PERMISSIONS.VIEW_ALL_CHANNELS, PERMISSIONS.SEND_PRODUCT_REQUESTS, PERMISSIONS.SEND_HELP_REQUESTS,
    // Gift Card & Membership permissions
    PERMISSIONS.VIEW_GIFT_CARDS, PERMISSIONS.CREATE_GIFT_CARD, PERMISSIONS.EDIT_GIFT_CARD, PERMISSIONS.DELETE_GIFT_CARD,
    PERMISSIONS.REDEEM_GIFT_CARD, PERMISSIONS.REFUND_GIFT_CARD, PERMISSIONS.MANAGE_GIFT_CARD_SETTINGS,
    PERMISSIONS.VIEW_MEMBERSHIPS, PERMISSIONS.CREATE_MEMBERSHIP, PERMISSIONS.EDIT_MEMBERSHIP, PERMISSIONS.DELETE_MEMBERSHIP,
    PERMISSIONS.CANCEL_MEMBERSHIP, PERMISSIONS.RENEW_MEMBERSHIP, PERMISSIONS.MANAGE_MEMBERSHIP_TIERS, PERMISSIONS.MANAGE_MEMBERSHIP_SETTINGS,
  ],

  // Location Manager has permissions for their location (NO dashboard access - only Admins)
  LOCATION_MANAGER: [
    // REMOVED: PERMISSIONS.VIEW_DASHBOARD - Only Admins and Super Admins can access dashboard
    PERMISSIONS.VIEW_APPOINTMENTS, PERMISSIONS.CREATE_APPOINTMENT, PERMISSIONS.EDIT_APPOINTMENT, PERMISSIONS.DELETE_APPOINTMENT,
    PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.CREATE_CLIENT, PERMISSIONS.EDIT_CLIENT, PERMISSIONS.DELETE_CLIENT,
    PERMISSIONS.VIEW_SERVICES, PERMISSIONS.CREATE_SERVICE, PERMISSIONS.EDIT_SERVICE,
    PERMISSIONS.VIEW_STAFF, PERMISSIONS.CREATE_STAFF, PERMISSIONS.EDIT_STAFF,
    PERMISSIONS.VIEW_STAFF_SCHEDULE, PERMISSIONS.EDIT_STAFF_SCHEDULE,
    PERMISSIONS.VIEW_INVENTORY, PERMISSIONS.CREATE_INVENTORY, PERMISSIONS.EDIT_INVENTORY,
    PERMISSIONS.VIEW_POS, PERMISSIONS.CREATE_SALE, PERMISSIONS.EDIT_SALE, PERMISSIONS.APPLY_DISCOUNT,
    PERMISSIONS.VIEW_ACCOUNTING,
    PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_COMPANY_DOCUMENTS, PERMISSIONS.MANAGE_COMPANY_DOCUMENTS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_CHAT, PERMISSIONS.SEND_MESSAGES, PERMISSIONS.CREATE_CHANNELS, PERMISSIONS.MODERATE_CHAT, PERMISSIONS.SEND_PRODUCT_REQUESTS, PERMISSIONS.SEND_HELP_REQUESTS,
    // Gift Card & Membership permissions
    PERMISSIONS.VIEW_GIFT_CARDS, PERMISSIONS.CREATE_GIFT_CARD, PERMISSIONS.EDIT_GIFT_CARD,
    PERMISSIONS.REDEEM_GIFT_CARD, PERMISSIONS.REFUND_GIFT_CARD,
    PERMISSIONS.VIEW_MEMBERSHIPS, PERMISSIONS.CREATE_MEMBERSHIP, PERMISSIONS.EDIT_MEMBERSHIP,
    PERMISSIONS.CANCEL_MEMBERSHIP, PERMISSIONS.RENEW_MEMBERSHIP,
  ],

  // Receptionist has limited permissions (NO dashboard access - only Admins)
  RECEPTIONIST: [
    // REMOVED: PERMISSIONS.VIEW_DASHBOARD - Only Admins and Super Admins can access dashboard
    PERMISSIONS.VIEW_APPOINTMENTS, PERMISSIONS.CREATE_APPOINTMENT, PERMISSIONS.EDIT_APPOINTMENT,
    PERMISSIONS.VIEW_CLIENTS, PERMISSIONS.CREATE_CLIENT, PERMISSIONS.EDIT_CLIENT,
    PERMISSIONS.VIEW_SERVICES,
    PERMISSIONS.VIEW_STAFF, PERMISSIONS.VIEW_STAFF_SCHEDULE,
    PERMISSIONS.VIEW_INVENTORY, PERMISSIONS.CREATE_INVENTORY,
    PERMISSIONS.VIEW_POS, PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_CHAT, PERMISSIONS.SEND_MESSAGES, PERMISSIONS.SEND_PRODUCT_REQUESTS, PERMISSIONS.SEND_HELP_REQUESTS,
    // Gift Card & Membership permissions
    PERMISSIONS.VIEW_GIFT_CARDS, PERMISSIONS.CREATE_GIFT_CARD, PERMISSIONS.REDEEM_GIFT_CARD,
    PERMISSIONS.VIEW_MEMBERSHIPS, PERMISSIONS.CREATE_MEMBERSHIP,
  ],

  // Staff has very limited permissions (NO dashboard access - only Admins)
  STAFF: [
    // REMOVED: PERMISSIONS.VIEW_DASHBOARD - Only Admins and Super Admins can access dashboard
    PERMISSIONS.VIEW_OWN_APPOINTMENTS, PERMISSIONS.EDIT_OWN_APPOINTMENTS,
    PERMISSIONS.VIEW_OWN_CLIENTS,
    PERMISSIONS.VIEW_SERVICES,
    PERMISSIONS.VIEW_OWN_SCHEDULE,
    PERMISSIONS.VIEW_POS, PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_CHAT, PERMISSIONS.SEND_MESSAGES, PERMISSIONS.SEND_PRODUCT_REQUESTS, PERMISSIONS.SEND_HELP_REQUESTS,
  ],
};

// Navigation permissions - which permissions are required to see each navigation item
export const NAVIGATION_PERMISSIONS = {
  '/dashboard': [PERMISSIONS.VIEW_DASHBOARD],
  '/dashboard/appointments': [PERMISSIONS.VIEW_APPOINTMENTS, PERMISSIONS.VIEW_OWN_APPOINTMENTS],
  '/dashboard/clients': [PERMISSIONS.VIEW_CLIENTS],
  '/dashboard/services': [PERMISSIONS.VIEW_SERVICES],
  '/dashboard/staff': [PERMISSIONS.VIEW_STAFF],
  '/dashboard/inventory': [PERMISSIONS.VIEW_INVENTORY],
  '/dashboard/orders': [PERMISSIONS.VIEW_ACCOUNTING], // Orders use accounting permissions
  '/dashboard/pos': [PERMISSIONS.VIEW_POS],
  '/dashboard/gift-cards-memberships': [PERMISSIONS.VIEW_GIFT_CARDS, PERMISSIONS.VIEW_MEMBERSHIPS],
  '/dashboard/accounting': [PERMISSIONS.VIEW_ACCOUNTING],
  '/dashboard/hr': [PERMISSIONS.VIEW_HR],
  '/dashboard/reports': [PERMISSIONS.VIEW_REPORTS],
  '/dashboard/settings': [PERMISSIONS.VIEW_SETTINGS],
  '/client-portal': [PERMISSIONS.VIEW_CLIENT_PORTAL],
};

// Helper function to check if a user has a specific permission
export function hasPermission(userPermissions: string[], permission: string): boolean {
  // If user has ALL permission, they have access to everything
  if (userPermissions.includes(PERMISSIONS.ALL)) {
    return true;
  }

  // Check if the user has the specific permission
  return userPermissions.includes(permission);
}

// Helper function to check if a user has any of the permissions
export function hasAnyPermission(userPermissions: string[], permissions: string[]): boolean {
  // If user has ALL permission, they have access to everything
  if (userPermissions.includes(PERMISSIONS.ALL)) {
    return true;
  }

  // Check if the user has any of the permissions
  return permissions.some(permission => userPermissions.includes(permission));
}
