async function test() {
  // Register
  let res = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test.student@test.com',
      password: 'Test1234!',
      displayName: 'Test Student',
      role: 'student',
      accessCode: 'startup_school'
    })
  });
  console.log("Register Status:", res.status);
  console.log("Register Body:", await res.text());
  console.log("Register Headers:", res.headers);
}

test().catch(console.error);
