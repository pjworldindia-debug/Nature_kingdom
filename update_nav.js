const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const navMatch = indexHtml.match(/<nav[\s\S]*?<\/nav>/);
if (!navMatch) throw new Error("Could not find nav in index.html");
const newNav = navMatch[0];

const filesToUpdate = [
    'public/products/shilajit.html',
    'public/products/sea-buckthorn.html',
    'public/products/stevia.html',
    'public/cart.html',
    'public/checkout.html',
    'public/account/dashboard.html',
    'public/account/login.html'
];

for (const file of filesToUpdate) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/<nav[\s\S]*?<\/nav>/, newNav);
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
}
