<?php
/**
 * Namecheap API Proxy for Brandfletch Dev Studio
 * Deploy to: WHM/cPanel server (any domain's public_html)
 *
 * This script proxies Namecheap API calls from Vercel serverless functions
 * through the WHM server's static IP, which is whitelisted in Namecheap.
 *
 * Security:
 * - Requires a Bearer token (PROXY_SECRET) shared between Vercel and this script
 * - Namecheap API credentials are stored here on the server (not in Vercel)
 * - Only accepts POST requests from the proxy
 *
 * Deploy:
 * 1. Upload to public_html/namecheap-proxy.php (or any path)
 * 2. Set the NAMECHEAP_* constants below
 * 3. Set PROXY_SECRET to match the Vercel env var NAMECHEAP_PROXY_SECRET
 * 4. Whitelist this server's IP in Namecheap (Profile > Tools > API Access)
 * 5. Set NAMECHEAP_PROXY_URL in Vercel to https://yourdomain.com/namecheap-proxy.php
 */

// --- CONFIGURATION ---

// Shared secret between Vercel and this proxy (set in Vercel as NAMECHEAP_PROXY_SECRET)
const PROXY_SECRET = 'CHANGE_THIS_TO_A_LONG_RANDOM_STRING';

// Namecheap API credentials (keep these on the server, not in Vercel)
const NC_API_USER  = 'YOUR_NAMECHEAP_USERNAME';
const NC_API_KEY   = 'YOUR_NAMECHEAP_API_KEY';
const NC_SANDBOX   = false; // set to true for sandbox testing

// --- END CONFIGURATION ---

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Validate Bearer token
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
$token = '';

if (preg_match('/Bearer\s+(.+)/i', $authHeader, $m)) {
    $token = trim($m[1]);
}

if ($token !== PROXY_SECRET) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Read the request body (JSON: { command: "...", params: { ... } })
$rawBody = file_get_contents('php://input');
$request = json_decode($rawBody, true);

if (!$request || !isset($request['command'])) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing command parameter']);
    exit;
}

// Build the Namecheap API request
$baseUrl = NC_SANDBOX
    ? 'https://api.sandbox.namecheap.com/xml.response'
    : 'https://api.namecheap.com/xml.response';

// Start with auth params (stored on server, not sent from Vercel)
$params = [
    'ApiUser'  => NC_API_USER,
    'ApiKey'   => NC_API_KEY,
    'UserName' => NC_API_USER,
    'ClientIp' => $_SERVER['SERVER_ADDR'] ?: '127.0.0.1',
    'Command'  => $request['command']
];

// Merge in command-specific params from Vercel
if (isset($request['params']) && is_array($request['params'])) {
    foreach ($request['params'] as $key => $value) {
        $params[$key] = $value;
    }
}

// Add contact info if configured locally (optional — overrides Vercel-provided contacts)
// Uncomment and fill in if you want the server to provide registrant contact info:
/*
$contactFields = [
    'FirstName', 'LastName', 'Address1', 'City',
    'StateProvince', 'PostalCode', 'Country', 'EmailAddress', 'Phone'
];
$contactPrefixes = ['Registrant', 'Tech', 'Admin', 'AuxBilling'];
foreach ($contactPrefixes as $prefix) {
    foreach ($contactFields as $field) {
        $envKey = 'NC_CONTACT_' . strtoupper($field);
        if (defined($envKey)) {
            $params[$prefix . $field] = constant($envKey);
        }
    }
}
*/

// Build query string
$queryString = http_build_query($params);
$apiUrl = $baseUrl . '?' . $queryString;

// Forward the request to Namecheap
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $apiUrl,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $queryString,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/x-www-form-urlencoded'
    ]
]);

$response = curl_exec($apiUrl);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Failed to connect to Namecheap API', 'details' => $curlError]);
    exit;
}

// Return the XML response as-is (Vercel side parses it)
http_response_code($httpCode);
header('Content-Type: application/xml');
echo $response;
