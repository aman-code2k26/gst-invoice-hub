"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, FileText, Users, Settings, Plus, Download,
  Send, CheckCircle2, Clock3, AlertTriangle, QrCode, Trash2, X
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type Business = { id:string; name:string; ownerName?:string; email?:string; phone?:string; address?:string; pan?:string; gstin?:string; state?:string; upiId?:string };
type Client = { id:string; businessId:string; name:string; email?:string; phone?:string; address?:string; gstin?:string; state?:string };
type Item = { description:string; quantity:number; rate:number; gstRate:number };
type Invoice = { id:string; invoiceNumber:string; client:Client; total:number; subtotal:number; discount:number; cgst:number; sgst:number; igst:number; status:string; dueDate:string; issueDate:string; items:Item[]; upiLink?:string|null };

async function api(path:string, options?:RequestInit) {
  const r = await fetch(`${API}${path}`, { ...options, headers:{ "Content-Type":"application/json", ...(options?.headers || {}) }});
  if (!r.ok) throw new Error((await r.json().catch(()=>({}))).error || "Request failed");
  if (r.status === 204) return null;
  return r.json();
}

function money(n:number) {
  return new Intl.NumberFormat("en-IN", { style:"currency", currency:"INR", maximumFractionDigits:2 }).format(n || 0);
}

const emptyItem = ():Item => ({ description:"", quantity:1, rate:0, gstRate:18 });

export default function Home() {
  const [tab, setTab] = useState("dashboard");
  const [business, setBusiness] = useState<Business|null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<any>({});
  const [showClient, setShowClient] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const b = await api("/business");
      setBusiness(b);
      const [c, i, s] = await Promise.all([
        api(`/clients?businessId=${b.id}`),
        api(`/invoices?businessId=${b.id}`),
        api(`/stats?businessId=${b.id}`)
      ]);
      setClients(c); setInvoices(i); setStats(s);
    } catch(e:any) { setMessage(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function downloadPDF(id:string) {
    const r = await fetch(`${API}/invoices/${id}/pdf`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="invoice.pdf"; a.click(); URL.revokeObjectURL(url);
  }

  async function changeStatus(id:string, status:string) {
    await api(`/invoices/${id}/status`, { method:"PATCH", body:JSON.stringify({status}) });
    load();
  }

  async function remind(id:string) {
    try {
      const r = await api(`/invoices/${id}/reminder`, {method:"POST", body:"{}"});
      setMessage(r.sent ? "Reminder email sent." : r.message);
    } catch(e:any) { setMessage(e.message); }
  }

  if (loading || !business) return <div className="min-h-screen grid place-items-center"><div className="text-center"><div className="text-3xl font-black">InvoiceHub</div><p className="text-slate-500 mt-2">Loading workspace…</p></div></div>;

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r bg-white p-5 lg:block">
        <div className="flex items-center gap-2 text-xl font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white">₹</span> InvoiceHub</div>
        <p className="mt-2 text-xs text-slate-400">GST invoicing for freelancers</p>
        <nav className="mt-8 space-y-2">
          {[
            ["dashboard","Dashboard",LayoutDashboard],
            ["invoices","Invoices",FileText],
            ["clients","Clients",Users],
            ["settings","Settings",Settings]
          ].map(([key,label,Icon]:any) => (
            <button key={key} onClick={()=>setTab(key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold ${tab===key ? "bg-indigo-50 text-indigo-700":"text-slate-600 hover:bg-slate-50"}`}>
              <Icon size={18}/>{label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-slate-900 p-4 text-white">
          <p className="text-sm font-bold">Hackathon Mode</p>
          <p className="mt-1 text-xs text-slate-300">WEB-06 · Micro-SaaS GST Hub</p>
        </div>
      </aside>

      <main className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex items-center justify-between">
            <div><h1 className="text-2xl font-black capitalize">{tab}</h1><p className="text-sm text-slate-500">{business.name}</p></div>
            <button className="btn-primary flex items-center gap-2" onClick={()=>setShowInvoice(true)}><Plus size={18}/> New invoice</button>
          </div>
        </header>

        <div className="p-4 md:p-8">
          {message && <div className="mb-5 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800"><span>{message}</span><button onClick={()=>setMessage("")}><X size={16}/></button></div>}

          {tab==="dashboard" && <Dashboard stats={stats} invoices={invoices} downloadPDF={downloadPDF} changeStatus={changeStatus} remind={remind}/>}
          {tab==="invoices" && <InvoiceList invoices={invoices} downloadPDF={downloadPDF} changeStatus={changeStatus} remind={remind}/>}
          {tab==="clients" && <ClientList clients={clients} business={business} reload={load} showClient={showClient} setShowClient={setShowClient}/>}
          {tab==="settings" && <SettingsPanel business={business} setBusiness={setBusiness}/>}
        </div>
      </main>

      {showClient && <ClientModal business={business} close={()=>setShowClient(false)} done={()=>{setShowClient(false);load();}}/>}
      {showInvoice && <InvoiceModal business={business} clients={clients} close={()=>setShowInvoice(false)} done={()=>{setShowInvoice(false);load();}}/>}
    </div>
  );
}

function Dashboard({stats,invoices,downloadPDF,changeStatus,remind}:any) {
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Stat title="Total invoiced" value={money(stats.total)} icon={<FileText/>}/>
      <Stat title="Paid" value={money(stats.paid)} icon={<CheckCircle2/>}/>
      <Stat title="Outstanding" value={money(stats.outstanding)} icon={<Clock3/>}/>
      <Stat title="Overdue" value={money(stats.overdue)} icon={<AlertTriangle/>}/>
    </div>
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b p-5"><div><h2 className="font-black">Recent invoices</h2><p className="text-sm text-slate-500">Track your latest client billing</p></div></div>
      <InvoiceTable invoices={invoices.slice(0,6)} downloadPDF={downloadPDF} changeStatus={changeStatus} remind={remind}/>
    </div>
  </div>
}

function Stat({title,value,icon}:any) {
  return <div className="card p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{title}</p><span className="rounded-xl bg-indigo-50 p-2 text-indigo-600">{icon}</span></div><p className="mt-4 text-2xl font-black">{value}</p></div>
}

function statusStyle(s:string) {
  if(s==="PAID") return "bg-emerald-50 text-emerald-700";
  if(s==="OVERDUE") return "bg-red-50 text-red-700";
  if(s==="SENT" || s==="VIEWED") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function InvoiceTable({invoices,downloadPDF,changeStatus,remind}:any) {
  if(!invoices.length) return <div className="p-10 text-center text-slate-500">No invoices yet. Create your first invoice.</div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-4">Invoice</th><th>Client</th><th>Due</th><th>Status</th><th>Amount</th><th className="pr-4">Actions</th></tr></thead><tbody>{invoices.map((i:Invoice)=><tr className="border-t" key={i.id}><td className="p-4 font-bold">{i.invoiceNumber}</td><td>{i.client.name}</td><td>{new Date(i.dueDate).toLocaleDateString("en-IN")}</td><td><span className={`badge ${statusStyle(i.status)}`}>{i.status}</span></td><td className="font-bold">{money(i.total)}</td><td className="pr-4"><div className="flex gap-2"><button title="Download PDF" onClick={()=>downloadPDF(i.id)} className="rounded-lg bg-slate-100 p-2"><Download size={15}/></button>{i.status!=="PAID"&&<button title="Mark paid" onClick={()=>changeStatus(i.id,"PAID")} className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><CheckCircle2 size={15}/></button>}<button title="Reminder" onClick={()=>remind(i.id)} className="rounded-lg bg-amber-50 p-2 text-amber-700"><Send size={15}/></button></div></td></tr>)}</tbody></table></div>
}

function InvoiceList(props:any) {
  return <div className="card overflow-hidden"><div className="border-b p-5"><h2 className="font-black">All invoices</h2></div><InvoiceTable {...props}/></div>
}

function ClientList({clients,business,reload,setShowClient}:any) {
  return <div className="space-y-5"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Client address book</h2><p className="text-sm text-slate-500">Keep client billing details ready.</p></div><button className="btn-primary flex gap-2 items-center" onClick={()=>setShowClient(true)}><Plus size={18}/> Add client</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{clients.map((c:Client)=><div className="card p-5" key={c.id}><div className="flex justify-between"><div><h3 className="font-black">{c.name}</h3><p className="text-sm text-slate-500">{c.email || "No email"}</p></div><Users className="text-indigo-500"/></div><div className="mt-4 space-y-1 text-sm text-slate-600"><p>{c.phone || "—"}</p><p>{c.address || "Address not added"}</p><p>GSTIN: {c.gstin || "—"}</p></div></div>)}</div></div>
}

function ClientModal({business,close,done}:any) {
  const [form,setForm]=useState({businessId:business.id,name:"",email:"",phone:"",address:"",gstin:"",state:business.state||""});
  const [saving,setSaving]=useState(false);
  async function save(){setSaving(true);try{await api("/clients",{method:"POST",body:JSON.stringify(form)});done()}catch(e:any){alert(e.message)}finally{setSaving(false)}}
  return <Modal title="Add client" close={close}><div className="grid gap-4 md:grid-cols-2">{Object.entries(form).filter(([k])=>k!=="businessId").map(([k,v])=><label className={k==="address"?"md:col-span-2":""} key={k}><span className="mb-1 block text-sm font-semibold capitalize">{k}</span><input className="input" value={String(v)} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div><div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={close}>Cancel</button><button className="btn-primary" onClick={save}>{saving?"Saving…":"Save client"}</button></div></Modal>
}

function InvoiceModal({business,clients,close,done}:any) {
  const [clientId,setClientId]=useState(clients[0]?.id||"");
  const [dueDate,setDueDate]=useState(new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  const [taxMode,setTaxMode]=useState("INTRA_STATE");
  const [discount,setDiscount]=useState(0);
  const [notes,setNotes]=useState("");
  const [items,setItems]=useState<Item[]>([emptyItem()]);
  const [saving,setSaving]=useState(false);
  const subtotal=items.reduce((s,i)=>s+i.quantity*i.rate,0);
  const taxable=Math.max(0,subtotal-discount);
  const tax=items.reduce((s,i)=>s+(i.quantity*i.rate/Math.max(subtotal,1))*taxable*(i.gstRate/100),0);
  const total=taxable+tax;
  function update(idx:number,key:keyof Item,val:any){setItems(items.map((x,i)=>i===idx?{...x,[key]:key==="description"?val:Number(val)}:x))}
  async function save(){if(!clientId)return alert("Add a client first.");setSaving(true);try{await api("/invoices",{method:"POST",body:JSON.stringify({businessId:business.id,clientId,dueDate,taxMode,discount:Number(discount),notes,items})});done()}catch(e:any){alert(e.message)}finally{setSaving(false)}}
  return <Modal title="Create invoice" close={close} wide><div className="grid gap-4 md:grid-cols-4"><label><span className="mb-1 block text-sm font-semibold">Client</span><select className="input" value={clientId} onChange={e=>setClientId(e.target.value)}>{clients.map((c:Client)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span className="mb-1 block text-sm font-semibold">Due date</span><input type="date" className="input" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label><span className="mb-1 block text-sm font-semibold">Tax mode</span><select className="input" value={taxMode} onChange={e=>setTaxMode(e.target.value)}><option value="INTRA_STATE">CGST + SGST</option><option value="INTER_STATE">IGST</option></select></label><label><span className="mb-1 block text-sm font-semibold">Discount</span><input type="number" className="input" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label></div>
  <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[700px]"><thead className="text-left text-xs uppercase text-slate-400"><tr><th>Description</th><th>Qty</th><th>Rate</th><th>GST %</th><th>Amount</th><th></th></tr></thead><tbody>{items.map((item,idx)=><tr key={idx} className="border-b"><td className="py-3 pr-2"><input className="input" placeholder="Web design / development" value={item.description} onChange={e=>update(idx,"description",e.target.value)}/></td><td className="p-2"><input type="number" className="input" value={item.quantity} onChange={e=>update(idx,"quantity",e.target.value)}/></td><td className="p-2"><input type="number" className="input" value={item.rate} onChange={e=>update(idx,"rate",e.target.value)}/></td><td className="p-2"><select className="input" value={item.gstRate} onChange={e=>update(idx,"gstRate",e.target.value)}><option>0</option><option>5</option><option>12</option><option>18</option><option>28</option></select></td><td className="p-2 font-bold">{money(item.quantity*item.rate)}</td><td><button className="rounded-lg p-2 text-red-500" onClick={()=>setItems(items.filter((_,i)=>i!==idx))}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
  <button className="btn-secondary mt-4 flex items-center gap-2" onClick={()=>setItems([...items,emptyItem()])}><Plus size={16}/> Add line item</button>
  <div className="mt-5 grid gap-4 md:grid-cols-2"><textarea className="input min-h-28" placeholder="Payment terms / notes" value={notes} onChange={e=>setNotes(e.target.value)}/><div className="rounded-2xl bg-slate-50 p-5"><div className="flex justify-between"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="mt-2 flex justify-between"><span>Discount</span><b>- {money(discount)}</b></div><div className="mt-2 flex justify-between"><span>GST</span><b>{money(tax)}</b></div><div className="mt-4 border-t pt-4 flex justify-between text-xl"><b>Total</b><b>{money(total)}</b></div></div></div>
  <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={close}>Cancel</button><button className="btn-primary" onClick={save}>{saving?"Creating…":"Create invoice"}</button></div></Modal>
}

function SettingsPanel({business,setBusiness}:any) {
  const [form,setForm]=useState(business); const [saving,setSaving]=useState(false);
  async function save(){setSaving(true);try{const b=await api(`/business/${business.id}`,{method:"PUT",body:JSON.stringify(form)});setBusiness(b);alert("Business profile saved.")}catch(e:any){alert(e.message)}finally{setSaving(false)}}
  const fields=["name","ownerName","email","phone","address","pan","gstin","state","upiId"];
  return <div className="card max-w-3xl p-6"><h2 className="text-xl font-black">Business profile</h2><p className="mt-1 text-sm text-slate-500">These details appear on invoices and UPI payment links.</p><div className="mt-6 grid gap-4 md:grid-cols-2">{fields.map(k=><label className={k==="address"?"md:col-span-2":""} key={k}><span className="mb-1 block text-sm font-semibold">{k==="upiId"?"UPI ID":k}</span><input className="input" value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div><button className="btn-primary mt-5" onClick={save}>{saving?"Saving…":"Save changes"}</button></div>
}

function Modal({title,close,children,wide=false}:any) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-6 ${wide?"max-w-5xl":"max-w-xl"}`}><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">{title}</h2><button onClick={close} className="rounded-xl bg-slate-100 p-2"><X size={18}/></button></div>{children}</div></div>
}
