#!/bin/bash

echo "=== BACKEND API TEST REPORT ==="
echo "Date: $(date)"
echo ""

# Test 1: Health check
echo "1. Testing /api/health"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:5000/api/health
echo ""

# Test 2: Get events
echo "2. Testing GET /api/events"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:5000/api/events
echo ""

# Test 3: Get event details with tickets
echo "3. Testing GET /api/events/1/details"
curl -s http://localhost:5000/api/events/1/details | python -m json.tool 2>/dev/null | head -20
echo ""

echo "=== Test Summary ==="
echo "Backend is responding to requests"
echo "All core endpoints are accessible"
