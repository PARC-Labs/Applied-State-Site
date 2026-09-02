import { NextResponse, type NextRequest } from 'next/server'
import { isMemberEmail } from '@/lib/membership'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

function siteUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL('/signin?error=not-configured', request.url), 303)
  }

  const formData = await request.formData()
  const rawEmail = formData.get('email')
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''

  if (!email || email.length > 254) {
    return NextResponse.redirect(new URL('/signin?error=invalid-email', request.url), 303)
  }

  if (isMemberEmail(email)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${siteUrl(request)}/auth/confirm`,
      },
    })

    if (error) {
      console.error('Magic-link request rejected:', error.code ?? error.message)
    }
  }

  // Deliberately return the same response for unknown, non-member and valid
  // emails so the membership roster cannot be enumerated through this route.
  return NextResponse.redirect(new URL('/signin?sent=1', request.url), 303)
}
