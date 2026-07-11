const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://localhost:3000/');
    
    await new Promise(r => setTimeout(r, 2000));
    const html = await page.$eval('#dynamic-homepage-products', el => el.innerHTML);
    console.log('HTML length:', html.length);
    
    await browser.close();
})();
