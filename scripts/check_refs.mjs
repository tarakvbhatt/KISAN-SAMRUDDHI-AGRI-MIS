import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import WS from 'ws'
globalThis.WebSocket = WS

const env = Object.fromEntries(readFileSync('/app/.env','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim(); if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); return [l.slice(0,i).trim(), v]}))
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth:{persistSession:false} })

for (const t of ['villages','social_groups','seasons','project_years','income_sources','crops','panchayats','hamlets','farmers']) {
  const { count, error, status, statusText } = await supabase.from(t).select('*', { count:'exact', head:true })
  console.log(t.padEnd(20), 'cnt=', count, 'status=', status, statusText, error && JSON.stringify(error))
}
// sample
const { data: v } = await supabase.from('villages').select('*').limit(3)
console.log('sample villages:', v)
const { data: s } = await supabase.from('seasons').select('*')
console.log('seasons:', s)
const { data: sg } = await supabase.from('social_groups').select('*')
console.log('social_groups:', sg)
const { data: py } = await supabase.from('project_years').select('*')
console.log('project_years:', py)
const { data: isrc } = await supabase.from('income_sources').select('*')
console.log('income_sources:', isrc)
