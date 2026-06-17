<?php
/**
 * PQRS Form — Backend processor
 * Recibe el formulario y crea el registro en Airtable.
 * La configuración sensible vive en config.php (bloqueado vía .htaccess).
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/* Solo POST */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    out(false, 'Método no permitido.');
}

/* ── Protección CSRF — verificar origen de la solicitud ─────── */
$allowed_host = 'tclasesores.com';
$origin       = $_SERVER['HTTP_ORIGIN']  ?? '';
$referer      = $_SERVER['HTTP_REFERER'] ?? '';

if ($origin !== '') {
    $origin_host = parse_url($origin, PHP_URL_HOST) ?? '';
    if ($origin_host !== $allowed_host) {
        out(false, 'Solicitud no autorizada.');
    }
} else {
    $referer_host = parse_url($referer, PHP_URL_HOST) ?? '';
    if ($referer_host !== $allowed_host) {
        out(false, 'Solicitud no autorizada.');
    }
}

/* ── Rate limiting — máx. 5 envíos por hora por IP ─────────── */
$ip_hash = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rl_file = sys_get_temp_dir() . '/pqrs_rl_' . $ip_hash . '.json';
$rl_limit  = 5;
$rl_window = 3600;

$rl = ['times' => []];
if (is_file($rl_file)) {
    $raw = file_get_contents($rl_file);
    if ($raw) $rl = json_decode($raw, true) ?: ['times' => []];
}
$now      = time();
$rl['times'] = array_values(array_filter($rl['times'], fn($t) => $now - $t < $rl_window));

if (count($rl['times']) >= $rl_limit) {
    out(false, 'Has excedido el límite de solicitudes. Intenta de nuevo en una hora.');
}
$rl['times'][] = $now;
file_put_contents($rl_file, json_encode($rl), LOCK_EX);

/* ── Validar campos requeridos ──────────────────────────────── */
$required = ['nombres', 'apellidos', 'correo', 'celular', 'tipo', 'descripcion'];
foreach ($required as $f) {
    if (empty(trim($_POST[$f] ?? ''))) {
        out(false, "El campo «{$f}» es obligatorio.");
    }
}

if (empty($_POST['autorizacion']) || $_POST['autorizacion'] !== 'si') {
    out(false, 'Debes aceptar la política de privacidad.');
}

/* ── Sanitizar ──────────────────────────────────────────────── */
$nombres     = trim($_POST['nombres']);
$apellidos   = trim($_POST['apellidos']);
$correo      = trim($_POST['correo']);
$celular     = trim($_POST['celular']);
$tipo        = trim($_POST['tipo']);
$descripcion = trim($_POST['descripcion']);

if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
    out(false, 'El correo electrónico no es válido.');
}

$tipos_validos = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación'];
if (!in_array($tipo, $tipos_validos, true)) {
    out(false, 'Tipo de PQRS no válido.');
}

/* ── Validar longitudes máximas ─────────────────────────────── */
$longitudes = ['nombres' => 100, 'apellidos' => 100, 'celular' => 20, 'descripcion' => 600];
foreach ($longitudes as $campo => $max) {
    if (mb_strlen($$campo) > $max) {
        out(false, "El campo «{$campo}» supera la longitud permitida.");
    }
}

/* ── Validar formato de celular ─────────────────────────────── */
$celular_digits = preg_replace('/\D/', '', $celular);
if (strlen($celular_digits) < 7 || strlen($celular_digits) > 15) {
    out(false, 'El número de celular no es válido.');
}

/* ── Generar número de radicado ─────────────────────────────── */
$radicado = 'TCL-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));

/* ── Manejo del archivo adjunto ─────────────────────────────── */
$adjunto_url = null;

if (!empty($_FILES['adjunto']['name'])) {
    $file = $_FILES['adjunto'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        out(false, 'Error al recibir el archivo.');
    }
    if ($file['size'] > MAX_FILE_BYTES) {
        out(false, 'El archivo supera el límite de 10 MB.');
    }

    $ext_ok  = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
    $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $ext_ok, true)) {
        out(false, 'Tipo de archivo no permitido. Usa PDF, Word, JPG o PNG.');
    }

    $mime_ok = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
    ];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($file['tmp_name']);
    if (!in_array($mime, $mime_ok, true)) {
        out(false, 'El tipo MIME del archivo no está permitido.');
    }

    $upload_dir = __DIR__ . '/uploads/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0755, true);
    }

    $safe_name = date('YmdHis') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $upload_dir . $safe_name)) {
        out(false, 'No se pudo guardar el archivo en el servidor.');
    }

    $adjunto_url = rtrim(UPLOAD_URL, '/') . '/' . $safe_name;
}

/* ── Construir payload para Airtable ────────────────────────── */
$fields = [
    'Nombres'                     => $nombres,
    'Apellidos'                   => $apellidos,
    'Correo electronico'          => $correo,
    'Celular'                     => $celular,
    'Tipo PQRS'                   => $tipo,
    'Descripción'                 => $descripcion,
    'Radicado'                    => $radicado,
    'Confirmación y autorización' => true,
];

if ($adjunto_url !== null) {
    $fields['Adjuntar (opcional)'] = [['url' => $adjunto_url]];
}

$payload = json_encode(['fields' => $fields], JSON_UNESCAPED_UNICODE);

/* ── Enviar a Airtable ──────────────────────────────────────── */
$endpoint = sprintf(
    'https://api.airtable.com/v0/%s/%s',
    AIRTABLE_BASE_ID,
    rawurlencode(AIRTABLE_TABLE)
);

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . AIRTABLE_TOKEN,
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$body      = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_err  = curl_error($ch);
curl_close($ch);

if ($curl_err) {
    out(false, 'Error de conexión. Intenta más tarde.');
}

$response = json_decode($body, true);

if ($http_code === 200 || $http_code === 201) {
    send_confirmation_email($nombres, $apellidos, $correo, $tipo, $descripcion, $radicado);
    send_internal_notification($nombres, $apellidos, $correo, $celular, $tipo, $descripcion, $radicado, $adjunto_url);
    out(true, 'Solicitud enviada correctamente.', ['radicado' => $radicado]);
}

/* Error de Airtable */
out(false, 'No se pudo registrar la solicitud. Intenta más tarde.');

/* ── Helpers ────────────────────────────────────────────────── */
function out(bool $ok, string $msg, array $extra = []): void
{
    echo json_encode(array_merge(['success' => $ok, 'message' => $msg], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

function send_confirmation_email(
    string $nombres, string $apellidos, string $correo,
    string $tipo, string $descripcion, string $radicado
): void {
    $nombre_completo  = htmlspecialchars($nombres . ' ' . $apellidos);
    $tipo_h           = htmlspecialchars($tipo);
    $descripcion_h    = htmlspecialchars(mb_strimwidth($descripcion, 0, 200, '…'));
    $radicado_h       = htmlspecialchars($radicado);
    $fecha            = date('d/m/Y H:i');
    $subject          = "=?UTF-8?B?" . base64_encode("Confirmación PQRS — Radicado {$radicado}") . "?=";

    $html = <<<HTML
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
  <tr><td style="background:#2A4038;padding:28px 36px;">
    <p style="color:#fff;font-size:22px;font-weight:bold;margin:0;">TCL Asesores</p>
    <p style="color:rgba(255,255,255,0.65);font-size:13px;margin:4px 0 0;">Confirmación de PQRS recibida</p>
  </td></tr>
  <tr><td style="padding:32px 36px;">
    <p style="color:#333;font-size:15px;margin:0 0 16px;">Hola, <strong>{$nombre_completo}</strong>,</p>
    <p style="color:#555;font-size:14px;line-height:1.75;margin:0 0 24px;">
      Hemos recibido tu <strong>{$tipo_h}</strong> correctamente. Guarda el número de radicado para hacer seguimiento a tu caso.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f0;border-left:4px solid #2A4038;border-radius:4px;margin-bottom:24px;">
      <tr><td style="padding:18px 22px;">
        <p style="color:#6b8c82;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 6px;">Número de radicado</p>
        <p style="color:#2A4038;font-size:24px;font-weight:bold;letter-spacing:2px;margin:0;">{$radicado_h}</p>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:24px;font-size:13px;">
      <tr style="background:#fafafa;">
        <td style="padding:12px 16px;border-bottom:1px solid #eee;color:#888;width:40%;">Tipo de solicitud</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;color:#333;font-weight:600;">{$tipo_h}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;color:#888;">Fecha de radicación</td>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;color:#333;font-weight:600;">{$fecha}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#888;vertical-align:top;">Descripción</td>
        <td style="padding:12px 16px;color:#555;line-height:1.6;">{$descripcion_h}</td>
      </tr>
    </table>
    <p style="font-size:13px;line-height:1.7;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 16px;color:#555;margin:0;">
      ⏱ Recibirás nuestra respuesta en un plazo máximo de <strong>15 días hábiles</strong>, conforme a la normativa colombiana de atención al ciudadano.
    </p>
  </td></tr>
  <tr><td style="background:#f7f8f8;padding:18px 36px;border-top:1px solid #eee;">
    <p style="color:#999;font-size:12px;margin:0;">
      TCL Asesores &middot;
      <a href="mailto:info@tclasesores.com" style="color:#2A4038;text-decoration:none;">info@tclasesores.com</a> &middot;
      (+57) 305 2841365
    </p>
    <p style="color:#bbb;font-size:11px;margin:6px 0 0;">Este es un mensaje automático, por favor no respondas a este correo.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
HTML;

    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . MAIL_FROM_NAME . ' <' . MAIL_FROM . '>',
        'Reply-To: ' . MAIL_NOTIFY,
        'X-Mailer: PHP/' . PHP_VERSION,
    ]);

    mail($correo, $subject, $html, $headers);
}

function send_internal_notification(
    string $nombres, string $apellidos, string $correo, string $celular,
    string $tipo, string $descripcion, string $radicado, ?string $adjunto_url
): void {
    $subject = "=?UTF-8?B?" . base64_encode("[PQRS] Nueva {$tipo} — {$radicado}") . "?=";
    $adj_line = $adjunto_url
        ? '<tr><td style="padding:10px 16px;color:#888;border-bottom:1px solid #eee;">Adjunto</td><td style="padding:10px 16px;border-bottom:1px solid #eee;"><a href="' . htmlspecialchars($adjunto_url) . '">' . htmlspecialchars($adjunto_url) . '</a></td></tr>'
        : '';

    $html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;padding:24px;background:#f4f4f4;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;">
  <tr><td style="background:#2A4038;padding:20px 28px;">
    <p style="color:#fff;font-weight:bold;font-size:16px;margin:0;">Nueva PQRS recibida — ' . htmlspecialchars($radicado) . '</p>
  </td></tr>
  <tr><td style="padding:24px 28px;">
    <table width="100%" style="font-size:13px;border:1px solid #eee;border-radius:6px;">
      <tr style="background:#fafafa;"><td style="padding:10px 16px;color:#888;border-bottom:1px solid #eee;width:35%;">Radicado</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:bold;color:#2A4038;">' . htmlspecialchars($radicado) . '</td></tr>
      <tr><td style="padding:10px 16px;color:#888;border-bottom:1px solid #eee;">Tipo</td><td style="padding:10px 16px;border-bottom:1px solid #eee;">' . htmlspecialchars($tipo) . '</td></tr>
      <tr style="background:#fafafa;"><td style="padding:10px 16px;color:#888;border-bottom:1px solid #eee;">Nombre</td><td style="padding:10px 16px;border-bottom:1px solid #eee;">' . htmlspecialchars($nombres . ' ' . $apellidos) . '</td></tr>
      <tr><td style="padding:10px 16px;color:#888;border-bottom:1px solid #eee;">Correo</td><td style="padding:10px 16px;border-bottom:1px solid #eee;"><a href="mailto:' . htmlspecialchars($correo) . '">' . htmlspecialchars($correo) . '</a></td></tr>
      <tr style="background:#fafafa;"><td style="padding:10px 16px;color:#888;border-bottom:1px solid #eee;">Celular</td><td style="padding:10px 16px;border-bottom:1px solid #eee;">' . htmlspecialchars($celular) . '</td></tr>
      ' . $adj_line . '
      <tr><td style="padding:10px 16px;color:#888;vertical-align:top;">Descripción</td><td style="padding:10px 16px;color:#555;line-height:1.6;">' . nl2br(htmlspecialchars($descripcion)) . '</td></tr>
    </table>
  </td></tr>
</table>
</body></html>';

    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . MAIL_FROM_NAME . ' <' . MAIL_FROM . '>',
        'Reply-To: ' . $correo,
        'X-Mailer: PHP/' . PHP_VERSION,
    ]);

    mail(MAIL_NOTIFY, $subject, $html, $headers);
}
