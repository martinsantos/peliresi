<?php
// Disabled by default. Configure SITREP_NOTIFY_TOKEN server-side if this legacy
// endpoint is still needed for a controlled demo environment.
$expectedToken = getenv('SITREP_NOTIFY_TOKEN') ?: '';
$allowedOrigin = getenv('SITREP_NOTIFY_ORIGIN') ?: 'https://sitrep.ultimamilla.com.ar';

header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-SITREP-NOTIFY-TOKEN');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

$providedToken = $_SERVER['HTTP_X_SITREP_NOTIFY_TOKEN'] ?? '';
if ($expectedToken === '' || !hash_equals($expectedToken, $providedToken)) {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit();
}

$data = json_decode(file_get_contents('php://input'), true);
$timestamp = date('Y-m-d H:i:s');
$userAgent = substr(str_replace(["\r", "\n"], ' ', $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'), 0, 300);
$ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
$page = substr(preg_replace('/[^a-zA-Z0-9_\/\.\-]/', '', $data['page'] ?? 'dashboard'), 0, 120);

$to = 'santosma@gmail.com';
$subject = '[SITREP] Nuevo acceso al sistema demo';
$message = "
Nuevo acceso a la demo SITREP:

Fecha/Hora: $timestamp
IP: $ip
Navegador: $userAgent
Pagina: $page

---
Sistema de Trazabilidad de Residuos Peligrosos
https://www.ultimamilla.com.ar/demoambiente/
";

$headers = 'From: noreply@ultimamilla.com.ar' . "\r\n" .
    'Reply-To: noreply@ultimamilla.com.ar' . "\r\n" .
    'X-Mailer: PHP/' . phpversion();

$sent = mail($to, $subject, $message, $headers);

echo json_encode(['success' => $sent, 'timestamp' => $timestamp]);
?>
