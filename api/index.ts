import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const app = express();
app.use(cors());
app.use(express.json());

// Pathing: On Vercel, the function runs from /var/task
// The 'content' directory should be at the root of the project
const getRepoRoot = () => process.cwd();
const getContentDir = () => path.join(getRepoRoot(), 'content');

// Diagnostic Root
app.get('/api', (req, res) => {
    res.json({
        status: 'online',
        message: "Sanjai's Mind Map API",
        time: new Date().toISOString()
    });
});

app.get('/api/debug', (req, res) => {
    const root = getRepoRoot();
    const content = getContentDir();
    res.json({
        cwd: root,
        dirname: __dirname,
        contentPath: content,
        contentExists: fs.existsSync(content),
        contentFiles: fs.existsSync(content) ? fs.readdirSync(content) : [],
        node_version: process.version
    });
});

app.get('/api/mindmaps', (req, res) => {
    try {
        const contentDir = getContentDir();
        if (!fs.existsSync(contentDir)) {
            return res.status(404).json({ error: 'Content directory missing', path: contentDir });
        }

        const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
        const mindmaps = files.map(file => {
            const fullPath = path.join(contentDir, file);
            const fileData = fs.readFileSync(fullPath, 'utf8');
            const { data } = matter(fileData);

            let title = data.title;
            if (!title) {
                const match = fileData.match(/^#\s+(.*)/m);
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
        res.status(500).json({ error: 'Internal Server Error', detail: err.message });
    }
});

app.get('/api/mindmaps/:id', (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(getContentDir(), `${id}.md`);

        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.send(content);
        } else {
            res.status(404).json({ error: 'Not Found', id });
        }
    } catch (err: any) {
        res.status(500).json({ error: 'Internal Server Error', detail: err.message });
    }
});

export default app;
