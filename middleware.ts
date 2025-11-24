import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Security headers configuration
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
}

// Add security headers to response
function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}

// Check for suspicious patterns
function detectSuspiciousActivity(req: NextRequest): boolean {
  const { pathname, searchParams } = req.nextUrl
  const userAgent = req.headers.get('user-agent') || ''

  // Check for common attack patterns
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript injection
    /data:text\/html/i,  // Data URI XSS
  ]

  // Check pathname and search params
  const fullUrl = pathname + searchParams.toString()
  if (suspiciousPatterns.some(pattern => pattern.test(fullUrl))) {
    return true
  }

  // Check for bot-like behavior (but allow legitimate crawlers)
  const maliciousBotPatterns = [
    /curl|wget|python-requests|php/i,
    /nikto|sqlmap|nmap|masscan/i,
  ]

  if (maliciousBotPatterns.some(pattern => pattern.test(userAgent))) {
    return true
  }

  return false
}

// Simplified middleware - only handles security headers
// Authentication is handled by NextAuth in the auth.ts file
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for suspicious activity
  if (detectSuspiciousActivity(request)) {
    console.warn(`Suspicious activity detected: ${pathname}`)
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Continue with the request and add security headers
  const response = NextResponse.next()
  return addSecurityHeaders(response)
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)" ],
}
