require('dotenv').config();

const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const UPLOAD_DIR = './uploads';
const LOGS_DIR = './logs';

// Create directories if they don't exist
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

const APP_PORT = process.env.APP_PORT || 3000;

function log(message, level = 'info') {
    const now = new Date();
    const prefix = level === 'error' ? 'ERROR: ' : '';
    const logMessage = `[${now.toISOString()}] ${prefix}${message}`;

    // Log to console
    switch(level) {
        case 'error':
            console.error(logMessage);
            break;
        default:
            console.log(logMessage);
    }

    // Log to file
    const currentDate = now.toISOString().split('T')[0];
    const logFile = path.join(LOGS_DIR, `${currentDate}.log`);
    fs.appendFileSync(logFile, logMessage + '\n');
}

app.get('/process-image', async (req, res) => {
    const { imageUrl } = req.query;
    if (!imageUrl) return res.status(400).send('No imageUrl provided in query.');

    try {
        // Download the image
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const originalBuffer = Buffer.from(response.data, 'binary');

        // Get image dimensions
        const { width, height } = await sharp(originalBuffer).metadata();
        const currentRatio = width / height;

        // Add padding to make it 1.91:1
        let processedBuffer;
        if (currentRatio > 1.91) {
            const newHeight = Math.round(width / 1.91);
            const paddingTop = Math.round((newHeight - height) / 2);
            const paddingBottom = newHeight - height - paddingTop;
            processedBuffer = await sharp(originalBuffer)
                .extend({
                    top: paddingTop,
                    bottom: paddingBottom,
                    left: 0,
                    right: 0,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .toBuffer();
        } else if (currentRatio < 1.91) {
            const newWidth = Math.round(height * 1.91);
            const paddingLeft = Math.round((newWidth - width) / 2);
            const paddingRight = newWidth - width - paddingLeft;
            processedBuffer = await sharp(originalBuffer)
                .extend({
                    left: paddingLeft,
                    right: paddingRight,
                    top: 0,
                    bottom: 0,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                })
                .toBuffer();
        } else {
            processedBuffer = originalBuffer;
        }

        // Generate random MD5 hash as filename
        const randomString = crypto.randomBytes(16).toString('hex'); // 32 chars long
        const extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const processedFilename = `${randomString}${extension}`;
        const processedPath = path.join(UPLOAD_DIR, processedFilename);

        // Save processed image
        await fs.promises.writeFile(processedPath, processedBuffer);

        log(`Processed image: ${processedFilename}, from URL: ${imageUrl}`);

        // Return direct download link
        const downloadLink = `${req.protocol}://${req.get('host')}/download/${processedFilename}`;
        res.json({ downloadLink });

    } catch (error) {
        log(error.message || error, 'error');
        res.status(500).send('Error processing image.');
    }
});

// Serve processed images for download
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(path.join(__dirname, UPLOAD_DIR, filename))) {
        res.sendFile(filePath, { root: __dirname });
    } else {
        res.status(404).send('File not found.');
    }
});

app.listen(APP_PORT, () => {
    log(`Server running on port ${APP_PORT}`);
});