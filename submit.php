<?php
/**
 * Endpoint PQRS en PHP puro — reemplazo directo del backend viejo que llamaba
 * a Render (ya no existe). Llama a Airtable directamente, sin depender de
 * ningun servicio externo. Pensado para correr same-origin junto al script.js
 * (que ya hace fetch('submit.php')), sin necesidad de CORS ni subdominios.
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Metodo no permitido.']);
}

/* ── Rate limit: 5 solicitudes / hora por IP ────────────────────── */
function client_ip(): string {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function check_rate_limit(string $ip): bool {
    $dir = __DIR__ . '/rate_limit';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $file = $dir . '/' . sha1($ip) . '.json';
    $fp = fopen($file, 'c+');
    if (!$fp) {
        return true; // si no se puede escribir, no bloquear el envio por eso
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $data = $raw ? json_decode($raw, true) : null;
    $now = time();

    if (!$data || ($now - $data['window_start']) >= 3600) {
        $data = ['window_start' => $now, 'count' => 0];
    }

    $allowed = $data['count'] < 5;
    if ($allowed) {
        $data['count']++;
    }

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    return $allowed;
}

if (!check_rate_limit(client_ip())) {
    respond(429, ['success' => false, 'message' => 'Has superado el limite de solicitudes. Intenta de nuevo en una hora.']);
}

/* ── Validacion (misma logica que el backend de Python) ─────────── */
$nombres      = trim($_POST['nombres'] ?? '');
$apellidos    = trim($_POST['apellidos'] ?? '');
$correo       = trim($_POST['correo'] ?? '');
$celular      = trim($_POST['celular'] ?? '');
$tipo         = trim($_POST['tipo'] ?? '');
$descripcion  = trim($_POST['descripcion'] ?? '');
$autorizacion = trim($_POST['autorizacion'] ?? 'no');

$tipos_validos = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación'];
if (!in_array($tipo, $tipos_validos, true)) {
    respond(400, ['success' => false, 'message' => 'Tipo de PQRS no válido.']);
}

if ($autorizacion !== 'si') {
    respond(400, ['success' => false, 'message' => 'Debes aceptar la política de privacidad.']);
}

if (mb_strlen($nombres) > 100 || mb_strlen($apellidos) > 100) {
    respond(400, ['success' => false, 'message' => 'El nombre no puede superar los 100 caracteres.']);
}

if (mb_strlen($celular) > 15 || !preg_match('/^[+\d][\d\s\-]{6,14}$/', $celular)) {
    respond(400, ['success' => false, 'message' => 'Número de celular no válido.']);
}

if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $correo)) {
    respond(400, ['success' => false, 'message' => 'Correo electrónico no válido.']);
}

if (mb_strlen($descripcion) > 700) {
    respond(400, ['success' => false, 'message' => 'La descripción no puede superar los 700 caracteres.']);
}

$tipos_permitidos = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
$max_file_size    = 25 * 1024 * 1024; // 25 MB
$adjunto          = $_FILES['adjunto'] ?? null;
$tiene_adjunto     = $adjunto && $adjunto['error'] === UPLOAD_ERR_OK && $adjunto['name'] !== '';

if ($tiene_adjunto) {
    $ext = strtolower(pathinfo($adjunto['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $tipos_permitidos, true)) {
        respond(400, ['success' => false, 'message' => 'Tipo de archivo no permitido. Solo se aceptan PDF, Word e imágenes.']);
    }
    if ($adjunto['size'] > $max_file_size) {
        respond(400, ['success' => false, 'message' => 'El archivo adjunto no puede superar los 25 MB.']);
    }
}

/* ── Radicado ─────────────────────────────────────────────────── */
$radicado = 'TCL-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));

/* ── Crear registro en Airtable ──────────────────────────────── */
$fields = [
    'Nombres'                      => $nombres,
    'Apellidos'                    => $apellidos,
    'Correo electronico'           => $correo,
    'Celular'                      => $celular,
    'Tipo PQRS'                    => $tipo,
    'Descripción'                  => $descripcion,
    'Radicado'                     => $radicado,
    'Confirmación y autorización'  => 'Acepto y autorizo',
];

$url = 'https://api.airtable.com/v0/' . AIRTABLE_BASE . '/' . rawurlencode(AIRTABLE_TABLE);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode(['fields' => $fields], JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . AIRTABLE_TOKEN,
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT        => 10,
]);
$response  = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_err  = curl_error($ch);
curl_close($ch);

if ($response === false || $curl_err) {
    error_log('[PQRS] Error de conexion con Airtable: ' . $curl_err);
    respond(500, ['success' => false, 'message' => 'Error de conexión. Intenta más tarde.']);
}

if ($http_code !== 200 && $http_code !== 201) {
    error_log('[PQRS] Airtable respondio ' . $http_code . ': ' . $response);
    respond(500, ['success' => false, 'message' => 'No se pudo registrar la solicitud. Intenta más tarde.']);
}

$data      = json_decode($response, true);
$record_id = $data['id'] ?? null;

/* ── Subir adjunto si existe (tmpfiles.org -> PATCH Airtable) ──── */
if ($tiene_adjunto && $record_id) {
    try {
        $upload_ch = curl_init('https://tmpfiles.org/api/v1/upload');
        curl_setopt_array($upload_ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => [
                'file' => new CURLFile($adjunto['tmp_name'], $adjunto['type'], $adjunto['name']),
            ],
            CURLOPT_TIMEOUT        => 15,
        ]);
        $upload_response = curl_exec($upload_ch);
        curl_close($upload_ch);

        $upload_data = json_decode($upload_response, true);
        $file_url    = $upload_data['data']['url'] ?? '';
        $file_url    = str_replace('tmpfiles.org/', 'tmpfiles.org/dl/', $file_url);

        if ($file_url) {
            $patch_url = 'https://api.airtable.com/v0/' . AIRTABLE_BASE . '/' . rawurlencode(AIRTABLE_TABLE) . '/' . $record_id;
            $patch_ch  = curl_init($patch_url);
            curl_setopt_array($patch_ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CUSTOMREQUEST  => 'PATCH',
                CURLOPT_POSTFIELDS     => json_encode([
                    'fields' => [
                        'Adjuntar (opcional)' => [
                            ['url' => $file_url, 'filename' => $adjunto['name']],
                        ],
                    ],
                ], JSON_UNESCAPED_UNICODE),
                CURLOPT_HTTPHEADER     => [
                    'Authorization: Bearer ' . AIRTABLE_TOKEN,
                    'Content-Type: application/json',
                ],
                CURLOPT_TIMEOUT        => 10,
            ]);
            curl_exec($patch_ch);
            curl_close($patch_ch);
        }
    } catch (Throwable $e) {
        error_log('[PQRS] Error subiendo adjunto: ' . $e->getMessage());
        // El registro ya quedo guardado; el adjunto es opcional, no se interrumpe la respuesta.
    }
}

respond(200, ['success' => true, 'message' => 'Solicitud enviada correctamente.', 'radicado' => $radicado]);
