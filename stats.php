<?php
/**
 * Stats endpoint — devuelve el total real de PQRS registradas en Airtable.
 * Se cachea 5 minutos para no sobrecargar la API.
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

$cache_file = sys_get_temp_dir() . '/pqrs_stats.json';
$cache_ttl  = 300;

if (is_file($cache_file) && (time() - filemtime($cache_file)) < $cache_ttl) {
    echo file_get_contents($cache_file);
    exit;
}

$total  = 0;
$offset = null;

do {
    $url = sprintf(
        'https://api.airtable.com/v0/%s/%s?fields[]=Radicado&pageSize=100',
        AIRTABLE_BASE_ID,
        rawurlencode(AIRTABLE_TABLE)
    );
    if ($offset) $url .= '&offset=' . urlencode($offset);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . AIRTABLE_TOKEN],
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err || $code !== 200 || !$body) break;

    $data    = json_decode($body, true);
    $total  += count($data['records'] ?? []);
    $offset  = $data['offset'] ?? null;

} while ($offset);

$result = json_encode(['total' => $total]);
file_put_contents($cache_file, $result, LOCK_EX);
echo $result;
