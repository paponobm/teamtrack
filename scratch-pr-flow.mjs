import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-gpu'] })

// Step 1: login as prtest BEFORE any permission granted, confirm PR Management hidden
const page1 = await browser.newPage()
await page1.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page1.type('input[type="email"]', 'prtest@gmail.com')
await page1.type('input[type="password"]', 'password123')
await Promise.all([
    page1.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => null),
    page1.click('button[type="submit"]'),
])
await new Promise(r => setTimeout(r, 1500))
const beforeText = await page1.evaluate(() => document.body.innerText)
console.log('PR Management visible BEFORE grant:', beforeText.includes('PR Management'))
await page1.close()
