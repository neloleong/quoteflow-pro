import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const COMPANY_ID = process.env.COMPANY_ID || "11111111-1111-1111-1111-111111111111";
const CUSTOMER_PRICE_MODE = process.env.CUSTOMER_PRICE_MODE || "zero"; // zero | copy | markup
const CUSTOMER_PRICE_MARKUP = Number(process.env.CUSTOMER_PRICE_MARKUP || "1.3");
const CSV_FILE = process.env.CSV_FILE || path.join(__dirname, "gongbei_2026_combined_test_items.csv");
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
function parseCsv(text) { const rows=[]; let row=[], v="", q=false; for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1]; if(c==='"'){if(q&&n==='"'){v+='"';i++;}else q=!q;} else if(c===','&&!q){row.push(v);v="";} else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++; row.push(v); if(row.some(x=>x!==""))rows.push(row); row=[]; v="";} else v+=c;} if(v||row.length){row.push(v); rows.push(row);} const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,"")); return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""]))); }
function toNumber(x){const n=Number(String(x||"").replace(/,/g,""));return Number.isFinite(n)?n:0;}
function customerPrice(row){const c=toNumber(row.lab_price_rmb); if(CUSTOMER_PRICE_MODE==='copy')return c; if(CUSTOMER_PRICE_MODE==='markup')return Math.round(c*CUSTOMER_PRICE_MARKUP); return 0;}
async function main(){ const rows=parseCsv(fs.readFileSync(CSV_FILE,"utf8")); console.log(`Read ${rows.length} rows`); const payloads=rows.map(r=>({ company_id:COMPANY_ID, category_id:null, vendor_id:null, item_code:r.item_code, item_name_zh:r.item_name_zh, item_name_en:r.item_name_en||null, major_category:r.major_category||null, testing_object:r.testing_object||null, test_standard:r.test_standard||null, lab_price_rmb:toNumber(r.lab_price_rmb), customer_price_mop:customerPrice(r), currency_lab:"RMB", currency_customer:"MOP", turnaround_text:r.turnaround_text||null, is_accredited:r.is_accredited==='true', show_in_quotation:CUSTOMER_PRICE_MODE==='zero'?false:r.show_in_quotation==='true', is_active:r.is_active!=='false' })); for(let i=0;i<payloads.length;i+=500){ const batch=payloads.slice(i,i+500); const {error}=await supabase.from("test_items").upsert(batch,{onConflict:"company_id,item_code"}); if(error)throw error; console.log(`Imported ${Math.min(i+500,payloads.length)}/${payloads.length}`); } console.log("Done. Imported to test_items."); }
main().catch(e=>{console.error(e);process.exit(1);});
