import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const app = express();

// On Vercel, content is relative to the function in /api
const CONTENT_DIR = path.join(process.cwd(), 'content');

app.use(cors());
app.use(express.json());

// Get all mindmaps (list of topics)
app.get('/api/mindmaps', (req, res) => {
    try {
        if (!fs.existsSync(CONTENT_DIR)) {
            console.error('Content directory not found at:', CONTENT_DIR);
            return res.json([]);
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
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Failed to fetch mindmaps' });
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
            res.status(404).json({ error: 'Mindmap not found' });
        }
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Failed to fetch mindmap content' });
    }
});

export default app;
