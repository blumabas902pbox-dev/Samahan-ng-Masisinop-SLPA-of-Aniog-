<?php
// process_register.php - Database Insertion for USWAG System
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username       = trim($_POST['username'] ?? '');
    $contact_number = trim($_POST['contact_number'] ?? '');
    $role           = trim($_POST['role'] ?? 'Buyer');
    $password       = $_POST['password'] ?? '';

    if (!empty($username) && !empty($contact_number) && !empty($password)) {
        // Generate system email for Accounts table requirements
        $clean_user = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $username));
        $email      = $clean_user . rand(10, 99) . '@uswag.ph';

        // Secure password hash
        $password_hash = password_hash($password, PASSWORD_BCRYPT);

        try {
            $stmt = $pdo->prepare("INSERT INTO Accounts (role, username, email, contact_number, password_hash) VALUES (:role, :username, :email, :contact_number, :password_hash)");
            $stmt->execute([
                ':role'           => $role,
                ':username'       => $username,
                ':email'          => $email,
                ':contact_number' => $contact_number,
                ':password_hash'  => $password_hash
            ]);

            // Check if request was sent via Fetch API (AJAX)
            if (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
                header('Content-Type: application/json');
                echo json_encode(['status' => 'success', 'redirect' => 'thankyou.html']);
                exit();
            }

            // Standard browser redirect fallback
            header("Location: thankyou.html");
            exit();

        } catch (\PDOException $e) {
            http_response_code(500);
            die("Database Error: " . $e->getMessage());
        }
    } else {
        http_response_code(400);
        die("Please fill in all required fields.");
    }
} else {
    header("Location: register.html");
    exit();
}
?>