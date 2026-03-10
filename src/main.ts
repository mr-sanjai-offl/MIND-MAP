/* ===================================================
   SANJAI'S MIND MAP ENGINE – TURBO POLISHED V2.1
   Bug Fixes: Root Title, Redundancy, Responsiveness
   =================================================== */

interface NodeData {
    id: string;
    title: string;
    icon?: string;
    content?: string;
    themeColor?: string;
    children: NodeData[];
}

let categories: NodeData[] = [];
let svgEl: SVGElement | null = null;
let currentScale = 1;
let currentPanX = 0;
let currentPanY = 0;

// Performance: Redraw throttling
let redrawTimeout: any = null;
function requestRedraw() {
    if (redrawTimeout) return;
    redrawTimeout = setTimeout(() => {
        drawAllConnectors();
        redrawTimeout = null;
    }, 16); // ~60fps
}

document.addEventListener('DOMContentLoaded', () => {
    initHome();
    initCursor();
    initParticles();
    initDragPanZoom();
    initExpandedStatus();
    initKeyboard();
    initHelp();
    initSearch();
    initBrandHome();

    svgEl = document.getElementById('mmSvg') as unknown as SVGElement;

    // Configure Marked
    if ((window as any).marked) {
        (window as any).marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });
    }
});

/* ========================================
   HOME / SELECTION LOGIC
   ======================================== */
async function initHome() {
    const topicGrid = document.getElementById('topicGrid');
    const homeView = document.getElementById('homeView');
    const mmViewport = document.getElementById('mmViewport');
    const backBtn = document.getElementById('backBtn');
    const currentTopicLabel = document.getElementById('currentTopic');
    const zoomControls = document.getElementById('zoomControls');
    const resetBtn = document.getElementById('resetBtn');
    const expandAllBtn = document.getElementById('expandAllBtn');
    const statusCounts = document.getElementById('statusCounts');
    const searchWrap = document.getElementById('searchWrap');

    if (!topicGrid || !homeView || !mmViewport || !backBtn || !currentTopicLabel || !zoomControls || !resetBtn || !expandAllBtn || !statusCounts) return;

    try {
        const response = await fetch('/api/mindmaps');
        const topics = await response.json();

        topicGrid.innerHTML = '';
        topics.forEach((topic: any) => {
            const card = document.createElement('div');
            card.className = 'topic-card';
            card.innerHTML = `
                <div class="topic-icon">${topic.icon || '🧠'}</div>
                <div class="topic-name">${topic.title}</div>
                <button class="topic-btn">Explore Map</button>
            `;
            card.onclick = () => loadCustomMindMap(topic.id, topic.title);
            topicGrid.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load topics:', err);
    }

    backBtn.onclick = () => {
        homeView.style.display = 'flex';
        mmViewport.style.display = 'none';
        zoomControls.style.display = 'none';
        resetBtn.style.display = 'none';
        expandAllBtn.style.display = 'none';
        backBtn.style.display = 'none';
        statusCounts.style.display = 'none';
        if (searchWrap) searchWrap.style.display = 'none';
        currentTopicLabel.textContent = 'Select a Topic';
        document.body.classList.remove('is-mindmap');
    };
}

async function loadCustomMindMap(id: string, title: string) {
    const homeView = document.getElementById('homeView');
    const mmViewport = document.getElementById('mmViewport');
    const backBtn = document.getElementById('backBtn');
    const currentTopicLabel = document.getElementById('currentTopic');
    const zoomControls = document.getElementById('zoomControls');
    const resetBtn = document.getElementById('resetBtn');
    const expandAllBtn = document.getElementById('expandAllBtn');
    const rootTitleEl = document.getElementById('rootTitle');
    const statusCounts = document.getElementById('statusCounts');
    const searchWrap = document.getElementById('searchWrap');

    if (!homeView || !mmViewport || !backBtn || !currentTopicLabel || !zoomControls || !resetBtn || !expandAllBtn || !rootTitleEl || !statusCounts) return;

    try {
        const response = await fetch(`/api/mindmaps/${id}`);
        const markdown = await response.text();

        // PARSE MARKDOWN
        const data = parseMarkdownAdvanced(markdown);
        categories = data.children;

        // Setup UI
        homeView.style.display = 'none';
        mmViewport.style.display = 'block';
        zoomControls.style.display = 'flex';
        resetBtn.style.display = 'block';
        expandAllBtn.style.display = 'block';
        backBtn.style.display = 'block';
        statusCounts.style.display = 'block';
        if (searchWrap) searchWrap.style.display = 'flex';

        currentTopicLabel.textContent = title;
        rootTitleEl.textContent = data.title;
        document.body.classList.add('is-mindmap');

        // Render
        renderBranches();
        initInteractions();

        setTimeout(() => {
            doReset();
            centerRoot();
            requestRedraw();
            updateStatus();
        }, 100);

    } catch (err) {
        console.error('Failed to load mind map:', err);
    }
}

/* ========================================
   RECURSIVE ADVANCED PARSER
   ======================================== */
function parseMarkdownAdvanced(md: string): NodeData {
    const lines = md.split('\n');
    let root: NodeData = { id: 'root', title: 'Mind Map', children: [] };
    let nodeStack: { level: number, node: NodeData }[] = [{ level: -1, node: root }];

    const colors = ['cyan', 'violet', 'amber', 'red', 'green'];
    let colorIdx = 0;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('---')) return;

        let level = -1;
        let content = '';
        let isList = false;

        // Detect Headers
        const headMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headMatch) {
            level = headMatch[1].length - 1; // H1=0, H2=1...
            content = headMatch[2];

            // FIX: If H1 (# root), update root title instead of adding as child
            if (level === 0) {
                root.title = extractTitle(content);
                return;
            }
        }
        // Detect Lists (including nested)
        else {
            const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);
            if (listMatch) {
                const indent = listMatch[1].length;
                level = 1 + Math.floor(indent / 2); // Map indent to levels starting after H2
                content = listMatch[3];
                isList = true;
            }
        }

        if (level === -1) return; // Skip non-structured lines

        const newNode: NodeData = {
            id: 'node-' + Math.random().toString(36).substr(2, 9),
            title: extractTitle(content),
            icon: extractEmoji(content) || (isList ? '🎯' : '📂'),
            content: content,
            children: []
        };

        // Assign Colors to Top-Level Categories (Level 1)
        if (level === 1) {
            newNode.themeColor = colors[colorIdx % colors.length];
            colorIdx++;
        }

        // Parent management via stack
        while (nodeStack.length > 1 && nodeStack[nodeStack.length - 1].level >= level) {
            nodeStack.pop();
        }

        const parent = nodeStack[nodeStack.length - 1].node;
        parent.children.push(newNode);
        nodeStack.push({ level, node: newNode });
    });

    return root;
}

function extractEmoji(str: string): string | null {
    const match = str.match(/[\u{1F300}-\u{1F9FF}]/gu);
    return match ? match[0] : null;
}

function extractTitle(str: string): string {
    return str.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').split('.')[0].trim();
}

function renderContent(md: string, nodeTitle: string): string {
    let cleanMd = md;

    // FIX Redundancy: Remove the title if it's the first line
    const lines = md.split('\n');
    if (lines.length > 0 && extractTitle(lines[0]) === nodeTitle) {
        lines.shift();
        cleanMd = lines.join('\n');
    }

    let html = cleanMd;
    if ((window as any).marked) {
        html = (window as any).marked.parse(cleanMd);
    }
    // Highlighting parity
    html = html.replace(/==(.*?)==/g, '<mark>$1</mark>');

    // KaTeX inline $eqn$ parity
    html = html.replace(/\$(.*?)\$/g, (_, eqn) => {
        if ((window as any).katex) {
            try { return (window as any).katex.renderToString(eqn, { throwOnError: false }); } catch (ans) { return eqn; }
        }
        return eqn;
    });

    return html;
}

/* ========================================
   BRAND HOME NAVIGATION
   ======================================== */
function initBrandHome() {
    const brand = document.getElementById('homeLink');
    const backBtn = document.getElementById('backBtn');
    if (brand && backBtn) {
        brand.onclick = () => {
            if (backBtn.style.display !== 'none') backBtn.click();
        };
    }
}

/* ========================================
   SEARCH LOGIC
   ======================================== */
function initSearch() {
    const input = document.getElementById('searchInput') as HTMLInputElement;
    if (!input) return;

    input.addEventListener('input', () => {
        const q = input.value.toLowerCase().trim();
        const nodes = document.querySelectorAll('.mm-node');

        if (!q) {
            nodes.forEach(n => n.classList.remove('search-match', 'search-dim'));
            return;
        }

        nodes.forEach(node => {
            const text = node.textContent?.toLowerCase() || '';
            const isMatch = text.includes(q);

            if (isMatch) {
                node.classList.add('search-match');
                node.classList.remove('search-dim');
                expandToNode(node as HTMLElement);
            } else {
                node.classList.remove('search-match');
                node.classList.add('search-dim');
            }
        });

        requestRedraw();
    });
}

function expandToNode(node: HTMLElement) {
    const branch = node.closest('.mm-branch') as HTMLElement;
    if (branch && !branch.classList.contains('is-open')) {
        const cat = branch.querySelector('.mm-cat');
        if (cat) (cat as HTMLElement).click();
    }

    let parentTw = node.parentElement?.closest('.mm-tw') as HTMLElement;
    while (parentTw) {
        if (!parentTw.classList.contains('is-open')) {
            const parentTopic = parentTw.querySelector('.mm-topic') as HTMLElement;
            if (parentTopic) parentTopic.click();
        }
        parentTw = parentTw.parentElement?.closest('.mm-tw') as HTMLElement;
    }
}

/* ========================================
   HELP SECTION
   ======================================== */
function initHelp() {
    const helpBtn = document.getElementById('helpBtn');
    const overlay = document.getElementById('helpOverlay');
    const closeBtn = document.getElementById('helpClose');
    if (!helpBtn || !overlay || !closeBtn) return;

    helpBtn.onclick = () => overlay.classList.add('is-active');
    closeBtn.onclick = () => overlay.classList.remove('is-active');
    overlay.onclick = (e) => { if (e.target === overlay) overlay.classList.remove('is-active'); };
}

/* ========================================
   RENDERING ENGINE (Advanced recursive support)
   ======================================== */
function renderBranches() {
    const container = document.getElementById('mmBranches');
    if (!container) return;
    container.innerHTML = '';

    categories.forEach(cat => {
        const branch = document.createElement('div');
        branch.className = 'mm-branch';
        branch.dataset.branch = '';
        branch.dataset.color = cat.themeColor || 'cyan';

        const catNode = document.createElement('div');
        catNode.className = `mm-node mm-cat ${cat.themeColor ? `mm-cat-${cat.themeColor}` : ''}`;
        catNode.dataset.cat = '';
        catNode.innerHTML = `
            <span class="mm-emoji">${cat.icon || '📁'}</span>
            <span>${cat.title}</span>
            <span class="mm-count">${cat.children.length}</span>
            <span class="mm-fork">‹‹</span>
        `;

        const topics = document.createElement('div');
        topics.className = 'mm-topics';

        cat.children.forEach(topic => {
            topics.appendChild(renderRecursiveNode(topic, cat.themeColor));
        });

        branch.appendChild(catNode);
        branch.appendChild(topics);
        container.appendChild(branch);
    });
}

function renderRecursiveNode(node: NodeData, themeColor?: string): HTMLElement {
    const tw = document.createElement('div');
    tw.className = 'mm-tw';

    const nodeEl = document.createElement('div');
    nodeEl.className = `mm-node mm-topic ${themeColor ? `mm-topic-${themeColor}` : ''}`;
    nodeEl.dataset.topic = '';
    nodeEl.innerHTML = `
        <span class="mm-emoji">${node.icon || '📄'}</span> 
        <span class="mm-title-text">${node.title}</span>
        ${node.children.length > 0 ? `<span class="mm-count">${node.children.length}</span>` : ''}
    `;

    const detail = document.createElement('div');
    detail.className = 'mm-detail';

    let detailContent = renderContent(node.content || '', node.title);
    if (node.children.length > 0) {
        const subList = document.createElement('div');
        subList.className = 'mm-sub-children';
        node.children.forEach(child => {
            subList.appendChild(renderRecursiveNode(child, themeColor));
        });
        detailContent += subList.outerHTML;
    }

    detail.innerHTML = `<div class="mm-rich-wrap">${detailContent}</div>`;

    tw.appendChild(nodeEl);
    tw.appendChild(detail);
    return tw;
}

function initInteractions() {
    document.querySelectorAll('[data-cat]').forEach(cat => {
        cat.addEventListener('click', e => {
            e.stopPropagation();
            const branch = (cat as HTMLElement).closest('.mm-branch') as HTMLElement;
            if (!branch.querySelector('.mm-topics')) return;

            if (branch.classList.contains('is-open')) {
                branch.classList.remove('is-open');
                branch.querySelectorAll('.mm-tw.is-open').forEach(tw => {
                    tw.classList.remove('is-open');
                    const d = tw.querySelector('.mm-detail') as HTMLElement; if (d) d.style.maxHeight = '0';
                });
                removeBranchCurves(branch);
            } else {
                branch.classList.add('is-open');
                setTimeout(() => drawBranchCurves(branch), 100);
            }
            setTimeout(() => { centerRoot(); requestRedraw(); updateStatus(); }, 400);
        });
    });

    document.querySelectorAll('[data-topic]').forEach(topic => {
        topic.addEventListener('click', e => {
            e.stopPropagation();
            const tw = (topic as HTMLElement).closest('.mm-tw') as HTMLElement;
            const detail = tw.querySelector('.mm-detail') as HTMLElement; if (!detail) return;

            if (tw.classList.contains('is-open')) {
                detail.style.maxHeight = '0'; tw.classList.remove('is-open');
            } else {
                detail.style.maxHeight = 'none'; // Clear for scroll calculation
                const h = detail.scrollHeight;
                detail.style.maxHeight = '0px';
                void detail.offsetHeight; // Force reflow
                detail.style.maxHeight = h + 'px';
                tw.classList.add('is-open');
            }

            const br = tw.closest('.mm-branch') as HTMLElement;
            setTimeout(() => {
                if (br.classList.contains('is-open')) { drawBranchCurves(br); centerRoot(); requestRedraw(); }
            }, 350);
        });
    });
}

function initExpandedStatus() {
    const btn = document.getElementById('expandAllBtn');
    if (!btn) return;
    let allOpen = false;
    btn.addEventListener('click', () => {
        allOpen = !allOpen;
        if (allOpen) {
            document.querySelectorAll('.mm-branch').forEach((br, i) => {
                setTimeout(() => {
                    if (!br.classList.contains('is-open')) {
                        br.classList.add('is-open');
                        setTimeout(() => drawBranchCurves(br as HTMLElement), 120);
                    }
                }, i * 50);
            });
            setTimeout(() => { centerRoot(); requestRedraw(); updateStatus(); }, 700);
            btn.textContent = 'Collapse All';
        } else {
            document.querySelectorAll('.mm-branch.is-open').forEach(br => {
                br.classList.remove('is-open');
                br.querySelectorAll('.mm-tw.is-open').forEach(tw => {
                    tw.classList.remove('is-open');
                    const d = tw.querySelector('.mm-detail') as HTMLElement; if (d) d.style.maxHeight = '0';
                });
                removeBranchCurves(br as HTMLElement);
            });
            setTimeout(() => { centerRoot(); requestRedraw(); updateStatus(); }, 300);
            btn.textContent = 'Expand All';
        }
    });
}

function updateStatus() {
    const countEl = document.getElementById('statusCounts');
    if (countEl) {
        const cats = document.querySelectorAll('.mm-branch').length;
        const topics = document.querySelectorAll('.mm-tw').length;
        countEl.textContent = `${cats} categories · ${topics} nodes`;
    }
}

/* ========================================
   CONNECTOR LOGIC
   ======================================== */
function drawAllConnectors() {
    drawSpine();
    document.querySelectorAll('.mm-branch.is-open').forEach(br => drawBranchCurves(br as HTMLElement));
}

function drawSpine() {
    if (!svgEl) return;
    svgEl.querySelectorAll('.mm-spine-path').forEach(p => p.remove());

    const canvas = document.getElementById('mmCanvas') as HTMLElement;
    const root = document.getElementById('rootNode') as HTMLElement;
    const branches = document.querySelectorAll('.mm-branch');
    if (!root || !branches.length) return;

    const rPos = posOf(root, canvas);
    const rx = rPos.x + root.offsetWidth;
    const ry = rPos.y + root.offsetHeight / 2;

    const cats: any[] = [];
    branches.forEach(br => {
        const catNode = (br as HTMLElement).querySelector('.mm-cat') as HTMLElement;
        const cPos = posOf(catNode, canvas);
        const color = (br as HTMLElement).dataset.color || 'cyan';
        cats.push({ left: cPos.x, cy: cPos.y + catNode.offsetHeight / 2, color });
    });

    if (!cats.length) return;
    const spineX = rx + (cats[0].left - rx) / 2;

    svgEl.appendChild(mkPath(`M ${rx} ${ry} L ${spineX} ${ry}`, 'mm-spine-path'));
    const topY = Math.min(ry, cats[0].cy);
    const btmY = Math.max(ry, cats[cats.length - 1].cy);
    svgEl.appendChild(mkPath(`M ${spineX} ${topY} L ${spineX} ${btmY}`, 'mm-spine-path'));

    cats.forEach(c => {
        svgEl.appendChild(mkPath(`M ${spineX} ${c.cy} L ${c.left} ${c.cy}`, `mm-spine-path mm-conn-${c.color}`));
    });
}

function drawBranchCurves(branch: HTMLElement) {
    removeBranchCurves(branch);
    const canvas = document.getElementById('mmCanvas') as HTMLElement;
    const cat = branch.querySelector('.mm-cat') as HTMLElement;
    const topics = branch.querySelectorAll(':scope > .mm-topics > .mm-tw > .mm-topic');
    if (!cat || !topics.length) return;

    const color = branch.dataset.color || 'cyan';
    const brIdx = Array.from(document.querySelectorAll('.mm-branch')).indexOf(branch);
    const groupCls = `mm-curve-b${brIdx}`;

    const cPos = posOf(cat, canvas);
    const fx = cPos.x + cat.offsetWidth;
    const fy = cPos.y + cat.offsetHeight / 2;

    const pts: any[] = [];
    topics.forEach(t => {
        const tPos = posOf(t as HTMLElement, canvas);
        pts.push({ tx: tPos.x, ty: tPos.y + (t as HTMLElement).offsetHeight / 2 });
    });

    const midX = fx + (pts[0].tx - fx) * 0.5;
    const R = 6;

    pts.forEach(pt => {
        const dy = pt.ty - fy;
        let pStr;
        if (Math.abs(dy) < R * 2) {
            pStr = `M ${fx} ${fy} L ${pt.tx} ${pt.ty}`;
        } else if (dy > 0) {
            pStr = `M ${fx} ${fy} L ${midX - R} ${fy} Q ${midX} ${fy} ${midX} ${fy + R} L ${midX} ${pt.ty - R} Q ${midX} ${pt.ty} ${midX + R} ${pt.ty} L ${pt.tx} ${pt.ty}`;
        } else {
            pStr = `M ${fx} ${fy} L ${midX - R} ${fy} Q ${midX} ${fy} ${midX} ${fy - R} L ${midX} ${pt.ty + R} Q ${midX} ${pt.ty} ${midX + R} ${pt.ty} L ${pt.tx} ${pt.ty}`;
        }
        const p = mkPath(pStr, `mm-branch-curve ${groupCls} mm-conn-${color}`);
        p.classList.add('mm-path-active');
        svgEl!.appendChild(p);
    });
}

function removeBranchCurves(br: HTMLElement) {
    const i = Array.from(document.querySelectorAll('.mm-branch')).indexOf(br);
    if (svgEl) svgEl.querySelectorAll(`.mm-curve-b${i}`).forEach(p => p.remove());
}

/* ========================================
   UTILS & POSITIONING
   ======================================== */
function posOf(el: HTMLElement, ancestor: HTMLElement) {
    let x = 0, y = 0, cur: HTMLElement | null = el;
    while (cur && cur !== ancestor) {
        x += cur.offsetLeft;
        y += cur.offsetTop;
        cur = cur.offsetParent as HTMLElement;
    }
    return { x, y };
}

function mkPath(d: string, cls: string) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    if (cls) p.setAttribute('class', cls);
    return p;
}

function centerRoot() {
    const root = document.getElementById('rootNode');
    const branches = document.getElementById('mmBranches');
    if (!root || !branches) return;
    root.style.marginTop = '0';
    requestAnimationFrame(() => {
        const bH = (branches as HTMLElement).offsetHeight;
        const rH = (root as HTMLElement).offsetHeight;
        const bTop = (branches as HTMLElement).offsetTop;
        const rTop = (root as HTMLElement).offsetTop;
        const bCenter = bTop + bH / 2;
        const rCenter = rTop + rH / 2;
        const diff = bCenter - rCenter;
        if (diff > 0) root.style.marginTop = diff + 'px';
    });
}

/* ========================================
   DRAG / PAN / ZOOM
   ======================================== */
function initDragPanZoom() {
    const viewport = document.getElementById('mmViewport');
    const canvas = document.getElementById('mmCanvas');
    if (!viewport || !canvas) return;
    let isDragging = false, startX: number, startY: number;
    const MIN_S = 0.3, MAX_S = 3.0;

    function apply(smooth: boolean) {
        canvas!.style.transition = smooth ? 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' : '';
        canvas!.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentScale})`;
        updateZoomLabel();
    }

    viewport.addEventListener('mousedown', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.mm-node, .mm-detail, button, a, input, .help-modal')) return;
        isDragging = true;
        startX = e.clientX - currentPanX; startY = e.clientY - currentPanY;
        viewport.classList.add('is-dragging');
    });
    window.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return;
        currentPanX = e.clientX - startX; currentPanY = e.clientY - startY;
        apply(false);
    });
    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false; viewport.classList.remove('is-dragging');
    });

    viewport.addEventListener('wheel', (e: WheelEvent) => {
        if (document.getElementById('mmViewport')?.style.display === 'none') return;
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const cx = (mx - currentPanX) / currentScale;
        const cy = (my - currentPanY) / currentScale;
        const d = -e.deltaY * 0.001;
        const ns = Math.min(MAX_S, Math.max(MIN_S, currentScale * (1 + d)));
        currentPanX = mx - cx * ns; currentPanY = my - cy * ns;
        currentScale = ns;
        apply(false);
        requestRedraw();
    }, { passive: false });

    document.getElementById('resetBtn')?.addEventListener('click', doReset);
    document.getElementById('zoomIn')?.addEventListener('click', () => stepZoom(0.15));
    document.getElementById('zoomOut')?.addEventListener('click', () => stepZoom(-0.15));
}

function doReset() {
    currentPanX = 0; currentPanY = 0; currentScale = 1;
    const canvas = document.getElementById('mmCanvas');
    if (!canvas) return;
    canvas.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
    canvas.style.transform = `translate(0px, 0px) scale(1)`;
    updateZoomLabel();
    setTimeout(() => { canvas.style.transition = ''; requestRedraw(); }, 500);
}

function stepZoom(d: number) {
    const vp = document.getElementById('mmViewport');
    if (!vp || vp.style.display === 'none') return;
    const r = vp.getBoundingClientRect();
    const mx = r.width / 2, my = r.height / 2;
    const cx = (mx - currentPanX) / currentScale;
    const cy = (my - currentPanY) / currentScale;
    currentScale = Math.min(3.0, Math.max(0.3, currentScale + d));
    currentPanX = mx - cx * currentScale;
    currentPanY = my - cy * currentScale;

    const canvas = document.getElementById('mmCanvas');
    if (canvas) {
        canvas.style.transition = 'transform 0.3s ease';
        canvas.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentScale})`;
        updateZoomLabel();
    }
    setTimeout(requestRedraw, 350);
}

function updateZoomLabel() {
    const el = document.getElementById('zoomLevel');
    if (el) el.textContent = Math.round(currentScale * 100) + '%';
}

/* ========================================
   COMMON UI COMPONENTS (Cursor, Particles, Keyboard)
   ======================================== */
function initCursor() {
    const dot = document.getElementById('cursorDot');
    const glow = document.getElementById('cursorGlow');
    if (!dot || !glow) return;
    let mx = -100, my = -100, gx = -100, gy = -100;
    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        dot.style.left = mx + 'px'; dot.style.top = my + 'px';
    });
    (function trail() {
        gx += (mx - gx) * 0.2; gy += (my - gy) * 0.2;
        glow.style.left = gx + 'px'; glow.style.top = gy + 'px';
        requestAnimationFrame(trail);
    })();
    const sel = 'a, button, .mm-node, .topic-card, input, .topbar-brand';
    document.addEventListener('mouseover', e => {
        const target = e.target as HTMLElement;
        if (target.closest(sel)) { dot.classList.add('is-hover'); glow.classList.add('is-hover'); }
    });
    document.addEventListener('mouseout', e => {
        const target = e.target as HTMLElement;
        if (target.closest(sel)) { dot.classList.remove('is-hover'); glow.classList.remove('is-hover'); }
    });
}

function initParticles() {
    const c = document.getElementById('particleCanvas') as HTMLCanvasElement;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let mouseX = -999, mouseY = -999;
    function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    const ps: any[] = [];
    const n = Math.min(60, Math.floor(window.innerWidth / 25));
    for (let i = 0; i < n; i++)
        ps.push({
            x: Math.random() * c.width, y: Math.random() * c.height,
            vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.2 + 0.4
        });
    (function draw() {
        ctx!.clearRect(0, 0, c.width, c.height);
        ps.forEach(p => {
            const dxM = mouseX - p.x, dyM = mouseY - p.y;
            const distM = Math.sqrt(dxM * dxM + dyM * dyM);
            if (distM < 150) {
                const f = (150 - distM) / 150 * 0.5;
                p.vx += (dxM / distM) * f; p.vy += (dyM / distM) * f;
            }
            p.vx *= 0.98; p.vy *= 0.98;
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
            if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
            ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx!.fillStyle = `rgba(0,229,255,0.25)`; ctx!.fill();
        });
        requestAnimationFrame(draw);
    })();
}

function initKeyboard() {
    document.addEventListener('keydown', e => {
        if (document.getElementById('mmViewport')?.style.display === 'none') return;
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        switch (e.key) {
            case ' ': e.preventDefault(); doReset(); break;
            case 'e': case 'E': (document.getElementById('expandAllBtn') as HTMLElement).click(); break;
            case '+': case '=': e.preventDefault(); stepZoom(0.2); break;
            case '-': case '_': e.preventDefault(); stepZoom(-0.2); break;
        }
    });
}
