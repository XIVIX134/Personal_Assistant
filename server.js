import dotenv from 'dotenv';
import express from 'express';
import Queue from 'bull';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';
import winston from 'winston';
import multer from 'multer';
import { validationResult, body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { createWorker } from 'tesseract.js';
import ffmpeg from 'fluent-ffmpeg';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS
app.use(cors({
    origin: '*', // In production, specify your client's origin
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*', // In production, specify your client's origin
        methods: ['GET', 'POST']
    }
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Setup Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'chat-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Setup Bull queue
const audioQueue = new Queue('audio transcription', process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Ensure uploads directory exists
try {
    await fs.access('uploads');
} catch {
    await fs.mkdir('uploads').then(() => logger.info('Created uploads directory'));
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage: storage });

const defaultSafetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

let messageIdCounter = 0;

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use('/api', apiLimiter);

// Use 'server' instead of 'app' to listen
server.listen(port, () => {
    console.log(`HTTP Server running on http://localhost:${port}`);
  });

io.on('connection', (socket) => {
    logger.info('User connected');
    socket.on('disconnect', () => logger.info('User disconnected'));
});

app.post('/api/send-message', upload.array('file', 5), async (req, res) => {
    try {
        logger.info('Received message request');
        const message = req.body.message || '';
        const files = req.files || [];
        
        // Process the message and files here
        // For now, we'll just echo the message back
        
        res.json({ success: true, message: 'Message received: ' + message });
        logger.info('Message processed successfully');
    } catch (error) {
        logger.error('Error in /api/send-message:', { error: error.message, stack: error.stack });
        res.status(500).json({ error: 'An error occurred while processing your message.' });
    }
});

app.post('/api/chat', 
    upload.array('file', 5), 
    body('message').trim().escape(),
    async (req, res) => {
        const errors = validationResult(req);
        logger.info('Received chat request');
        if (!errors.isEmpty()) {
            logger.warn('Invalid chat request', { errors: errors.array() });
            return res.status(400).json({ errors: errors.array() });
        }

        const currentMessageId = messageIdCounter++;
        const message = req.body.message || '';
        const safetySettings = req.body.safetySettings || defaultSafetySettings;
        let processedFiles = []; // Initialize processedFiles array here, outside of the try block

        try {
            let parts = [{ text: message }];

            if (req.files && req.files.length > 0) {
                processedFiles = await Promise.all(req.files.map(processFile));
                parts.push(...processedFiles.map(file => file.part));
            }

            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-pro",
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 2048,
                    topK: 40,
                    topP: 0.95,
                },
                safetySettings,
            });

            const result = await model.generateContentStream(parts);
            
            for await (const chunk of result.stream) {
                io.emit('ai-response', { 
                    messageId: currentMessageId, 
                    chunkText: chunk.text(), 
                    done: false 
                });
            }
            
            io.emit('ai-response', { 
                messageId: currentMessageId, 
                chunkText: '', 
                done: true 
            });

            res.json({ success: true, message: 'Response sent successfully', messageId: currentMessageId });
            logger.info('Chat response sent successfully', { messageId: currentMessageId });
        } catch (error) {
            handleChatError(error, res, currentMessageId);
        } finally {
            // Only attempt to delete files if processedFiles exists and has items
            if (processedFiles.length > 0) {
                await Promise.all(processedFiles.map(file => fs.unlink(file.path).catch(err => {
                    logger.error('Error deleting file:', { error: err.message, file: file.path });
                })));
            }
        }
    }
);

async function processFile(file) {
    const fileContent = await fs.readFile(file.path);
    let part = { inlineData: { data: fileContent.toString('base64'), mimeType: file.mimetype } };

    if (file.mimetype.startsWith('image/')) {
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(file.path);
        await worker.terminate();
        part.text = text;
    } else if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
        const audioPath = `${file.path}.mp3`;
        await new Promise((resolve, reject) => {
            ffmpeg(file.path)
                .outputOptions('-vn')
                .save(audioPath)
                .on('end', resolve)
                .on('error', reject);
        });
        // Add audio transcription job to the queue
        const job = await audioQueue.add({ audioPath });
        const result = await job.finished();
        part.text = result.transcription;
        await fs.unlink(audioPath);
    } else {
        part.text = fileContent.toString('utf-8');
    }

    return { path: file.path, part };
}

function handleChatError(error, res, currentMessageId) {
    logger.error(`Error in chat route for message ID ${currentMessageId}:`, { error: error.message, stack: error.stack });
    io.emit('ai-response', { messageId: currentMessageId, chunkText: 'An error occurred while processing your request.', done: true });
    res.status(500).json({ error: 'An error occurred while processing your request. Please try again.' });
}

// Audio transcription worker
audioQueue.process(async (job) => {
    const { audioPath } = job.data;
    try {
        // Implement your audio transcription logic here
        // For example, using a service like Google Speech-to-Text
        const transcription = await transcribeAudio(audioPath);
        return { transcription };
    } catch (error) {
        logger.error('Error transcribing audio:', error);
        throw error;
    }
});

// Implement transcribeAudio function here
async function transcribeAudio(audioPath) {
    // Implement your audio transcription logic
    // This is a placeholder implementation
    return "This is a placeholder transcription.";
}

// Add these error handling middlewares
app.use((req, res, next) => {
    logger.warn('404 Not Found', { url: req.originalUrl });
    res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Something broke!' });
});


