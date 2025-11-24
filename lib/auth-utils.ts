import crypto from 'crypto'
import bcrypt from 'bcryptjs'

/**
 * Generate a secure temporary password for staff members
 * Format: 3 uppercase letters + 3 numbers + 2 special characters
 * Example: ABC123!@
 */
export function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const special = '!@#$%&*'
  
  let password = ''
  
  // Add 3 uppercase letters
  for (let i = 0; i < 3; i++) {
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
  }
  
  // Add 3 numbers
  for (let i = 0; i < 3; i++) {
    password += numbers[Math.floor(Math.random() * numbers.length)]
  }
  
  // Add 2 special characters
  for (let i = 0; i < 2; i++) {
    password += special[Math.floor(Math.random() * special.length)]
  }
  
  return password
}

/**
 * Generate a username from staff member's name and employee number
 * Format: firstname.lastname or firstname.lastname.empno if duplicate
 */
export function generateUsername(name: string, employeeNumber?: string): string {
  const nameParts = name.toLowerCase().split(' ')
  let username = nameParts.join('.')
  
  // Remove any non-alphanumeric characters except dots
  username = username.replace(/[^a-z0-9.]/g, '')
  
  // If employee number is provided, append it for uniqueness
  if (employeeNumber) {
    username += `.${employeeNumber}`
  }
  
  return username
}

/**
 * Hash password using bcrypt
 * Uses bcryptjs for secure password hashing with salt rounds
 */
export function hashPassword(password: string): string {
  // Use bcrypt with 10 salt rounds for secure hashing
  const saltRounds = 10
  return bcrypt.hashSync(password, saltRounds)
}

/**
 * Compare password with hash using bcrypt
 */
export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Map staff role to user role for authentication
 */
export function mapStaffRoleToUserRole(staffRole: string): string {
  const roleMapping: { [key: string]: string } = {
    'manager': 'MANAGER',
    'assistant_manager': 'MANAGER',
    'senior_stylist': 'STAFF',
    'stylist': 'STAFF',
    'colorist': 'STAFF',
    'nail_technician': 'STAFF',
    'esthetician': 'STAFF',
    'barber': 'STAFF',
    'receptionist': 'STAFF',
    'trainee': 'STAFF'
  }
  
  return roleMapping[staffRole.toLowerCase()] || 'STAFF'
}
