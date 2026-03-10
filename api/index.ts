import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const app = express();
app.use(cors());
app.use(express.json());

// Hardened Path Resolution for Vercel
const getCONTENT_DIR = () => {
    // Strategy 1: process.cwd()
    const cwdPath = path.join(process.cwd(), 'content');
    if (fs.existsSync(cwdPath)) return cwdPath;

    // Strategy 2: Relative to __dirname (if available in this env)
    try {
        const relPath = path.resolve('./content');
        if (fs.existsSync(relPath)) return relPath;
    } catch (e) { }

    return cwdPath; // Fallback
};

app.get('/api/debug', (req, res) => {
    const contentDir = getCONTENT_DIR();
    res.json({
        cwd: process.cwd(),
        contentDir,
        exists: fs.existsSync(contentDir),
        files: fs.existsSync(contentDir) ? fs.readdirSync(contentDir) : [],
        node: process.version
    });
});

app.get('/api/mindmaps', (req, res) => {
    try {
        const contentDir = getCONTENT_DIR();
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
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error', message: (err as Error).message });
    }
});

app.get('/api/mindmaps/:id', (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(getCONTENT_DIR(), `${id}.md`);

        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.send(content);
        } else {
            res.status(404).json({ error: 'Not Found', id });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error', message: (err as Error).message });
    }
});

export default app;
