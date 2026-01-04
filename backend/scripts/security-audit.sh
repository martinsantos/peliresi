#!/bin/bash
# Security Audit Script for SITREP
# Run this periodically to check security posture

echo "=========================================="
echo "🔐 SITREP Security Audit - $(date)"
echo "=========================================="

# 1. NPM Audit
echo -e "\n📦 NPM Vulnerabilities:"
echo "----------------------------------------"
cd /home/sitrep.ultimamilla.com.ar 2>/dev/null || cd ../..
npm audit --production 2>/dev/null || echo "Run from project directory"

# 2. Check file permissions
echo -e "\n📁 World-writable files (should be none):"
echo "----------------------------------------"
find /var/www/sitrep-prod -type f -perm /o+w 2>/dev/null
find /home/sitrep.ultimamilla.com.ar -type f -perm /o+w 2>/dev/null

# 3. Check exposed ports
echo -e "\n🔌 Listening Ports:"
echo "----------------------------------------"
netstat -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $7}' | sort -u

# 4. Check for .env in git
echo -e "\n🔑 Sensitive files in git (should be none):"
echo "----------------------------------------"
git ls-files | grep -E "\.env$|\.pem$|password|secret" 2>/dev/null || echo "None found"

# 5. SSL Certificate expiry
echo -e "\n🔒 SSL Certificate Status:"
echo "----------------------------------------"
if [ -f /etc/letsencrypt/live/ultimamilla.com.ar/cert.pem ]; then
  openssl x509 -enddate -noout -in /etc/letsencrypt/live/ultimamilla.com.ar/cert.pem
else
  echo "Certificate not found at expected path"
fi

# 6. Check JWT secrets
echo -e "\n🎫 JWT Configuration:"
echo "----------------------------------------"
if [ -f .env ]; then
  grep -E "JWT_SECRET|JWT_REFRESH" .env | wc -l | xargs -I {} echo "{} JWT secrets configured"
fi

# 7. CORS configuration
echo -e "\n🌐 CORS Check:"
echo "----------------------------------------"
curl -s -I -X OPTIONS https://sitrep.ultimamilla.com.ar/api/health \
  -H "Origin: https://malicious-site.com" 2>/dev/null | grep -i "access-control" || echo "CORS check requires server access"

# 8. Rate limiting check
echo -e "\n🚦 Rate Limiting Status:"
echo "----------------------------------------"
grep -r "limit_req" /etc/nginx/sites-enabled/ 2>/dev/null || echo "Check nginx config for rate limiting"

# 9. Security headers
echo -e "\n🛡️ Security Headers:"
echo "----------------------------------------"
curl -s -I https://sitrep.ultimamilla.com.ar 2>/dev/null | grep -iE "(x-frame|x-content-type|strict-transport|x-xss)" || echo "Run from server with access"

echo -e "\n=========================================="
echo "✅ Audit Complete"
echo "=========================================="
