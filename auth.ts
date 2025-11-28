import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { auditAuth } from "@/lib/security/audit-log"
import { validateAndSanitizeInput, userLoginSchema } from "@/lib/security/validation"

// Enhanced password comparison using bcrypt
const comparePasswords = async (plainPassword: string, hashedPassword: string) => {
  try {
    // Use bcrypt for proper password comparison
    return await bcrypt.compare(plainPassword, hashedPassword)
  } catch (error) {
    console.error("Password comparison error:", error)
    return false
  }
}

// Get client IP from request
function getClientIP(request: any): string {
  const forwarded = request?.headers?.['x-forwarded-for']
  const realIP = request?.headers?.['x-real-ip']

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return realIP || 'unknown'
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(error: Error) {
      console.error('NextAuth Error:', error)
    },
    warn(code: string) {
      console.warn('NextAuth Warning:', code)
    },
    debug(code: string, metadata: any) {
      if (process.env.NODE_ENV === 'development') {
        console.log('NextAuth Debug:', code, metadata)
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Validate and sanitize input
          const validation = validateAndSanitizeInput(userLoginSchema, {
            email: credentials.email,
            password: credentials.password,
          })

          if (!validation.success) {
            console.warn('Invalid login input:', validation.errors)
            return null
          }

          const { email, password } = validation.data

          // Use Prisma to find user with staff profile and locations
          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              staffProfile: {
                include: {
                  locations: {
                    include: {
                      location: true
                    }
                  }
                }
              }
            }
          })

          if (!user || !user.isActive) {
            // Audit failed login attempt
            await auditAuth.loginFailed(
              email,
              user ? 'Account inactive' : 'User not found'
            )
            return null
          }

          const passwordMatch = await comparePasswords(password, user.password)

          if (!passwordMatch) {
            // Audit failed login attempt
            await auditAuth.loginFailed(email, 'Invalid password')
            return null
          }

          const normalizedRole = (user.role || 'STAFF').toUpperCase()

          // Get user locations from staff profile
          let locationIds: string[] = []
          if (normalizedRole === "ADMIN") {
            locationIds = ["all"]
          } else if (normalizedRole === "SALES") {
            locationIds = ["online"]
          } else if (user.staffProfile?.locations) {
            locationIds = user.staffProfile.locations
              .filter(sl => sl.isActive)
              .map(sl => sl.location.id)
          }

          // Audit successful login
          await auditAuth.loginSuccess(user.id, user.email, user.role)

          return {
            id: user.id,
            name: user.staffProfile?.name || user.email.split('@')[0],
            email: user.email,
            role: normalizedRole,
            locations: locationIds.length > 0
              ? locationIds
              : (normalizedRole === "SALES" ? ["online"] : []),
          }
        } catch (error) {
          console.error("Auth error:", error)
          // Audit authentication error
          if (credentials?.email && typeof credentials.email === 'string') {
            await auditAuth.loginFailed(
              credentials.email,
              'Authentication system error'
            )
          }
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.id = user.id
          token.role = user.role
          token.locations = user.locations
        }
        return token
      } catch (error) {
        console.error('JWT callback error:', error)
        return token
      }
    },
    async session({ session, token }) {
      try {
        if (token) {
          session.user.id = token.id as string
          session.user.role = token.role as string
          session.user.locations = token.locations as string[]
        }
        return session
      } catch (error) {
        console.error('Session callback error:', error)
        return session
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
  },
})