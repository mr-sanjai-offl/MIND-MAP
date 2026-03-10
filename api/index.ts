import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const app = express();

// On Vercel, files are located relative to the root or the function
// Use __dirname or process.cwd() carefully
const CONTENT_DIR = path.resolve(process.cwd(), 'content');

app.use(cors());
app.use(express.json());

// Diagnostic endpoint
app.get('/api/debug', (req, res) => {
    res.json({
        cwd: process.cwd(),
        dirname: __dirname,
        contentDirExists: fs.existsSync(CONTENT_DIR),
        contentDirFiles: fs.existsSync(CONTENT_DIR) ? fs.readdirSync(CONTENT_DIR) : [],
        env: process.env.NODE_ENV
    });
});

// Get all mindmaps (list of topics)
app.get('/api/mindmaps', (req, res) => {
    try {
        console.log('Fetching from:', CONTENT_DIR);

        if (!fs.existsSync(CONTENT_DIR)) {
            console.error('CRITICAL: Content directory missing at:', CONTENT_DIR);
            return res.status(404).json({
                error: 'Content directory not found',
                path: CONTENT_DIR,
                suggestion: 'Check vercel.json includeFiles config'
            });
        }

        const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
        const mindmaps = files.map(file => {
            const fullPath = path.join(CONTENT_DIR, file);
            const content = fs.readFileSync(fullPath, 'utf8');
            const { data } = matter(content);

            let title = data.title;
            if (!title) {
                const match = content.match(/^#\s+(.*)/m);
                title = match ? match[1].trim() : file.replace('.md', '');
            }

            return {
                id: file.replace('.md', ''),
                title: title,
                icon: data.icon || '🧠'
            };
        });
        res.json(mindmaps);
    } catch (err: any) {
        console.error('API Error:', err);
        res.status(500).json({
            error: 'Failed to fetch mindmaps',
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Get specific mindmap content
app.get('/api/mindmaps/:id', (req, res) => {
    const { id } = req.params;
    const filePath = path.join(CONTENT_DIR, `${id}.md`);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.send(content);
        } else {
            res.status(404).json({
                error: 'Mindmap not found',
                requestedId: id,
                checkedPath: filePath
            });
        }
    } catch (err: any) {
        console.error('API Error:', err);
        res.status(500).json({
            error: 'Failed to fetch mindmap content',
            message: err.message
        });
    }
});

export default app;
