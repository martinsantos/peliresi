<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
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

$data = json_decode(file_get_contents('php://input'), true);
$timestamp = date('Y-m-d H:i:s');
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
$ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
$page = $data['page'] ?? 'dashboard';

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
