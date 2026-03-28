async function test() {
  const email = 'test.student3@test.com'; 
  await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', displayName: 'Test Student 3', role: 'student', accessCode: 'startup_school' })
  });
  
  // Get token
  let res = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', role: 'student' })
  });
  const loginBody = await res.json();
  const token = loginBody.data?.accessToken;

  // Student trying to access admin route
  res = await fetch('http://localhost:5000/api/admin/users', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Admin Route Status (Expect 403):", res.status);
  console.log("Admin Route Body:", await res.text());

  // No token
  res = await fetch('http://localhost:5000/api/users/me', {
    method: 'GET'
  });
  console.log("No Token Status (Expect 401):", res.status);
  console.log("No Token Body:", await res.text());
}

test().catch(console.error);
