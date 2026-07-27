async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/leaves/admin');
        const text = await res.text();
        console.log("Response:", res.status, text);
    } catch(e) {
        console.error(e);
    }
}
test();
