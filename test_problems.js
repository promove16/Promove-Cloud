async function test() {
  const email = 'test.student4' + Date.now() + '@test.com'; 
  let res = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', displayName: 'Test Student 4', role: 'student', accessCode: 'startup_school' })
  });
  const registerBody = await res.json();
  const token = registerBody.data?.accessToken;
  if (!token) console.error("No token!", registerBody);

  // Get problems
  res = await fetch('http://localhost:5000/api/problems?category=Agriculture&limit=5', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  let data = await res.json().catch(() => null);
  console.log("Get problems:", res.status, data);
  
  // Search problems
  res = await fetch('http://localhost:5000/api/problems?search=irrigation', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  data = await res.json();
  console.log("Search problems:", res.status, data.data?.length);

  // We need a proper problem. The seed data for problems should exist if the server started.
  // The tests expect the seed script `seedProblemsIfEmpty()` to populate the DB.
  res = await fetch('http://localhost:5000/api/problems', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const allProblems = await res.json();
  const problemsToClaim = allProblems.data?.slice(0, 4); // Need 4 for max workspace test
  
  if (problemsToClaim?.length < 4) {
    console.log("Not enough problems seeded:", problemsToClaim?.length);
    return;
  }

  const p1 = problemsToClaim[0]._id;

  // Claim problem
  res = await fetch(`http://localhost:5000/api/problems/${p1}/claim`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Claim 1 Status:", res.status);
  
  // Claim same problem again
  res = await fetch(`http://localhost:5000/api/problems/${p1}/claim`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log("Claim Same Again Status (Expect 400):", res.status);
  
  // Create 3 workspaces then try 4th
  for (let i = 1; i < problemsToClaim.length; i++) {
    const res2 = await fetch(`http://localhost:5000/api/problems/${problemsToClaim[i]._id}/claim`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Claim ${i+1} Status:`, res2.status);
    console.log(`Claim ${i+1} Body:`, await res2.json());
  }
}

test().catch(console.error);
