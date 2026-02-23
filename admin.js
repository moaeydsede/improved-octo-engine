
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc,
  doc, getDoc, setDoc, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  "apiKey": "AIzaSyD33DgOX1pygN5YtnwDS6i2qL9Npo5nQGk",
  "authDomain": "joodkids-cc621.firebaseapp.com",
  "projectId": "joodkids-cc621",
  "storageBucket": "joodkids-cc621.appspot.com",
  "messagingSenderId": "912175230101",
  "appId": "1:912175230101:web:b4f18fce627d430d4aff9c"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_UIDS = ["RjiStoe955T1Q8icE2RUYw9eItL2","dZS7jUaB43aCL5Km3zr5V4LZuMr1"];
const CLOUDINARY_CLOUD = "dthtzvypx";

const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  products: [],
  filtered: [],
  editing: null,
  company: null
};

function toast(msg) {
  const wrap = $("toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; }, 2600);
  setTimeout(()=> el.remove(), 3200);
}

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("ar-EG") + " ج";
}

function normalize(s) {
  return (s||"").toString().trim().toLowerCase();
}

function computeCategoryFromModel(model) {
  const m = String(model||"").replace(/\D/g,"");
  if (!m) return "";
  const num = Number(m);
  if (Number.isNaN(num)) return "";
  return num < 1000 ? m.slice(0,1) : m.slice(0,2);
}

function escapeHtml(s){
  return (s||"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

function setupTheme() {
  const saved = localStorage.getItem("jk_theme");
  if (saved === "light") document.documentElement.setAttribute("data-theme","light");
  $("btnTheme").addEventListener("click", ()=> {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("jk_theme", next);
  });
}

function setAuthUI() {
  const isAdmin = state.user && ADMIN_UIDS.includes(state.user.uid);
  $("adminState").textContent = isAdmin ? "أدمن" : "غير مسجل";
  $("btnAuth").textContent = state.user ? "تسجيل الخروج" : "تسجيل الدخول";
  const enable = isAdmin;
  for (const id of ["btnNew","btnCompany","btnExport","importFile","btnOrders","btnNuke"]) {
    const el = $(id);
    if (!el) continue;
    if (id === "importFile") {
      el.disabled = !enable;
    } else {
      el.disabled = !enable;
      el.style.opacity = enable ? "1" : ".6";
      el.style.pointerEvents = enable ? "auto" : "none";
    }
  }
}

async function authToggle() {
  if (state.user) {
    await signOut(auth);
    return;
  }
  openModal("authModal");
}

async function googleLogin() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    closeModal("authModal");
  } catch (e) {
    console.error(e);
    toast("تعذر تسجيل الدخول بجوجل");
  }
}

async function emailLogin() {
  const email = $("authEmail").value.trim();
  const pass = $("authPass").value;
  if (!email || !pass) { toast("اكتب البريد وكلمة المرور"); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    closeModal("authModal");
  } catch (e) {
    console.error(e);
    toast("تعذر تسجيل الدخول بالبريد/كلمة المرور");
  }
}

async function loadCompany() {
  try {
    const snap = await getDoc(doc(db, "company", "main"));
    state.company = snap.exists() ? snap.data() : {};
  } catch {
    state.company = {};
  }
}

async function saveCompany() {
  const data = {
    name: $("coName").value.trim(),
    whatsapp: $("coWhats").value.trim(),
    facebook: $("coFb").value.trim(),
    instagram: $("coIg").value.trim(),
    telegram: $("coTg").value.trim(),
    factoryMap: $("coFactoryMap").value.trim(),
    shopMap: $("coShopMap").value.trim(),
    line: $("coLine").value.trim(),
    cloudinaryPreset: $("coPreset").value.trim(),
    cloudinaryFolder: $("coFolder").value.trim() || "Joodkids",
    updatedAt: serverTimestamp()
  };
  try {
    await setDoc(doc(db, "company", "main"), data, { merge:true });
    state.company = { ...(state.company||{}), ...data };
    toast("تم الحفظ");
    closeModal("companyModal");
  } catch (e) {
    console.error(e);
    toast("تعذر الحفظ");
  }
}

function openModal(id) { $(id).classList.add("open"); }
function closeModal(id) { $(id).classList.remove("open"); }

function setupModals() {
  $("homeBtn").addEventListener("click", ()=> window.location.href="./index.html");
  $("btnAuth").addEventListener("click", authToggle);

  // Auth modal
  $("btnGoogleLogin").addEventListener("click", googleLogin);
  $("btnEmailLogin").addEventListener("click", emailLogin);
  $("closeAuth").addEventListener("click", ()=> closeModal("authModal"));
  $("authModal").addEventListener("click", (e)=>{ if (e.target.id==="authModal") closeModal("authModal"); });


  $("btnNew").addEventListener("click", ()=> openProduct(null));
  $("closeProduct").addEventListener("click", ()=> closeModal("productModal"));
  $("productModal").addEventListener("click", (e)=>{ if (e.target.id==="productModal") closeModal("productModal"); });

  $("btnCompany").addEventListener("click", async ()=> {
    await loadCompany();
    $("coName").value = state.company?.name || "JoodKids";
    $("coWhats").value = state.company?.whatsapp || "";
    $("coFb").value = state.company?.facebook || "";
    $("coIg").value = state.company?.instagram || "";
    $("coTg").value = state.company?.telegram || "";
    $("coFactoryMap").value = state.company?.factoryMap || "";
    $("coShopMap").value = state.company?.shopMap || "";
    $("coLine").value = state.company?.line || "";
    $("coPreset").value = state.company?.cloudinaryPreset || "";
    $("coFolder").value = state.company?.cloudinaryFolder || "Joodkids";
    openModal("companyModal");
  });
  $("closeCompany").addEventListener("click", ()=> closeModal("companyModal"));
  $("companyModal").addEventListener("click", (e)=>{ if (e.target.id==="companyModal") closeModal("companyModal"); });
  $("btnSaveCompany").addEventListener("click", saveCompany);

  $("btnOrders").addEventListener("click", ()=>{ openModal("ordersModal"); loadOrders(); });
  $("closeOrders").addEventListener("click", ()=> closeModal("ordersModal"));
  $("ordersModal").addEventListener("click", (e)=>{ if (e.target.id==="ordersModal") closeModal("ordersModal"); });

  $("btnSave").addEventListener("click", saveProduct);
  $("btnDelete").addEventListener("click", deleteCurrentProduct);

  $("btnExport").addEventListener("click", exportCSV);
  $("importFile").addEventListener("change", importCSV);

  $("btnNuke").addEventListener("click", nukeAll);

  $("btnAddImg").addEventListener("click", addImageUrl);
  $("pImgFile").addEventListener("change", uploadImageFile);

  $("q").addEventListener("input", applyFilters);
}

async function loadProducts() {
  const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt","desc")));
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
  state.products = arr;
  applyFilters();
}

function applyFilters() {
  const q = normalize($("q").value);
  let list = state.products.slice();
  if (q) {
    list = list.filter(p => normalize([p.name,p.model,p.season,(Array.isArray(p.sizes)?p.sizes.join(" "):p.sizes||"")].join(" ")).includes(q));
  }
  state.filtered = list;
  renderGrid();
}

function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  $("resHint").textContent = state.filtered.length ? String(state.filtered.length) : "";
  $("empty").style.display = state.filtered.length ? "none" : "";

  for (const p of state.filtered) {
    const img = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : "logo.png";
    const key = p.categoryKey || computeCategoryFromModel(p.model);
    const sizes = Array.isArray(p.sizes) ? p.sizes.join(" ") : (p.sizes||"");
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card__img"><img src="${img}" alt="" loading="lazy"/></div>
      <div class="card__body">
        <div class="title">${escapeHtml(p.name||"—")}</div>
        <div class="meta"><span>موديل: <b>${escapeHtml(p.model||"")}</b></span> <span>تصنيف: <b>${escapeHtml(key||"")}</b></span></div>
        <div class="meta"><span>${escapeHtml(p.season||"")}</span> <span>${escapeHtml(sizes||"")}</span></div>
        <div class="priceRow">
          <div class="price">${money(p.priceWholesale)}</div>
          <button class="btn secondary" type="button">تعديل</button>
        </div>
      </div>
    `;
    card.querySelector("button").addEventListener("click", ()=> openProduct(p));
    grid.appendChild(card);
  }
}

function openProduct(p) {
  if (!state.user || !ADMIN_UIDS.includes(state.user.uid)) {
    toast("سجّل دخول الأدمن أولاً");
    return;
  }
  state.editing = p ? { ...p } : {
    name:"", model:"", priceWholesale:0, sizes:[], season:"", inStock:true, hidden:false, desc:"",
    images:[], createdAt: null
  };
  $("pmTitle").textContent = p ? "تعديل منتج" : "إضافة منتج";
  $("pName").value = state.editing.name || "";
  $("pModel").value = state.editing.model || "";
  $("pPrice").value = state.editing.priceWholesale ?? "";
  $("pSizes").value = Array.isArray(state.editing.sizes) ? state.editing.sizes.join(" ") : (state.editing.sizes||"");
  $("pSeason").value = state.editing.season || "";
  $("pStock").value = String(!!state.editing.inStock);
  $("pHidden").value = String(!!state.editing.hidden);
  $("pDesc").value = state.editing.desc || "";
  $("pImgUrl").value = "";
  renderImages();
  $("btnDelete").style.display = p ? "" : "none";
  openModal("productModal");
}

function renderImages() {
  const wrap = $("imgPreview");
  wrap.innerHTML = "";
  const imgs = Array.isArray(state.editing.images) ? state.editing.images : [];
  for (const url of imgs) {
    const img = document.createElement("img");
    img.src = url;
    img.style.width = "74px";
    img.style.height = "92px";
    img.style.borderRadius = "14px";
    img.style.objectFit = "cover";
    img.style.cursor = "pointer";
    img.title = "حذف";
    img.addEventListener("click", ()=> {
      state.editing.images = imgs.filter(x => x !== url);
      renderImages();
    });
    wrap.appendChild(img);
  }
}

function addImageUrl() {
  const url = $("pImgUrl").value.trim();
  if (!url) return;
  if (!state.editing.images) state.editing.images = [];
  state.editing.images.push(url);
  $("pImgUrl").value = "";
  renderImages();
}

async function uploadImageFile(e) {
  const file = e.target.files?.[0];
  $("pImgFile").value = "";
  if (!file) return;

  await loadCompany();
  const preset = (state.company?.cloudinaryPreset || "").trim();
  const folder = (state.company?.cloudinaryFolder || "Joodkids").trim() || "Joodkids";
  if (!preset) {
    toast("ضع Upload Preset في بيانات الشركة");
    return;
  }

  try {
    toast("جاري رفع الصورة…");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", preset);
    fd.append("folder", folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method:"POST",
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "upload failed");

    if (!state.editing.images) state.editing.images = [];
    state.editing.images.push(data.secure_url);
    renderImages();
    toast("تم رفع الصورة");
  } catch (err) {
    console.error(err);
    toast("فشل رفع الصورة");
  }
}

async function saveProduct() {
  if (!state.user || !ADMIN_UIDS.includes(state.user.uid)) return;

  const name = $("pName").value.trim();
  const model = $("pModel").value.trim();
  const priceWholesale = Number($("pPrice").value || 0);
  const sizes = $("pSizes").value.trim() ? $("pSizes").value.trim().split(/\s+/).filter(Boolean) : [];
  const season = $("pSeason").value.trim();
  const inStock = $("pStock").value === "true";
  const hidden = $("pHidden").value === "true";
  const desc = $("pDesc").value.trim();
  if (!name || !model || !(priceWholesale >= 0)) {
    toast("أكمل البيانات بشكل صحيح");
    return;
  }

  const categoryKey = computeCategoryFromModel(model);

  const data = {
    name, model, priceWholesale,
    sizes, season,
    inStock, hidden,
    desc,
    categoryKey,
    images: Array.isArray(state.editing.images) ? state.editing.images : [],
    updatedAt: serverTimestamp(),
  };

  try {
    if (state.editing?.id) {
      await updateDoc(doc(db, "products", state.editing.id), data);
      toast("تم التعديل");
    } else {
      await addDoc(collection(db, "products"), {
        ...data,
        createdAt: serverTimestamp()
      });
      toast("تمت الإضافة");
    }
    closeModal("productModal");
    await loadProducts();
  } catch (e) {
    console.error(e);
    toast("تعذر الحفظ");
  }
}

async function deleteCurrentProduct() {
  if (!state.editing?.id) return;
  if (!confirm("تأكيد حذف المنتج؟")) return;
  try {
    await deleteDoc(doc(db, "products", state.editing.id));
    toast("تم الحذف");
    closeModal("productModal");
    await loadProducts();
  } catch (e) {
    console.error(e);
    toast("تعذر الحذف");
  }
}

function download(name, text) {
  const blob = new Blob([text], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

function exportCSV() {
  const rows = [];
  rows.push(["name","model","priceWholesale","sizes","season","inStock","hidden","images"].join(","));
  for (const p of state.products) {
    const imgs = Array.isArray(p.images) ? p.images.join(" ") : "";
    const sizes = Array.isArray(p.sizes) ? p.sizes.join(" ") : (p.sizes||"");
    rows.push([
      csv(p.name), csv(p.model), csv(p.priceWholesale),
      csv(sizes), csv(p.season||""), csv(!!p.inStock), csv(!!p.hidden), csv(imgs)
    ].join(","));
  }
  download("products.csv", rows.join("\n"));
  toast("تم التصدير");
}

function csv(v){
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

async function importCSV(e) {
  const file = e.target.files?.[0];
  $("importFile").value = "";
  if (!file) return;
  const text = await file.text();
  const lines = parseCSV(text);
  if (lines.length < 2) return toast("ملف غير صالح");
  const header = lines[0].map(h=> normalize(h));
  const idx = (name) => header.indexOf(normalize(name));

  const iName = idx("name");
  const iModel = idx("model");
  const iPrice = idx("pricewholesale");
  const iSizes = idx("sizes");
  const iSeason = idx("season");
  const iStock = idx("instock");
  const iHidden = idx("hidden");
  const iImages = idx("images");

  if (iName < 0 || iModel < 0 || iPrice < 0) return toast("تأكد من الأعمدة: name, model, priceWholesale");

  let ok = 0;
  for (let r=1; r<lines.length; r++) {
    const row = lines[r];
    if (!row.length) continue;
    const name = (row[iName]||"").trim();
    const model = (row[iModel]||"").trim();
    const priceWholesale = Number((row[iPrice]||"0").toString().replace(/[^0-9.]/g,"") || 0);
    const sizes = (row[iSizes]||"").trim() ? (row[iSizes]||"").trim().split(/\s+/).filter(Boolean) : [];
    const season = (row[iSeason]||"").trim();
    const inStock = (row[iStock]||"").toString().trim().toLowerCase() !== "false";
    const hidden = (row[iHidden]||"").toString().trim().toLowerCase() === "true";
    const images = (row[iImages]||"").trim() ? (row[iImages]||"").trim().split(/\s+/).filter(Boolean) : [];

    if (!name || !model) continue;
    const categoryKey = computeCategoryFromModel(model);

    try {
      await addDoc(collection(db, "products"), {
        name, model, priceWholesale, sizes, season, inStock, hidden, images, categoryKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      ok++;
    } catch (err) {
      console.error(err);
    }
  }
  toast(`تم استيراد ${ok} منتج`);
  await loadProducts();
}

function parseCSV(text) {
  const rows = [];
  let cur = [];
  let val = "";
  let inQ = false;

  for (let i=0; i<text.length; i++) {
    const c = text[i];
    const n = text[i+1];

    if (c === '"' ) {
      if (inQ && n === '"') { val += '"'; i++; }
      else inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") { cur.push(val); val=""; continue; }
    if (!inQ && (c === "\n")) { cur.push(val); rows.push(cur); cur=[]; val=""; continue; }
    if (!inQ && c === "\r") continue;
    val += c;
  }
  if (val.length || cur.length) { cur.push(val); rows.push(cur); }
  return rows.map(r => r.map(x => (x ?? "")));
}

async function loadOrders() {
  const list = $("ordersList");
  list.innerHTML = "";
  try {
    const snap = await getDocs(query(collection(db,"orders"), orderBy("createdAt","desc"), limit(30)));
    if (snap.empty) {
      list.innerHTML = `<div class="small">لا توجد طلبات.</div>`;
      return;
    }
    await loadCompany();
    const whats = (state.company?.whatsapp || "").toString().replace(/\D/g,"");
    snap.forEach(d => {
      const o = d.data();
      const items = Array.isArray(o.items) ? o.items : [];
      const el = document.createElement("div");
      el.className = "cartItem";
      el.innerHTML = `
        <div class="ciBody">
          <div style="font-weight:950">طلب: ${d.id}</div>
          <div class="small">الاسم: <b>${escapeHtml(o.customerName||"")}</b> • الهاتف: <b>${escapeHtml(o.customerPhone||"")}</b></div>
          <div class="small">المدينة: <b>${escapeHtml(o.city||"")}</b> • الدفع: <b>${escapeHtml(o.paymentMethod||"")}</b></div>
          <div class="small">الإجمالي: <b>${money(o.total)}</b></div>
          <div class="small" style="white-space:pre-wrap;margin-top:6px">${items.map(it=>`- ${it.name} (موديل ${it.model}) × ${it.qty}`).join("\n")}</div>
          <div class="row" style="margin-top:10px">
            <button class="btn" type="button">واتساب</button>
            <button class="btn secondary" type="button">حذف</button>
          </div>
        </div>
      `;
      const [bWhats, bDel] = el.querySelectorAll("button");
      bWhats.addEventListener("click", ()=> {
        if (!whats) return toast("ضع رقم واتساب في بيانات الشركة");
        const msg = `تفاصيل الطلب: ${d.id}\nالاسم: ${o.customerName}\nالهاتف: ${o.customerPhone}\nالمدينة: ${o.city}\nالعنوان: ${o.address}\nالدفع: ${o.paymentMethod}\n—\n` +
          items.map(it=>`- ${it.name} (موديل ${it.model}) × ${it.qty}`).join("\n") +
          `\n—\nالإجمالي: ${money(o.total)}`;
        window.open("https://wa.me/" + whats + "?text=" + encodeURIComponent(msg), "_blank");
      });
      bDel.addEventListener("click", async ()=> {
        if (!confirm("حذف الطلب؟")) return;
        try {
          await deleteDoc(doc(db,"orders", d.id));
          toast("تم حذف الطلب");
          el.remove();
        } catch (e) {
          console.error(e);
          toast("تعذر الحذف");
        }
      });
      list.appendChild(el);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = `<div class="small">تعذر تحميل الطلبات.</div>`;
  }
}

async function nukeAll() {
  if (!confirm("تحذير: سيتم حذف جميع البيانات. متابعة؟")) return;
  if (!confirm("تأكيد نهائي؟")) return;

  const collections = ["products","categories","orders","settings","shipping","payments"];
  try {
    for (const c of collections) {
      await deleteAllDocsInCollection(c);
    }
    // company doc
    try { await deleteDoc(doc(db,"company","main")); } catch {}
    toast("تم حذف جميع البيانات");
    await loadProducts();
  } catch (e) {
    console.error(e);
    toast("تعذر حذف جميع البيانات");
  }
}

async function deleteAllDocsInCollection(colName) {
  // Delete in chunks
  while (true) {
    const snap = await getDocs(query(collection(db, colName), limit(200)));
    if (snap.empty) break;
    const promises = [];
    snap.forEach(d => promises.push(deleteDoc(d.ref)));
    await Promise.all(promises);
  }
}

(async function init() {
  setupTheme();
  setupModals();

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (user && !ADMIN_UIDS.includes(user.uid)) {
      toast("هذا الحساب ليس أدمن");
      await signOut(auth);
      state.user = null;
    }
    setAuthUI();
    if (state.user) {
      await loadCompany();
      await loadProducts();
    } else {
      state.products = [];
      state.filtered = [];
      renderGrid();
    }
  });
})();
