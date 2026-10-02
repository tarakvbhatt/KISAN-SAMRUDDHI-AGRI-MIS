import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import WS from 'ws'
globalThis.WebSocket = WS
const env = Object.fromEntries(readFileSync('/app/.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim(); if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); return [l.slice(0,i).trim(), v]}))
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth:{persistSession:false} })

const r = await sb.from('districts').insert({ name: 'TestDist', state_name: 'Gujarat' }).select()
console.log('insert:', JSON.stringify(r))
const s = await sb.from('districts').select('*')
console.log('select:', JSON.stringify(s))
