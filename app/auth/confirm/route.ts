import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = '/members'
  redirectTo.search = ''

  if (!isSupabaseConfigured()) {
    redirectTo.pathname = '/signin'
    redirectTo.searchParams.set('error', 'not-configured')
    return NextResponse.redirect(redirectTo)
  }

  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (!error) {
      return NextResponse.redirect(redirectTo)
    }
  }

  redirectTo.pathname = '/signin'
  redirectTo.searchParams.set('error', 'link')
  return NextResponse.redirect(redirectTo)
}
