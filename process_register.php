<?php
// process_register.php - the ONE API endpoint for USWAG
//   action "register"   -> create a Buyer or Seller account
//   action "login"      -> get a fresh session token
//   action "sync_sales" -> save the offline sales queue (Sellers only)
//   action "dashboard" / "add_product" -> Seller tools;  "list_catalog" -> public product list

// ---------- CORS (must run before anything else) ----------
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ($origin === 'https://blumabas902pbox-dev.github.io')
        || preg_match('#^http://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);
if ($allowed) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

function respond(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { respond(405, ['error' => 'POST only.']); }

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) { respond(400, ['error' => 'Invalid JSON.']); }

$cfg = is_file(__DIR__ . '/config.php')
    ? require __DIR__ . '/config.php'      // create this on your host only; never commit it
    : ['host' => 'localhost', 'db' => 'uswag_db', 'user' => 'root', 'pass' => ''];   // local WAMP defaults
try {
    $pdo = new PDO("mysql:host={$cfg['host']};dbname={$cfg['db']};charset=utf8mb4", $cfg['user'], $cfg['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    error_log('USWAG DB connection failed: ' . $e->getMessage());
    respond(500, ['error' => 'Database connection failed.']);
}

switch ($in['action'] ?? '') {
    case 'register':   register($pdo, $in);   break;
    case 'login':      login($pdo, $in);      break;
    case 'sync_sales':   sync_sales($pdo, $in);   break;
    case 'list_catalog': list_catalog($pdo, $in); break;
    case 'dashboard':    dashboard($pdo, $in);    break;
    case 'add_product':  add_product($pdo, $in);  break;
    default:           respond(400, ['error' => 'Unknown action.']);
}

// ---------- REGISTER: Buyer and Seller are different accounts ----------
function register(PDO $pdo, array $in): void {
    throttle('register', 5, 3600);
    $name    = trim($in['username'] ?? '');
    $address = trim($in['address'] ?? '');
    $contact = trim($in['contact_number'] ?? '');
    $role    = trim($in['role'] ?? '');
    $pw      = (string)($in['password'] ?? '');

    if ($name === '' || $address === '' || $contact === '' || $pw === '') {
        respond(400, ['error' => 'Please fill in all required fields.']);
    }
    // Public sign-up may only create Buyer or Seller. SLP Admin is created manually in the database.
    if (!in_array($role, ['Buyer', 'Seller'], true)) {
        respond(403, ['error' => 'That role cannot be registered here.']);
    }
    if (!preg_match('/^\d{11}$/', $contact)) { respond(400, ['error' => 'Contact number must be exactly 11 digits.']); }
    if (strlen($pw) < 8)                      { respond(400, ['error' => 'Password must be at least 8 characters.']); }
    if (mb_strlen($name) > 50)                { respond(400, ['error' => 'Name must be 50 characters or fewer.']); }

    $email = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $name)) . bin2hex(random_bytes(3)) . '@uswag.ph';
    $token = bin2hex(random_bytes(32));

    try {
        $pdo->beginTransaction();

        $pdo->prepare(
            "INSERT INTO Accounts (role, username, email, contact_number, address, password_hash, api_token_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )->execute([$role, $name, $email, $contact, mb_substr($address, 0, 150),
                    password_hash($pw, PASSWORD_BCRYPT), hash('sha256', $token)]);
        $accountId = (int)$pdo->lastInsertId();

        if ($role === 'Seller') {
            // Sellers get a business profile + a capital ledger (the triggers need this row).
            $parts = preg_split('/\s+/', $name);
            $last  = count($parts) > 1 ? array_pop($parts) : '-';
            $first = implode(' ', $parts);

            $pdo->prepare(
                "INSERT INTO Sellers (account_id, first_name, last_name, contact_number, barangay_zone, slp_association)
                 VALUES (?, ?, ?, ?, ?, 'Samahan ng Masisinop SLPA')"
            )->execute([$accountId, $first, $last, $contact, mb_substr($address, 0, 50)]);
            $sellerId = (int)$pdo->lastInsertId();

            $pdo->prepare("INSERT INTO Capital_Management (seller_id, initial_capital, current_balance) VALUES (?, 0, 0)")
                ->execute([$sellerId]);
        }
        // Buyers: Accounts row only. No seller profile, no capital, no sales rights.

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') {
            respond(409, ['error' => 'That contact number is already registered.']);
        }
        error_log('USWAG register error: ' . $e->getMessage());
        respond(500, ['error' => 'Could not create the account. Please try again.']);
    }

    respond(201, ['status' => 'success', 'role' => $role, 'token' => $token, 'redirect' => 'thankyou.html']);
}

// ---------- LOGIN: contact number + password (names can repeat, phone numbers cannot) ----------
function login(PDO $pdo, array $in): void {
    throttle('login', 10, 900);
    $id = trim($in['contact_number'] ?? '');
    $pw = (string)($in['password'] ?? '');

    $stmt = $pdo->prepare("SELECT account_id, role, password_hash, is_active FROM Accounts WHERE contact_number = ? LIMIT 1");
    $stmt->execute([$id]);
    $acc = $stmt->fetch();

    if (!$acc || !$acc['is_active'] || !password_verify($pw, $acc['password_hash'])) {
        respond(401, ['error' => 'Wrong username or password.']);
    }
    $token = bin2hex(random_bytes(32));   // a new login replaces the previous device's token
    $pdo->prepare("UPDATE Accounts SET api_token_hash = ? WHERE account_id = ?")
        ->execute([hash('sha256', $token), $acc['account_id']]);

    respond(200, ['status' => 'success', 'role' => $acc['role'], 'token' => $token]);
}

// ---------- SYNC SALES: Sellers only; seller_id comes from the token, never from the browser ----------
function sync_sales(PDO $pdo, array $in): void {
    $sellerId = authSeller($pdo, $in);

    $sales = $in['sales'] ?? [];
    if (!is_array($sales) || count($sales) > 100) { respond(400, ['error' => 'Send at most 100 sales per sync.']); }

    $saved = [];
    $rejected = [];

    foreach ($sales as $s) {
        $cid = (string)($s['client_id'] ?? '');
        if (!preg_match('/^[0-9a-f-]{36}$/i', $cid)) continue;

        try {
            // Already saved earlier (e.g., the connection dropped before the reply)? Count it as done.
            $chk = $pdo->prepare("SELECT 1 FROM Sales WHERE client_id = ?");
            $chk->execute([$cid]);
            if ($chk->fetchColumn()) { $saved[] = $cid; continue; }

            $items = $s['items'] ?? [];
            if (!is_array($items) || !$items) throw new RuntimeException('Sale has no items.');

            $status = (($s['status'] ?? 'Paid') === 'Pending') ? 'Pending' : 'Paid';
            $sync   = !empty($s['was_offline']) ? 'Offline' : 'Online';
            $ts     = strtotime((string)($s['sale_date'] ?? ''));
            $date   = ($ts && $ts <= time() + 300) ? date('Y-m-d H:i:s', $ts) : date('Y-m-d H:i:s');

            $pdo->beginTransaction();
            $pdo->prepare("INSERT INTO Sales (seller_id, client_id, sale_date, status, sync_status) VALUES (?, ?, ?, ?, ?)")
                ->execute([$sellerId, $cid, $date, 'Pending', $sync]);   // Pending first so the receipt sees the items
            $saleId = (int)$pdo->lastInsertId();

            $own = $pdo->prepare("SELECT 1 FROM Products WHERE product_id = ? AND seller_id = ?");
            $ins = $pdo->prepare("INSERT INTO Sale_Details (sale_id, product_id, quantity_sold, unit_price_at_sale) VALUES (?, ?, ?, ?)");

            foreach ($items as $it) {
                $pid = (int)($it['product_id'] ?? 0);
                $qty = (float)($it['quantity'] ?? 0);
                $prc = (float)($it['unit_price'] ?? -1);
                if ($qty <= 0 || $prc < 0) throw new RuntimeException('Invalid quantity or price.');
                $own->execute([$pid, $sellerId]);
                if (!$own->fetchColumn()) throw new RuntimeException('Product does not belong to this seller.');
                $ins->execute([$saleId, $pid, $qty, $prc]);   // triggers update stock, capital, receipt
            }
            if ($status === 'Paid') {   // fires capital update + receipt triggers
                $pdo->prepare("UPDATE Sales SET status = 'Paid' WHERE sale_id = ?")->execute([$saleId]);
            }
            $pdo->commit();
            $saved[] = $cid;

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($e instanceof RuntimeException) {
                $reason = $e->getMessage();
            } elseif ($e instanceof PDOException && ($e->errorInfo[0] ?? '') === '45000') {
                $reason = $e->errorInfo[2] ?? 'Rejected by stock rules.';   // message from the stock trigger
            } else {
                error_log('USWAG sync error: ' . $e->getMessage());
                $reason = 'Could not save this sale.';
            }
            $rejected[] = ['client_id' => $cid, 'reason' => $reason];
        }
    }
    respond(200, ['saved' => $saved, 'rejected' => $rejected]);
}

// ---------- helpers ----------
function throttle(string $bucket, int $max, int $window): void {   // simple per-IP rate limit
    $f = sys_get_temp_dir() . '/uswag_' . md5($bucket . ($_SERVER['REMOTE_ADDR'] ?? ''));
    $hits = is_file($f) ? array_filter(array_map('intval', file($f, FILE_IGNORE_NEW_LINES)), fn($t) => $t > time() - $window) : [];
    if (count($hits) >= $max) respond(429, ['error' => 'Too many attempts. Please wait a while and try again.']);
    $hits[] = time();
    @file_put_contents($f, implode("\n", $hits));
}

function auth(PDO $pdo, array $in): ?array {
    $t = (string)($in['token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/i', $t)) return null;
    $st = $pdo->prepare("SELECT a.account_id, a.role, s.seller_id FROM Accounts a
                         LEFT JOIN Sellers s ON s.account_id = a.account_id
                         WHERE a.api_token_hash = ? AND a.is_active = 1");
    $st->execute([hash('sha256', $t)]);
    return $st->fetch() ?: null;
}

function authSeller(PDO $pdo, array $in): int {
    $me = auth($pdo, $in);
    if (!$me) respond(401, ['error' => 'Please log in again.']);
    if ($me['role'] !== 'Seller' || !$me['seller_id']) respond(403, ['error' => 'Only Seller accounts can do this.']);
    return (int)$me['seller_id'];
}

// ---------- CATALOG: anyone can browse; only logged-in users see the seller's phone ----------
function list_catalog(PDO $pdo, array $in): void {
    $me = auth($pdo, $in);
    $rows = $pdo->query(
        "SELECT p.product_name, p.unit_of_measure, p.unit_price, p.current_stock, c.category_name,
                CONCAT(s.first_name, ' ', s.last_name) AS seller_name, s.contact_number
         FROM Products p
         JOIN Categories c ON c.category_id = p.category_id
         JOIN Sellers s ON s.seller_id = p.seller_id
         WHERE p.current_stock > 0 ORDER BY p.product_name"
    )->fetchAll();
    if (!$me) foreach ($rows as $i => $r) unset($rows[$i]['contact_number']);
    respond(200, ['products' => $rows]);
}

// ---------- SELLER TOOLS ----------
function dashboard(PDO $pdo, array $in): void {
    $sid = authSeller($pdo, $in);
    $p = $pdo->prepare("SELECT product_id, product_name, unit_of_measure, unit_price, current_stock FROM Products WHERE seller_id = ? ORDER BY product_name");
    $p->execute([$sid]);
    $b = $pdo->prepare("SELECT current_balance FROM Capital_Management WHERE seller_id = ?");
    $b->execute([$sid]);
    respond(200, [
        'products'   => $p->fetchAll(),
        'categories' => $pdo->query("SELECT category_id, category_name FROM Categories ORDER BY category_name")->fetchAll(),
        'balance'    => (float)$b->fetchColumn(),
    ]);
}

function add_product(PDO $pdo, array $in): void {
    $sid   = authSeller($pdo, $in);
    $name  = trim($in['product_name'] ?? '');
    $unit  = trim($in['unit_of_measure'] ?? '');
    $cat   = (int)($in['category_id'] ?? 0);
    $price = (float)($in['unit_price'] ?? -1);
    $stock = (float)($in['stock'] ?? 0);
    if ($name === '' || mb_strlen($name) > 100 || $unit === '' || mb_strlen($unit) > 20 || $cat < 1 || $price < 0 || $stock < 0) {
        respond(400, ['error' => 'Please check the product details.']);
    }
    try {
        $pdo->beginTransaction();
        $pdo->prepare("INSERT INTO Products (seller_id, category_id, product_name, unit_of_measure, unit_price, current_stock) VALUES (?, ?, ?, ?, ?, 0)")
            ->execute([$sid, $cat, $name, $unit, $price]);
        $pid = (int)$pdo->lastInsertId();
        if ($stock > 0) {   // the stock trigger adds it to Products.current_stock
            $pdo->prepare("INSERT INTO Inventory_Transactions (product_id, transaction_type, verification_status, quantity, remarks) VALUES (?, 'Harvest/Restock', 'Verified', ?, 'Initial stock')")
                ->execute([$pid, $stock]);
        }
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') respond(409, ['error' => 'You already have a product with that name.']);
        error_log('USWAG add_product error: ' . $e->getMessage());
        respond(500, ['error' => 'Could not add the product.']);
    }
    respond(201, ['status' => 'success', 'product_id' => $pid]);
}