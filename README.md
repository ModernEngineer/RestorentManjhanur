# FoodMitra - Zomato-style food delivery platform

Poora full-stack project: customer website + admin panel + employee panel.

**Stack:** React 19 + TypeScript + Tailwind CSS v4 &middot; ASP.NET Core 10 Web API
(ADO.NET, sirf stored procedures) &middot; SQL Server &middot; JWT auth &middot;
payment gateway integration.

---

## Kya-kya bana hua hai

### Customer website
- **Home page** - full-screen video slider (Zomato jaisa), cuisines, nearby
  restaurants, live offers, happy customers, counters
- **Restaurant listing** - Zomato jaise filters: Offers, Rating 4.5+, Pet friendly,
  Outdoor seating, Serves Alcohol, Open Now, Pure Veg, cuisine, cost, locality,
  distance + 7 tarah ki sorting
- **Restaurant detail** - menu (category-wise, veg/non-veg filter, search),
  reviews + rating breakdown, halls, offers, info
- **Cart aur checkout** - coupon apply, **15 km delivery radius check**,
  delivery/pickup, COD ya online payment, poora bill breakdown
- **Order tracking** - status timeline, delivery partner ki details, payment history
- **Table booking** - live availability check, auto table allotment, occasion
- **Party hall booking** - birthday/anniversary/corporate, decoration, cake,
  live price quote, 30% advance payment
- **Reviews** - sirf delivered order par "verified" review
- **WhatsApp support button** - bottom-right, quick-message menu ke saath
- Login / signup / profile / saved addresses

### Admin panel (`/admin`)
- Dashboard - revenue chart, order status pie, top restaurants/dishes, KPIs
- Restaurants - add/edit, **image change (upload ya URL)**, live/band karo
- **Menu + food image change** - item CRUD, image upload, availability, bulk discount
- Orders - status flow, delivery assign
- Bookings - table + hall bookings, halls aur tables ka master data
- **Employees - kisko kaunsa restaurant dena hai** (per-restaurant permissions)
- Coupons/discounts - percent ya flat, order/table/hall ke liye alag
- Reviews moderation, Happy customers (testimonials), Payments, Settings

### Employee panel (`/employee`)
- Apna dashboard (sirf assigned restaurants ka data)
- Orders, Menu, Bookings - **sirf wahan tak jahan admin ne permission di hai**
- Meri deliveries - pickup/delivered mark karna

---

## Setup (3 step)

### Zaroori cheezein
- .NET SDK 10
- Node.js 20+
- SQL Server 2019 ya usse naya (Express bhi chalega)

### 1. Database

```powershell
cd database
.\run_database.ps1
```

Script khud SQL Server instance dhoondh leti hai. Apna server dena ho:

```powershell
.\run_database.ps1 -Server "localhost\SQLEXPRESS"
.\run_database.ps1 -Server "localhost" -SqlUser "sa" -SqlPassword "yourPassword"

# sirf stored procedures refresh karni ho (data safe rahega):
.\run_database.ps1 -SkipSchema -SkipSeed
```

> `01_Schema.sql` saari tables **drop karke** dobara banata hai. Script confirm
> maangti hai. Sirf fresh setup / reset ke liye.

Files isi order me chalti hain:

| File | Kya karti hai |
|---|---|
| `01_Schema.sql` | 23 tables, indexes, TVP types |
| `02_Functions.sql` | distance (haversine), delivery fee, open/closed, minutes-to-close |
| `03_SP_Auth.sql` | users, JWT refresh tokens, addresses |
| `04_SP_Restaurants.sql` | search + saare filters, detail, admin CRUD |
| `05_SP_Menu.sql` | categories, food items, **image update**, bulk discount |
| `06_SP_Orders.sql` | coupons, order create (TVP), status flow, payments |
| `07_SP_Bookings.sql` | table booking, halls, hall booking + quote |
| `08_SP_Admin.sql` | employees + assignment, reviews, testimonials, dashboards |
| `09_SeedData.sql` | 12 restaurants, 52 dishes, 16 halls, 8 coupons, demo users |

### 2. API

`backend/Zomato.Api/appsettings.json` me connection string set karo:

```json
"DefaultConnection": "Server=localhost\\SQLEXPRESS;Database=ZomatoCloneDb;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=True;MultipleActiveResultSets=True"
```

Phir:

```powershell
cd backend\Zomato.Api
dotnet run --urls "http://localhost:5157"
```

- API: <http://localhost:5157>
- Swagger: <http://localhost:5157/swagger>
- Health check: <http://localhost:5157/api/health>

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Website: <http://localhost:5173>

Vite dev server `/api` aur `/uploads` ko API par proxy karta hai, isliye dev me
CORS ka koi jhanjhat nahi.

---

## Login (sab ka password: `Pass@123`)

| Role | Email | Kya dikhega |
|---|---|---|
| Admin | `admin@foodmitra.in` | Poora admin panel |
| Employee | `rahul.emp@foodmitra.in` | 2 restaurants, full permissions |
| Employee | `deepak.emp@foodmitra.in` | DeliveryBoy - sirf orders |
| Employee | `priya.emp@foodmitra.in` | Banquet manager - hall bookings |
| Customer | `ananya@example.com` | Order, booking, review |

Login page par demo accounts ek click me bhar jaate hain.

---

## Delivery area aur charge

### Rate list

| Doori | Charge |
|---|---|
| 1 km tak | Rs 20 |
| 1 - 3 km | Rs 30 |
| 3 - 5 km | Rs 40 |
| 5 - 10 km | Rs 65 |
| 10 - 15 km | Rs 90 |
| 15 km se zyada | Delivery nahi |

Charge order ke total me add hota hai aur payment me chala jaata hai.
Customer ko checkout par poori rate list dikhti hai, aur uska apna slab
highlight hota hai.

**Slab badalna ho:** `database/02_Functions.sql` me `fn_DeliveryFee` edit karke
file dobara chala do. Frontend ki rate-list `frontend/src/context/deliveryAreas.ts`
ke `DELIVERY_SLABS` me hai — dono same rakhna.

### Delivery areas (gaon / kasbe)

Poori list `frontend/src/context/deliveryAreas.ts` me hai. Naya area add karna ho
to bas `AREAS` array me ek line daal do.

> **Coordinates ke baare me:** abhi har area ki position `DELIVERY_CENTER` se
> **doori** ke hisaab se banayi gayi hai. Isliye **delivery charge bilkul sahi
> lagta hai**, par map par gaon ki asli disha sahi nahi hai.
>
> Asli coordinates daalne ke liye: Google Maps me us jagah par right-click →
> pehla option (`25.531234, 81.382345`) copy karo → `AREAS` me us line par
> `lat` aur `lng` daal do. Tab `km`/`bearing` ignore ho jaate hain.
>
> `DELIVERY_CENTER` (aapki dukaan) bhi placeholder hai — usko apni asli location
> se badalna sabse pehla kaam hai. Wahi coordinate `database/10_LocalArea.sql`
> ke `@CenterLat` / `@CenterLng` me bhi daalo.

### Demo data ko apne area me laana

```powershell
cd database
sqlcmd -S "localhost\SQLEXPRESS" -E -C -i 10_LocalArea.sql
```

Ye script demo restaurants aur addresses ko delivery center ke aas paas le aati
hai (seed data Delhi NCR ka hai, isliye ye zaroori hai — warna distance 600+ km
aata hai aur kuch bhi deliverable nahi hota).

## Hero video slider

Home page ka slider `frontend/public/videos/` se videos uthata hai:
`hero-1.mp4`, `hero-2.mp4`, `hero-3.mp4`.

Abhi ye files nahi hain, isliye **poster images** dikh rahi hain - page phir bhi
poora bhara lagta hai. Apni videos daalte hi wo chalne lagengi.
Details: [`frontend/public/videos/README.md`](frontend/public/videos/README.md)

---

## Payment gateway - Razorpay (test mode)

Abhi **Razorpay test environment** laga hua hai. Flow:

```
order create -> POST /payments/create   (Razorpay par order banta hai)
             -> Razorpay checkout popup  (customer pay karta hai)
             -> POST /payments/verify    (HMAC signature check)
             -> order CONFIRMED + payment PAID
```

Signature Razorpay ke formula se verify hoti hai:
`HMAC_SHA256("{order_id}|{payment_id}", key_secret)` — galat signature aane par
payment **reject** ho jaata hai.

### Keys kahan hain

| Cheez | Kahan | Kyun |
|---|---|---|
| `Payment:KeyId` | `appsettings.json` | Public hai — browser tak jaata hi hai |
| `Payment:KeySecret` | **User Secrets** | Secret hai — kabhi commit nahi hona chahiye |

Secret set/badalne ke liye:

```powershell
cd backend\Zomato.Api
dotnet user-secrets set "Payment:KeySecret" "<your_key_secret>"
dotnet user-secrets list          # check karo
```

> Doosri machine par clone karo to secret dobara set karna padega — User Secrets
> machine-local hoti hain, repo me nahi jaatin.

Production/server par environment variable bhi chalega:

```
Payment__KeySecret=<your_key_secret>
```

### Test cards (Razorpay test mode)

| Kya test karna hai | Kaise |
|---|---|
| Success | Card `4111 1111 1111 1111`, koi bhi future expiry, CVV `123` |
| UPI success | UPI id `success@razorpay` |
| UPI failure | UPI id `failure@razorpay` |
| Netbanking | koi bhi bank chuno, agli screen par "Success" dabao |

Test mode me **asli paise nahi katenge**.

### MOCK par wapas jaana ho

`appsettings.json` me `Payment:Provider` ko `MOCK` kar do — bina internet/keys ke
poora flow test ho jayega (`/payments/mock/checkout` server hi valid signature
de deta hai). Provider `RAZORPAY` hone par ye mock endpoint apne aap band ho
jaata hai.

### Production me jaane se pehle

- Test keys ki jagah **live keys** daalo (`rzp_live_...`)
- **Webhook** lagao (`payment.captured`, `payment.failed`) — agar customer pay
  karke browser band kar de, to bina webhook ke order PENDING pada rah jaayega.
  Signature verify se authenticity to confirm ho jaati hai, par webhook safety
  net ka kaam karta hai.
- Razorpay dashboard par settlement account aur KYC complete karo

---

## Project structure

```
zomatowesbite/
├── database/                    9 SQL files + run_database.ps1
│
├── backend/
│   ├── Zomato.Api/
│   │   ├── Common/              Db.cs (ADO.NET layer), ApiResponse, AppRoles
│   │   ├── Models/              request DTOs + validation
│   │   ├── Services/            JWT, BCrypt, payment gateway, file upload, AccessGuard
│   │   ├── Controllers/         12 controllers
│   │   └── wwwroot/uploads/     uploaded images
│   └── Tools/HashGen/           seed data ke liye BCrypt hash generator
│
└── frontend/
    └── src/
        ├── api/                 fetch client (auto token refresh) + typed endpoints
        ├── components/          UI primitives, cards, filters, hero slider, WhatsApp
        ├── context/             Auth, Cart, Location, Toast
        ├── pages/               customer pages
        │   ├── admin/           admin panel
        │   ├── employee/        employee panel
        │   └── manage/          Menu/Orders/Bookings manager (dono panel share karte hain)
        └── types/               API ke TypeScript types
```

---

## Architecture ke kuch decisions

**Saara DB access stored procedures se** - koi inline SQL nahi. `Common/Db.cs`
ek patla ADO.NET wrapper hai jo SP ke columns ko seedha camelCase JSON me badal
deta hai, isliye har table ke liye alag entity class nahi banani padti.

**Prices hamesha server se** - order place karte waqt client ki bheji hui price
ignore hoti hai, `usp_Order_Create` khud DB se price uthati hai. Isse price
tampering possible nahi.

**15 km rule ek hi jagah** - `fn_DistanceKm` (SQL Server ka `geography` type) se
distance nikalta hai. Frontend sirf dikhata hai; asli check `usp_Order_Create`
ke andar hota hai, isliye API call se bypass nahi kar sakte.

**Employee scoping SP me hai** - `usp_Order_List` me `@ForEmployeeId` dene par
sirf uske assigned restaurants ke orders aate hain, aur `AccessGuard` per-request
permission bhi check karta hai. Do layer me protection hai.

**Order status transitions DB me enforce** - `usp_Order_UpdateStatus` galat jump
(jaise PREPARING se seedha DELIVERED) reject kar deta hai.

---

## Demo data ke baare me

Restaurant ke naam, reviews aur testimonials **fictional** hain - kisi asli
business par fake rating na lage isliye. Localities (Connaught Place, Cyber Hub
waghera) asli hain par coordinates approximate demo values hain. Production me
apna asli data daalna.

---

## Useful commands

```powershell
# database dobara banao
cd database; .\run_database.ps1

# sirf stored procedures update karo
cd database; .\run_database.ps1 -SkipSchema -SkipSeed

# API
cd backend\Zomato.Api; dotnet run --urls "http://localhost:5157"

# frontend dev
cd frontend; npm run dev

# frontend production build
cd frontend; npm run build

# sirf typecheck
cd frontend; npm run typecheck

# seed data ke liye naya password hash
dotnet run --project backend\Tools\HashGen -- "MeraPassword@123"
```
#   R e s t o r e n t M a n j h a n u r  
 