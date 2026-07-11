const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    console.log('Navigating to Shilajit page...');
    await page.goto('http://localhost:3000/products/shilajit.html');
    
    // wait a bit for JS to render
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Waiting for + button...');
    const plusBtn = await page.$('button[onclick*="el.value=Math.min"]');
    if (!plusBtn) {
       console.log('Plus button not found!');
    } else {
       console.log('Clicking + button...');
       await plusBtn.click();
       
       const qty = await page.$eval('input.qty-input', el => el.value);
       console.log('QTY after click:', qty);
    }
    
    console.log('Clicking Add to Cart...');
    const addBtn = await page.$('button[onclick^="addToCart"]');
    if (addBtn) {
        // Handle alert
        page.on('dialog', async dialog => {
            console.log('DIALOG:', dialog.message());
            await dialog.accept();
        });
        await addBtn.click();
    }
    
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
})();
