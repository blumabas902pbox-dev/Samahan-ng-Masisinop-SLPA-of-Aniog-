<div align="center">

# 🌾 USWAG
### **U**nified **S**ystem for **W**ork and **G**rowth

**A livelihood tracker built *for* the farmers and sellers of Samahan ng Masisinop SLPA — Barangay Aniog, Sagñay, Camarines Sur.**

[![Live Site](https://img.shields.io/badge/🌐_LIVE_SITE-Visit_Now-2e7d32?style=for-the-badge)](https://blumabas902pbox-dev.github.io/Samahan-ng-Masisinop-SLPA-of-Aniog-/)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PHP](https://img.shields.io/badge/PHP-777BB4?style=for-the-badge&logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)

*"Built with openness, trust, passion, love and care."*

</div>

---

## 💡 Why USWAG Exists

Small producers in Barangay Aniog grow cassava, corn, copra, rice and root crops, but tracking stock, sales, and expenses on paper is slow and error-prone. **USWAG turns that into a simple system**: know what you have, record what you sold, and see what you actually earned.

It supports the mission of the **DSWD Sustainable Livelihood Program (SLP)**: helping families build better lives through livelihood and small business.

---

## ✨ Features

| 📦 Manage Your Products | 📴 Work Anywhere | 💰 Track Your Earnings |
|---|---|---|
| Sellers add products and starting stock | Sales are saved on the phone first, then sent when the signal returns | Capital, cash flow, and receipts update automatically |

**Two different account types**

| | 🧑‍🌾 Seller | 🛒 Buyer |
|---|---|---|
| Registers with | Full name, address, contact number, password | Same form |
| Gets | Seller profile + capital ledger | Account only |
| Can do | Add products, record sales (even offline) | Browse live listings, call sellers |
| Cannot do | n/a | Record sales or add products (blocked on the server) |

> 🔒 **SLP Admin** accounts cannot be created from the website. The server rejects them; they are added directly in the database.

**On the website**
- 🏠 **Home**: community intro and swipeable photo galleries with a click-to-zoom lightbox
- 🛒 **Product Gallery**: live listings from the database, plus featured products
- 📝 **Register & Log In**: role picker, password show/hide, 1-minute video tutorial, login by contact number
- 🎉 **Thank You**: confetti after registration
- ℹ️ **About** and 📞 **Contact**: project background and how to reach the SLP team

**Under the hood**
- 🔐 Passwords hashed with **bcrypt**; sessions use random tokens stored as SHA-256 hashes
- 🛡️ **PDO prepared statements** against SQL injection, and escaped output against XSS
- ✅ Validation on both the browser and the server: 11-digit contact number, 8+ character password, weak-password detector
- 🚦 Per-IP **rate limiting** on register and login
- 🔁 **Duplicate-proof sync**: every offline sale carries a unique ID, so a dropped connection never double-counts

---

## 🔄 How Offline Sales Work

```
Seller taps "Save sale"
        │
        ▼
Saved in the phone's browser queue  ──(no signal? it waits)──┐
        │                                                     │
        ▼ (signal is back)                                    │
JavaScript sends JSON to process_register.php  ◄──────────────┘
        │
        ▼
PHP checks the login token, then saves to MySQL
        │
        ▼
Triggers update stock, capital, and the receipt
```

---

## 🗄️ The Database

`uswag_db.sql` is a complete **MySQL 5.7+ / MariaDB 10.2.7+ (InnoDB)** schema:

**10 tables**: `Accounts` · `Sellers` · `Categories` · `Products` · `Sales` · `Sale_Details` · `Inventory_Transactions` · `Expenses` · `Capital_Management` · `Receipts`

**1 view**: `vw_seller_cash_flow` · **1 procedure**: `sp_sync_offline_sales()`

**7 automation triggers**:

| # | Trigger | What it does |
|---|---|---|
| 1 | `trg_check_stock_before_transaction` | Blocks sales that exceed available stock |
| 2 | `trg_update_stock_after_insert` | Updates stock after each inventory transaction |
| 3 | `trg_update_capital_after_expense` | Deducts expenses from the seller's capital |
| 4 | `trg_saledetails_inventory_sync` | Logs an inventory record for every sale item |
| 5 | `trg_sales_status_capital_update` | Adjusts capital when a sale flips Pending ↔ Paid |
| 6 | `trg_saledetails_capital_insert` | Adds income when items join an already-Paid sale |
| 7 | `trg_generate_receipt_after_sale` | Creates a JSON receipt (item count + total) when a sale is marked Paid |

---

## 📁 Project Structure (10 files)

```
📦 Samahan-ng-Masisinop-SLPA-of-Aniog-
 ┣ 📄 index.html            # Home + photo galleries
 ┣ 📄 portfolio.html        # Product gallery, live listings, Seller tools
 ┣ 📄 about.html            # About USWAG
 ┣ 📄 contact.html          # Contact details
 ┣ 📄 register.html         # Registration + Log In
 ┣ 📄 thankyou.html         # Success + confetti
 ┣ 🎨 styles.css            # Site-wide styling
 ┣ ⚙️ script.js             # Validation, galleries, offline queue, sync
 ┣ 🐘 process_register.php  # The one API: register, login, products, sales
 ┗ 🗄️ uswag_db.sql          # Schema, view, procedure, triggers
```

Plus images and `Video_Tutorial.mp4`. On the PHP host you also create a **`config.php`** with your database login. It is **never committed**.

---

## 🚀 Deploy (no WAMP needed)

The website lives on **GitHub Pages**. GitHub Pages cannot run PHP, so the API lives on any **PHP + MySQL host**.

1. **Create a MySQL database** on your host and note the hostname, database name, user, and password.
2. **Import `uswag_db.sql`** into that database (phpMyAdmin → *Import*). Confirm your host allows triggers.
3. **Upload `process_register.php`** to the host, and create **`config.php`** next to it with your database details.
4. **Edit one line in `script.js`**: set `PHP_HOST` to your host's address, then push to GitHub.
5. **Open the live site**, register a Seller, add a product, and record a sale. 🎉

> 🧪 **Local testing:** on WAMP, create an empty database named `uswag_db`, import `uswag_db.sql` into it, and open the site from `localhost`. It works without `config.php`.

---

## 🔒 Security Notes

- Never commit `config.php` (add it to `.gitignore`).
- Use **HTTPS** on the PHP host.
- CORS only allows your GitHub Pages address and localhost. If your site address changes, update it at the top of `process_register.php`.

---

## 🗺️ Roadmap

- [x] Login, Seller tools, and a Buyer view
- [x] Offline sales queue with duplicate protection
- [x] Rate limiting and server-side role checks
- [ ] Service worker so pages themselves load with no signal
- [ ] Expenses and capital screens for Sellers
- [ ] Restock and edit-product screens
- [ ] Admin panel for the SLP team
- [ ] Buyer orders

---

## 📍 Contact

**Samahan ng Masisinop — SLPA Aniog**
📌 Zone 1, Aniog, Sagñay, Camarines Sur
📞 +63 938 364 2371
✉️ slpa.aniog@gmail.com

---

## 🎓 About the Developer

Developed by **Bryan Jay Lumabas** for the **Bachelor of Science in Information Technology** program at **Partido State University**, Goa, Camarines Sur, applying web development and database management to a real community's needs.

<div align="center">

**🌱 Technology, rooted in community. 🌱**

© 2026 USWAG · ©BJML

</div>
