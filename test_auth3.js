async function test() {
  const email = 'test.student@test.com'; // User we registered earlier
  
  // Login Role Mismatch
  let res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', role: 'investor' })
  });
  console.log("Login Mismatch Status:", res.status);
  console.log("Login Mismatch Body:", await res.text());

  // Login Success
  res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', role: 'student' })
  });
  console.log("Login Success Status:", res.status);
  const loginBody = await res.json();
  const token = loginBody.data?.accessToken;
  const setCookie = res.headers.get('set-cookie');
  console.log("Login Success Token:", token ? "Exists" : "Missing");

  // Get Profile
  res = await fetch('http://localhost:5000/api/users/me', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Profile Status:", res.status);
  const profileBody = await res.json();
  console.log("Profile Contains Password Hash?", !!profileBody.data?.passwordHash);

  // Token Refresh
  const refreshTokenMatch = setCookie ? setCookie.match(/refreshToken=([^;]+)/) : null;
  const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;

  res = await fetch('http://localhost:5000/api/auth/refresh', {
    method: 'POST',
    headers: { 'Cookie': `refreshToken=${refreshToken}` }
  });
  console.log("Refresh Status:", res.status);
  const refreshBody = await res.json();
  console.log("Refresh Token Exists:", !!refreshBody.data?.accessToken);

  // Rate Limiter
  let lastStatus;
  for (let i = 0; i < 12; i++) {
    res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong', role: 'student' })
    });
    lastStatus = res.status;
  }
  console.log("Rate Limiter Last Status (Expect 429):", lastStatus);
}

test().catch(console.error);
