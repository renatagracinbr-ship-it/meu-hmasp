const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputImage = path.join(__dirname, 'Arquivos', 'Novo simbolo HMASP.png');
const outputDir = path.join(__dirname, 'mobile', 'public', 'icons');

// Criar diretorio se nao existir
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
    console.log('Gerando icones PWA...');

    for (const size of sizes) {
        const outputPath = path.join(outputDir, `icon-${size}.png`);

        await sharp(inputImage)
            .resize(size, size, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toFile(outputPath);

        console.log(`  Criado: icon-${size}.png`);
    }

    console.log('Icones gerados com sucesso!');
}

generateIcons().catch(console.error);
