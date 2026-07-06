import type { DataProvider } from './provider'
import { LocalProvider } from './local'
import { SupabaseProvider } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const usingSupabase = Boolean(url && anonKey)

export const db: DataProvider = usingSupabase
  ? new SupabaseProvider(url!, anonKey!)
  : new LocalProvider()
