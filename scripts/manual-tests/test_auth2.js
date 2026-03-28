async function test() {
  const email = 'test.student2@test.com';
  // Register Capacity
  let res = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'Test1234!',
      displayName: 'Test Student 2',
      role: 'student',
      accessCode: 'startup_school'
    })
  });
  console.log("Register Capacity Status:", res.status);
  console.log("Register Capacity Body:", await res.text());
}

test().catch(console.error);
