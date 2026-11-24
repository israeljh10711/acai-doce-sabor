import { createAccountHandler } from './handler.ts'

function key(name: string, fallback: string): string {
  const keys = JSON.parse(Deno.env.get(name) || '{}')
  return keys.default || Deno.env.get(fallback) || ''
}

Deno.serve(createAccountHandler(() => ({
  url: Deno.env.get('SUPABASE_URL') || '',
  serviceKey: key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
  publicKey: key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
  secret: Deno.env.get('ACCOUNT_SECRET') || '',
  sellerEmail: Deno.env.get('SELLER_EMAIL') || '',
})))
