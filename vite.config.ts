/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const publicKeys = ['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY']
  for (const name of publicKeys) {
    const key = env[name]?.trim()
    if (!key || /^sb_publishable_[\w-]+$/.test(key)) continue
    let role: unknown
    try {
      role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role
    } catch { /* Uma chave de navegador deve ser publishable ou JWT anon. */ }
    if (role !== 'anon') throw new Error(`Use somente a chave pública do Supabase em ${name}.`)
  }
  const publicNames = [...publicKeys, 'VITE_SUPABASE_URL']
  return {
    // Mesmo um segredo com prefixo VITE_ por engano fica fora do JavaScript.
    envPrefix: [],
    define: Object.fromEntries(publicNames.filter(name => env[name] !== undefined)
      .map(name => [`import.meta.env.${name}`, JSON.stringify(env[name])])),
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    },
  }
})
