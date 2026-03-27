const http = require('http');

const BASE_URL = 'http://localhost:5000';
let token = '';
let userId = 2;
let orderId = '';

// Helper to make HTTP requests
const makeRequest = (method, path, body = null, auth = false) => {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (auth && token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

// Test suite
const runTests = async () => {
  console.log('\n========== API TEST SUITE ==========\n');

  try {
    // 1. Register user
    console.log('1️⃣ TEST: Register User');
    let res = await makeRequest('POST', '/api/users/register', {
      email: 'testapi@test.com',
      password: '123456',
      phone: '0901111111',
      full_name: 'API Test User'
    });
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      console.log('✅ User registered');
      userId = res.body.data?.id || 2;
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 2. Login
    console.log('2️⃣ TEST: Login');
    res = await makeRequest('POST', '/api/users/login', {
      email: 'testapi@test.com',
      password: '123456'
    });
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      token = res.body.data?.token;
      console.log(`✅ Login successful, token: ${token.substring(0, 20)}...`);
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 3. Get event details with ticket types
    console.log('3️⃣ TEST: Get Event Details');
    res = await makeRequest('GET', '/api/events/1/details');
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      console.log(`✅ Event: ${res.body.data?.event?.title}`);
      console.log(`   Ticket Types:`);
      res.body.data?.ticketTypes?.forEach(tt => {
        console.log(`   - ${tt.name}: ${tt.price} VND (Available: ${tt.available})`);
      });
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 4. Create order
    console.log('4️⃣ TEST: Create Order');
    res = await makeRequest('POST', '/api/users/orders/create', {
      items: [
        { ticket_type_id: 1, quantity: 1 },
        { ticket_type_id: 2, quantity: 2 }
      ]
    }, true);
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      orderId = res.body.data?.orderId;
      console.log(`✅ Order created: ${res.body.data?.orderCode}`);
      console.log(`   Total: ${res.body.data?.totalAmount} VND`);
      console.log(`   Tickets: ${res.body.data?.ticketsGenerated}`);
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 5. Get order detail
    console.log('5️⃣ TEST: Get Order Detail');
    res = await makeRequest('GET', `/api/users/orders/${orderId}`, null, true);
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      console.log(`✅ Order code: ${res.body.data?.order?.order_code}`);
      console.log(`   Items: ${res.body.data?.items?.length}`);
      console.log(`   Tickets: ${res.body.data?.tickets?.length}`);
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 6. Process payment
    console.log('6️⃣ TEST: Process Payment');
    res = await makeRequest('POST', '/api/payments/process', {
      orderId: orderId,
      paymentMethod: 'creditcard'
    }, true);
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      console.log(`✅ Payment successful`);
      console.log(`   Status: ${res.body.data?.paymentStatus}`);
      console.log(`   Reference: ${res.body.data?.paymentReference}`);
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 7. Get user tickets
    console.log('7️⃣ TEST: Get User Tickets');
    res = await makeRequest('GET', '/api/users/tickets/', null, true);
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      console.log(`✅ User has ${res.body.data?.length} tickets`);
      if (res.body.data?.length > 0) {
        const ticket = res.body.data[0];
        console.log(`   Sample: ${ticket.ticket_code} (${ticket.ticket_type_name})`);
      }
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 8. Get user orders
    console.log('8️⃣ TEST: Get User Orders');
    res = await makeRequest('GET', '/api/users/orders', null, true);
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      console.log(`✅ User has ${res.body.data?.length} orders`);
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 9. Check-in ticket
    if (res.body.success && res.body.data?.length > 0) {
      const firstOrder = res.body.data[0];
      
      // Get ticket from order detail
      const orderRes = await makeRequest('GET', `/api/users/orders/${firstOrder.id}`, null, true);
      if (orderRes.body.data?.tickets?.length > 0) {
        const ticketCode = orderRes.body.data.tickets[0].ticket_code;
        
        console.log('9️⃣ TEST: Check-in Ticket');
        res = await makeRequest('POST', '/api/checkins/check-in', {
          ticketCode: ticketCode
        }, true);
        console.log(`Status: ${res.status}`);
        if (res.body.success) {
          console.log(`✅ Check-in successful`);
          console.log(`   Ticket: ${res.body.data?.ticketCode}`);
          console.log(`   Event: ${res.body.data?.eventTitle}`);
        } else {
          console.log('❌ Error:', res.body.message);
        }
        console.log('');
      }
    }

    // 10. Get event check-in stats
    console.log('🔟 TEST: Get Check-in Stats');
    res = await makeRequest('GET', '/api/checkins/events/1/stats', null, true);
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      console.log(`✅ Check-in stats:`);
      console.log(`   Total: ${res.body.data?.totalTickets}`);
      console.log(`   Checked in: ${res.body.data?.checkedIn}`);
      console.log(`   Rate: ${res.body.data?.percentage}`);
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    // 11. Get payment status
    console.log('1️⃣1️⃣ TEST: Get Payment Status');
    res = await makeRequest('GET', `/api/payments/${orderId}/status`, null, true);
    console.log(`Status: ${res.status}`);
    if (res.body.success) {
      console.log(`✅ Payment status: ${res.body.data?.payment_status}`);
    } else {
      console.log('❌ Error:', res.body.message);
    }
    console.log('');

    console.log('========== TEST COMPLETE ==========\n');

  } catch (error) {
    console.error('Test error:', error.message);
  }
};

// Run tests
runTests().then(() => process.exit(0));
