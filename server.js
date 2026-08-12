const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8000;
const PROJECT_DIR = __dirname;

const DEFAULT_RATES = {
    transmission: 1.4074,
    systemLoss: 0.7994,
    distTier1: 0.9803,
    distTier2: 1.2908,
    distTier3: 1.5837,
    distTier4: 2.0941,
    meteringFixed: 5.0,
    meteringPerKwh: 0.3350,
    supplyFixed: 16.3800,
    supplyPerKwh: 0.4979,
    awatRefund: -0.4278,
    regReset: -0.0023,
    vatGen: 0.0941,
    vatTrans: 0.1126,
    vatSysLoss: 0.0966,
    vatOthers: 0.1200,
    rptRate: 0.0062,
    lftRate: 0.0050,
    universalRate: 0.3216,
    fitAll: 0.2011,
    lifelineRate: 0.0100,
    seniorRate: 0.0001
};

function performCalculation(kwh, genRate, otherCharges) {
    const genCost = Math.round(kwh * genRate * 100) / 100;
    const transCost = Math.round(kwh * DEFAULT_RATES.transmission * 100) / 100;
    const sysLossCost = Math.round(kwh * DEFAULT_RATES.systemLoss * 100) / 100;

    let distRate;
    if (kwh <= 200) distRate = DEFAULT_RATES.distTier1;
    else if (kwh <= 300) distRate = DEFAULT_RATES.distTier2;
    else if (kwh <= 400) distRate = DEFAULT_RATES.distTier3;
    else distRate = DEFAULT_RATES.distTier4;

    const distCost = Math.round(kwh * distRate * 100) / 100;
    const meteringCost = kwh === 0 ? 0 : Math.round(kwh * DEFAULT_RATES.meteringPerKwh * 100) / 100 + DEFAULT_RATES.meteringFixed;
    const supplyCost = kwh === 0 ? 0 : Math.round(kwh * DEFAULT_RATES.supplyPerKwh * 100) / 100 + DEFAULT_RATES.supplyFixed;
    const awatRefund = Math.round(kwh * DEFAULT_RATES.awatRefund * 100) / 100;
    const regReset = Math.round(kwh * DEFAULT_RATES.regReset * 100) / 100;
    const seniorCost = Math.round(kwh * DEFAULT_RATES.seniorRate * 100) / 100;

    const genVat = Math.round(genCost * DEFAULT_RATES.vatGen * 100) / 100;
    const transVat = Math.round(transCost * DEFAULT_RATES.vatTrans * 100) / 100;
    const sysLossVat = Math.round(sysLossCost * DEFAULT_RATES.vatSysLoss * 100) / 100;

    const distTotal = distCost + meteringCost + supplyCost + awatRefund + regReset;
    const distVat = Math.round(distTotal * DEFAULT_RATES.vatOthers * 100) / 100;
    const seniorVat = Math.round(seniorCost * DEFAULT_RATES.vatOthers * 100) / 100;
    const totalVat = genVat + transVat + sysLossVat + distVat + seniorVat;

    const rptCost = Math.round(kwh * DEFAULT_RATES.rptRate * 100) / 100;
    const lftBase = genCost + transCost + sysLossCost + distTotal + seniorCost + rptCost;
    const lftCost = Math.round(lftBase * DEFAULT_RATES.lftRate * 100) / 100;
    const govTaxesTotal = rptCost + lftCost + totalVat;

    const universalChargesTotal = Math.round(kwh * DEFAULT_RATES.universalRate * 100) / 100;
    const fitAllCost = Math.round(kwh * DEFAULT_RATES.fitAll * 100) / 100;
    const lifelineCost = Math.round(kwh * DEFAULT_RATES.lifelineRate * 100) / 100;
    const nonVatSubsidiesTotal = universalChargesTotal + fitAllCost + lifelineCost;

    const energyAmount = genCost + transCost + sysLossCost + distTotal + seniorCost + govTaxesTotal + nonVatSubsidiesTotal;
    const totalBill = energyAmount + otherCharges;

    return {
        success: true,
        input: { kwh, generation_rate: genRate, other_charges: otherCharges },
        summary: {
            total_bill: Math.round(totalBill * 100) / 100,
            energy_cost: Math.round(energyAmount * 100) / 100,
            other_charges: Math.round(otherCharges * 100) / 100
        },
        itemized: {
            generation_charge: genCost,
            transmission_charge: transCost,
            system_loss_charge: sysLossCost,
            distribution_charge: distCost,
            metering_supply_charge: Math.round((meteringCost + supplyCost) * 100) / 100,
            subsidies_and_refunds: Math.round((awatRefund + regReset + seniorCost) * 100) / 100,
            government_taxes_and_vat: Math.round(govTaxesTotal * 100) / 100,
            universal_charges_and_fitall: Math.round(nonVatSubsidiesTotal * 100) / 100
        }
    };
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function sendCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
}

const server = http.createServer((req, res) => {
    sendCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    if (pathname === '/') {
        pathname = '/index.html';
    }

    // API Routes
    if (pathname === '/api/rates' || pathname === '/api/rates.py') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const ratesPath = path.join(PROJECT_DIR, 'rates.json');
        if (fs.existsSync(ratesPath)) {
            fs.createReadStream(ratesPath).pipe(res);
        } else {
            res.end(JSON.stringify({ rates: DEFAULT_RATES }));
        }
        return;
    }

    if (pathname === '/api/appliances' || pathname === '/api/appliances.py') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const dbPath = path.join(PROJECT_DIR, 'appliance_db.json');
        if (fs.existsSync(dbPath)) {
            fs.createReadStream(dbPath).pipe(res);
        } else {
            res.end(JSON.stringify({ appliances: [] }));
        }
        return;
    }

    if (pathname === '/api/calculate' || pathname === '/api/calculate.py') {
        if (req.method === 'GET') {
            const kwh = parseFloat(parsedUrl.query.kwh || 0);
            const genRate = parseFloat(parsedUrl.query.gen_rate || 9.2504);
            const other = parseFloat(parsedUrl.query.other || 0);
            const result = performCalculation(kwh, genRate, other);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result, null, 2));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                let payload = {};
                try { payload = JSON.parse(body); } catch (e) {}
                const kwh = parseFloat(payload.kwh || 0);
                const genRate = parseFloat(payload.generation_rate || payload.gen_rate || 9.2504);
                const other = parseFloat(payload.other_charges || payload.other || 0);
                const result = performCalculation(kwh, genRate, other);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result, null, 2));
            });
        }
        return;
    }

    // Static Files
    let filePath = path.join(PROJECT_DIR, pathname);
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`PowerForecast Local Web & API Server running on http://localhost:${PORT}`);
});
