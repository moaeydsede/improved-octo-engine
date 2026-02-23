
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, addDoc, serverTimestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

const ADMIN_UID = "dZS7jUaB43aCL5Km3zr5V4LZuMr1";

const $ = (id) => document.getElementById(id);
const state = {
  products: [],
  filtered: [],
  cart: loadCart(),
  onlyInStock: false,
  company: null,
  installEvent: null,
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

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("jk_cart") || "[]");
  } catch {
    return [];
  }
}
function saveCart() {
  localStorage.setItem("jk_cart", JSON.stringify(state.cart));
  renderCartBadge();
}

function cartCount() {
  return state.cart.reduce((a,it)=> a + (it.qty||0), 0);
}
function cartTotal() {
  return state.cart.reduce((a,it)=> a + (Number(it.priceWholesale||0) * (it.qty||0)), 0);
}

function renderCartBadge() {
  $("cartCount").textContent = String(cartCount());
}

function computeCategoryFromModel(model) {
  const m = String(model||"").replace(/\D/g,"");
  if (!m) return "";
  const num = Number(m);
  if (Number.isNaN(num)) return "";
  return num < 1000 ? m.slice(0,1) : m.slice(0,2);
}

function normalize(s) {
  return (s||"").toString().trim().toLowerCase();
}

async function loadCompany() {
  try {
    const snap = await getDoc(doc(db, "company", "main"));
    state.company = snap.exists() ? snap.data() : null;
  } catch (e) {
    state.company = null;
  }

  const line = state.company?.line || state.company?.name || "—";
  $("companyLine").textContent = line;

  // Policy snippet
  const p = defaultPolicyText();
  $("policyText").textContent = p.slice(0, 220) + (p.length>220 ? "…" : "");
  $("policyFull").innerHTML = "<div style='white-space:pre-wrap;line-height:1.8'>" + escapeHtml(p) + "</div>";
}

function defaultPolicyText(){
  return `يمكنك عمل طلب استرجاع او استبدال للمنتجات خلال 7 يوم .
و فى حالات عيوب الصناعة 10 يوم من وقت وصول الطلب.

عند إرجاع المنتج, تأكد من وجود جميع الملحقات الخاصة بالطلب بحالتها السليمة و ان المنتج فى عبوته الاصلية وبتغليفه الاصلي والملابس بحالتها كما وصلت للعميل غير مستعملة او ملبوسة او مغسولة 

الاستبدال والاسترجاع علي الملابس الخارجية فقط والتي بدون خصم 

طرق الدفع 
1- نقدا من خلال أحد فروعنا 
2- تحويلات بنكية 
3- انستا بي 
4- محافظ الكترونيه ( فودافون كاش او اتصالات كاش او أورنج كاش) 
5-نعتذر من عملائنا الكرام البيع بالاجل لاي سبب كان 

تنويه عند رجوع البضاعه بدون تبليغنا قبل الاسترجاع ب 3 ايام على الاقل سوف يتم خصم قيمه الشحن ذهاب و اياب من العربون المدفوع لدينا 

لديك 7 يوم من تاريخ إستلامك أي سلعة لتقدم طلب ارجاعها.`.trim();
}

function escapeHtml(s){
  return (s||"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

async function loadProducts() {
  const col = collection(db, "products");
  const qy = query(col, orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);

  const arr = [];
  snap.forEach(d => {
    const data = d.data();
    arr.push({ id: d.id, ...data });
  });
  state.products = arr;
  buildCategoryOptions();
  applyFilters();
  $("skeleton").style.display = "none";
  $("grid").style.display = "";
}

function buildCategoryOptions() {
  const set = new Set();
  for (const p of state.products) {
    const key = p.categoryKey || computeCategoryFromModel(p.model);
    if (key) set.add(String(key));
  }
  const opts = Array.from(set).sort((a,b)=> a.localeCompare(b,'ar'));
  const sel = $("filterCategory");
  sel.innerHTML = '<option value="">كل التصنيفات</option>' + opts.map(k=>`<option value="${k}">تصنيف ${k}</option>`).join("");
}

function applyFilters() {
  const q = normalize($("q").value);
  const cat = $("filterCategory").value;
  const season = $("filterSeason").value;
  const sort = $("sortBy").value;
  const only = state.onlyInStock;

  let list = state.products.filter(p => !p.hidden);

  if (q) {
    list = list.filter(p => {
      const sizes = Array.isArray(p.sizes) ? p.sizes.join(" ") : (p.sizes || "");
      const hay = normalize([p.name, p.model, p.season, sizes].join(" "));
      return hay.includes(q);
    });
  }
  if (cat) {
    list = list.filter(p => (String(p.categoryKey||computeCategoryFromModel(p.model)) === String(cat)));
  }
  if (season) {
    list = list.filter(p => (p.season||"") === season);
  }
  if (only) {
    list = list.filter(p => !!p.inStock);
  }

  if (sort === "priceAsc") {
    list.sort((a,b)=> Number(a.priceWholesale||0) - Number(b.priceWholesale||0));
  } else if (sort === "priceDesc") {
    list.sort((a,b)=> Number(b.priceWholesale||0) - Number(a.priceWholesale||0));
  } else if (sort === "modelAsc") {
    list.sort((a,b)=> String(a.model||"").localeCompare(String(b.model||""), 'ar'));
  } // new already by createdAt desc

  state.filtered = list;
  renderGrid();
}

function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  $("resHint").textContent = state.filtered.length ? `${state.filtered.length}` : "";
  $("empty").style.display = state.filtered.length ? "none" : "";

  for (const p of state.filtered) {
    const img = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : "logo.png";
    const key = p.categoryKey || computeCategoryFromModel(p.model);
    const sizes = Array.isArray(p.sizes) ? p.sizes.join(" ") : (p.sizes || "");
    const season = p.season ? `• ${p.season}` : "";
    const stockPill = p.inStock ? "متوفر" : "غير متوفر";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card__img">
        <img src="${img}" alt="${escapeHtml(p.name||"")}" loading="lazy"/>
        <div class="pill">${stockPill}</div>
      </div>
      <div class="card__body">
        <div class="title">${escapeHtml(p.name || "—")}</div>
        <div class="meta">
          <span>موديل: <b>${escapeHtml(p.model||"—")}</b></span>
          <span>تصنيف: <b>${escapeHtml(key||"—")}</b></span>
        </div>
        <div class="meta">
          <span>${escapeHtml(sizes||"")}</span>
          <span>${season}</span>
        </div>
        <div class="priceRow">
          <div class="price">${money(p.priceWholesale)}</div>
          <button class="btn" type="button" ${p.inStock ? "" : "disabled"}>إضافة</button>
        </div>
      </div>
    `;
    const imgEl = card.querySelector("img");
    imgEl.addEventListener("click", ()=> openLightbox(imgEl.src));

    card.querySelector("button.btn").addEventListener("click", () => {
      addToCart(p);
    });
    grid.appendChild(card);
  }
}

function addToCart(p) {
  const id = p.id;
  const found = state.cart.find(x => x.id === id);
  if (found) found.qty += 1;
  else state.cart.push({
    id, name: p.name, model: p.model, priceWholesale: p.priceWholesale,
    image: (Array.isArray(p.images) && p.images[0]) ? p.images[0] : "logo.png",
    qty: 1
  });
  saveCart();
  toast("تمت الإضافة للسلة");
}

function openModal(id) {
  $(id).classList.add("open");
}
function closeModal(id) {
  $(id).classList.remove("open");
}

function renderCart() {
  const list = $("cartList");
  list.innerHTML = "";
  if (!state.cart.length) {
    list.innerHTML = `<div class="small">السلة فارغة.</div>`;
  } else {
    for (const it of state.cart) {
      const row = document.createElement("div");
      row.className = "cartItem";
      row.innerHTML = `
        <img src="${it.image||"logo.png"}" alt=""/>
        <div class="ciBody">
          <div style="font-weight:950">${escapeHtml(it.name||"")}</div>
          <div class="small">موديل: <b>${escapeHtml(it.model||"")}</b></div>
          <div class="small">سعر: <b>${money(it.priceWholesale)}</b></div>
          <div class="qty">
            <button type="button" aria-label="نقص">−</button>
            <div style="min-width:26px;text-align:center;font-weight:950">${it.qty}</div>
            <button type="button" aria-label="زود">+</button>
            <button type="button" aria-label="حذف" style="margin-inline-start:auto">🗑️</button>
          </div>
        </div>
      `;
      const [minus, qtyBox, plus, del] = row.querySelectorAll("button");
      minus.addEventListener("click", ()=> {
        it.qty = Math.max(1, (it.qty||1) - 1);
        saveCart(); renderCart();
      });
      plus.addEventListener("click", ()=> {
        it.qty = (it.qty||1) + 1;
        saveCart(); renderCart();
      });
      del.addEventListener("click", ()=> {
        state.cart = state.cart.filter(x => x !== it);
        saveCart(); renderCart();
      });
      list.appendChild(row);
    }
  }
  $("cartTotal").textContent = money(cartTotal());
}

function openLightbox(src) {
  const lb = $("lightbox");
  const img = $("lightboxImg");
  img.src = src;
  lb.classList.add("open");
  lb.addEventListener("click", ()=> lb.classList.remove("open"), { once:true });
}

async function sendOrder() {
  if (!state.cart.length) {
    toast("السلة فارغة");
    return;
  }
  const customerName = $("cName").value.trim();
  const customerPhone = $("cPhone").value.trim();
  const city = $("cCity").value.trim();
  const address = $("cAddress").value.trim();
  const paymentMethod = $("payMethod").value;

  if (!customerName || !customerPhone || !city || !address) {
    toast("أكمل بيانات العميل");
    return;
  }

  const items = state.cart.map(it => ({
    id: it.id,
    name: it.name,
    model: it.model,
    priceWholesale: Number(it.priceWholesale||0),
    qty: Number(it.qty||0)
  }));
  const total = cartTotal();

  try {
    const ref = await addDoc(collection(db, "orders"), {
      customerName,
      customerPhone,
      city,
      address,
      paymentMethod,
      items,
      total,
      createdAt: serverTimestamp()
    });

    const whats = (state.company?.whatsapp || state.company?.whats || "").toString().replace(/\D/g,"") || "201000000000";
    const msg = buildWhatsMessage({ orderId: ref.id, customerName, customerPhone, city, address, paymentMethod, items, total });
    const url = "https://wa.me/" + whats + "?text=" + encodeURIComponent(msg);
    window.open(url, "_blank");

    state.cart = [];
    saveCart();
    renderCart();
    closeModal("checkoutModal");
    closeModal("cartModal");
    toast("تم إنشاء الطلب");
  } catch (e) {
    console.error(e);
    toast("تعذر إنشاء الطلب");
  }
}

function buildWhatsMessage(o) {
  const lines = [];
  lines.push("طلب جديد - JoodKids");
  lines.push("رقم الطلب: " + o.orderId);
  lines.push("—");
  lines.push("الاسم: " + o.customerName);
  lines.push("الهاتف: " + o.customerPhone);
  lines.push("المدينة: " + o.city);
  lines.push("العنوان: " + o.address);
  lines.push("طريقة الدفع: " + o.paymentMethod);
  lines.push("—");
  lines.push("المنتجات:");
  for (const it of o.items) {
    lines.push(`- ${it.name} (موديل ${it.model}) × ${it.qty} = ${money(it.priceWholesale * it.qty)}`);
  }
  lines.push("—");
  lines.push("الإجمالي: " + money(o.total));
  return lines.join("\n");
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

function setupAdminTap() {
  let taps = 0;
  let timer = null;
  $("brandBtn").addEventListener("click", ()=> {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(()=>{ taps = 0; }, 900);
    if (taps >= 5) {
      window.location.href = "./admin.html";
    }
  });
}

function setupModals() {
  $("btnCart").addEventListener("click", ()=>{ renderCart(); openModal("cartModal"); });
  $("closeCart").addEventListener("click", ()=> closeModal("cartModal"));
  $("cartModal").addEventListener("click", (e)=>{ if (e.target.id==="cartModal") closeModal("cartModal"); });

  $("btnCheckout").addEventListener("click", ()=> {
    if (!state.cart.length) return toast("السلة فارغة");
    closeModal("cartModal");
    openModal("checkoutModal");
  });
  $("closeCheckout").addEventListener("click", ()=> closeModal("checkoutModal"));
  $("checkoutModal").addEventListener("click", (e)=>{ if (e.target.id==="checkoutModal") closeModal("checkoutModal"); });
  $("btnSendOrder").addEventListener("click", sendOrder);

  $("btnClearCart").addEventListener("click", ()=> {
    state.cart = [];
    saveCart();
    renderCart();
    toast("تم التفريغ");
  });

  $("btnContact").addEventListener("click", ()=> openModal("contactModal"));
  $("closeContact").addEventListener("click", ()=> closeModal("contactModal"));
  $("contactModal").addEventListener("click", (e)=>{ if (e.target.id==="contactModal") closeModal("contactModal"); });

  $("btnPolicy").addEventListener("click", ()=> openModal("policyModal"));
  $("closePolicy").addEventListener("click", ()=> closeModal("policyModal"));
  $("policyModal").addEventListener("click", (e)=>{ if (e.target.id==="policyModal") closeModal("policyModal"); });
}

function setupContactLinks() {
  function go(url) {
    if (!url) return toast("الرابط غير موجود");
    window.open(url, "_blank");
  }
  $("goWhats").addEventListener("click", ()=> {
    const whats = (state.company?.whatsapp || "").toString().replace(/\D/g,"");
    if (!whats) return toast("رقم واتساب غير موجود");
    window.open("https://wa.me/" + whats, "_blank");
  });
  $("goFb").addEventListener("click", ()=> go(state.company?.facebook));
  $("goIg").addEventListener("click", ()=> go(state.company?.instagram));
  $("goTg").addEventListener("click", ()=> go(state.company?.telegram));
  $("goFactoryMap").addEventListener("click", ()=> go(state.company?.factoryMap));
  $("goShopMap").addEventListener("click", ()=> go(state.company?.shopMap));
}

function setupFilters() {
  $("q").addEventListener("input", applyFilters);
  $("filterCategory").addEventListener("change", applyFilters);
  $("filterSeason").addEventListener("change", applyFilters);
  $("sortBy").addEventListener("change", applyFilters);
  $("onlyInStock").addEventListener("click", ()=> {
    state.onlyInStock = !state.onlyInStock;
    $("onlyInStock").setAttribute("aria-pressed", String(state.onlyInStock));
    $("onlyInStock").textContent = state.onlyInStock ? "✅ المتوفر فقط" : "✅ المتوفر فقط";
    applyFilters();
  });
}

function setupPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.installEvent = e;
    $("installBanner").classList.add("open");
  });
  $("btnInstall").addEventListener("click", async ()=> {
    if (!state.installEvent) return;
    state.installEvent.prompt();
    try { await state.installEvent.userChoice; } catch {}
    state.installEvent = null;
    $("installBanner").classList.remove("open");
  });
}

(async function init() {
  setupTheme();
  setupAdminTap();
  setupModals();
  setupFilters();
  setupContactLinks();
  setupPWA();
  renderCartBadge();

  await loadCompany();

  try {
    await loadProducts();
  } catch (e) {
    console.error(e);
    $("skeleton").style.display = "none";
    $("empty").style.display = "";
    toast("تعذر تحميل البيانات");
  }
})();
