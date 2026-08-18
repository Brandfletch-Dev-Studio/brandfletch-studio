# Namecheap API Proxy — Deployment Guide

## Why this exists

Namecheap requires API calls to come from a whitelisted IP. Vercel serverless
functions use dynamic IPs, so we route Namecheap API calls through this proxy
on the WHM/cPanel server, which has a static IP.

## Setup steps

### 1. Whitelist the server IP in Namecheap

- Log in to Namecheap
- Go to Profile > Tools > Namecheap API Access
- Click MANAGE
- Add the WHM server's IP address to the whitelist
- Enable API access
- Copy the API key

### 2. Deploy the proxy script

Upload `namecheap-proxy.php` to any cPanel account on the WHM server:

```
public_html/namecheap-proxy.php
```

Or create a dedicated subdomain:
```
api.yourdomain.com/namecheap-proxy.php
```

### 3. Configure the proxy script

Edit the constants at the top of `namecheap-proxy.php`:

```php
const PROXY_SECRET = 'a-long-random-string-here'; // shared with Vercel
const NC_API_USER  = 'your_namecheap_username';
const NC_API_KEY   = 'your_namecheap_api_key';
const NC_SANDBOX   = false; // true for sandbox testing
```

Generate a random secret:
```bash
openssl rand -hex 32
```

### 4. Set Vercel environment variables

```
NAMECHEAP_PROXY_URL=https://your-whm-domain.com/namecheap-proxy.php
NAMECHEAP_PROXY_SECRET=<same random string as PROXY_SECRET>
```

### 5. Test

```bash
# From any machine:
curl -X POST https://your-whm-domain.com/namecheap-proxy.php \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"command":"namecheap.domains.check","params":{"DomainList":"test123abc.com"}}'
```

You should get an XML response with availability info.

### 6. Optional: Set registrant contact info on the proxy

If you want domain registrations to use a specific contact address,
uncomment the contact section in the PHP script and fill in the fields.
Otherwise, Namecheap uses the account's default address.
