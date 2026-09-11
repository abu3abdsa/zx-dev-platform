const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// === Discord Settings ===
const DISCORD_CLIENT_ID = '1547918079231787011';
const DISCORD_CLIENT_SECRET = '3NZD9geOv2q9h0hBzM78ytWT7pWady9z';
const DISCORD_REDIRECT_URI = 'http://localhost:3000/auth/discord/callback';
const DISCORD_GUILD_ID = '1541698099003527170';
const DISCORD_BOT_TOKEN = 'MTU0NzkxODA3OTIzMTc4NzAxMQ.GOojIA.DwUWB8gEsfdC06I72khFRQeNs9N0KNfqLTmGW0';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1548032231442751519/gEqfNsJZzXyDVHt8brnl-DPCQWZsINI0NUotgFSq1HZlg9wUOAWuxy4xaJY8djaZt2k-';

// Admin Role
const ADMIN_ROLE_ID = '1547919582302306435';

// Data Files
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const BANNED_FILE = path.join(__dirname, 'banned.json');

let projects = [];
let bannedUsers = [];

// Load or Initialize Data
if (fs.existsSync(PROJECTS_FILE)) {
    try { projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); } catch (e) { projects = []; }
} else {
    projects = [
        { 
            id: 1, 
            title: 'Porsche 911 GT3 RS', 
            category: 'cars', 
            type: 'free', 
            requiredRoles: [], 
            fileUrl: 'https://example.com/files/porsche.zip',
            description: 'Realistic Porsche with custom handling, real engine sounds, and LED lighting.', 
            thumbnail: 'https://images.unsplash.com/photo-1503376760302-832c1945c225?w=500', 
            images: [
                'https://images.unsplash.com/photo-1503376760302-832c1945c225?w=800',
                'https://images.unsplash.com/photo-1614200187524-dc4b892acf16?w=800',
                'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800'
            ],
            video: 'https://www.w3schools.com/html/mov_bbb.mp4',
            downloads: 0 
        }
    ];
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

if (fs.existsSync(BANNED_FILE)) {
    try { bannedUsers = JSON.parse(fs.readFileSync(BANNED_FILE, 'utf8')); } catch (e) { bannedUsers = []; }
}

const saveProjects = () => fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
const saveBanned = () => fs.writeFileSync(BANNED_FILE, JSON.stringify(bannedUsers, null, 2));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'zx_dev_persistent_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

let guildRoles = [];

const sendLog = async (title, description, color = 0x00ff00) => {
    if (!WEBHOOK_URL) return;
    try {
        await axios.post(WEBHOOK_URL, {
            embeds: [{ title, description, color, timestamp: new Date().toISOString() }]
        });
    } catch (err) { console.error('Webhook Error:', err.message); }
};

const fetchGuildRoles = async () => {
    if (!DISCORD_BOT_TOKEN) return;
    try {
        const res = await axios.get(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/roles`, {
            headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
        });
        guildRoles = res.data;
    } catch (err) { console.error('Error fetching guild roles:', err.message); }
};
fetchGuildRoles();

// Routes
app.get('/auth/discord', (req, res) => {
    const scope = encodeURIComponent('identify guilds guilds.members.read');
    const redirect = encodeURIComponent(DISCORD_REDIRECT_URI);
    res.redirect(`https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=${scope}`);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/?error=no_code');

    try {
        const tokenRes = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: DISCORD_REDIRECT_URI
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenRes.data.access_token;
        const userRes = await axios.get('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
        const user = userRes.data;

        if (bannedUsers.includes(user.id)) {
            return res.redirect('/?error=banned');
        }

        let userRoleIds = [];
        let mappedRoles = [];

        try {
            const memberRes = await axios.get(`https://discord.com/api/v10/users/@me/guilds/${DISCORD_GUILD_ID}/member`, { 
                headers: { Authorization: `Bearer ${accessToken}` } 
            });
            
            console.log("Fetched Member Roles Data:", memberRes.data);

            userRoleIds = memberRes.data.roles || [];
            mappedRoles = userRoleIds.map(id => {
                const found = guildRoles.find(r => r.id === id);
                return found ? { id, name: found.name } : { id, name: `Role (${id})` };
            });
        } catch (err) {
            console.log('Error fetching member roles:', err.message);
        }

        const isAdmin = userRoleIds.includes(ADMIN_ROLE_ID);

        req.session.user = {
            id: user.id,
            username: user.global_name || user.username,
            avatar: user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png',
            roles: mappedRoles,
            roleIds: userRoleIds,
            isAdmin: isAdmin
        };

        req.session.save((err) => {
            if (err) return res.redirect('/?error=session_error');
            sendLog('New Login 🟢', `User: **${user.username}** (<@${user.id}>)`, 0x00ff00);
            res.redirect('/');
        });
    } catch (error) {
        res.redirect('/?error=not_in_server');
    }
});

app.get('/auth/logout', (req, res) => {
    if (req.session.user) sendLog('Logout 🔴', `User: **${req.session.user.username}**`, 0xff0000);
    req.session.destroy();
    res.redirect('/');
});

app.get('/api/me', (req, res) => {
    if (req.session.user && bannedUsers.includes(req.session.user.id)) {
        req.session.destroy();
        return res.json({ loggedIn: false, banned: true });
    }
    res.json(req.session.user ? { loggedIn: true, user: req.session.user, allRoles: guildRoles } : { loggedIn: false });
});

app.get('/api/projects', (req, res) => { res.json(projects); });

app.get('/api/projects/:id/download', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'You must log in first!' });
    if (bannedUsers.includes(req.session.user.id)) return res.status(403).json({ error: 'Your account is banned!' });

    const project = projects.find(p => p.id == req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    if (project.type === 'showcase') {
        return res.status(403).json({ error: 'This project is for showcase only.' });
    }

    if (project.requiredRoles && project.requiredRoles.length > 0) {
        const userRoles = req.session.user.roleIds ? req.session.user.roleIds.map(String) : [];
        const required = project.requiredRoles.map(String);
        
        const hasRole = required.some(rId => userRoles.includes(rId));
        
        if (!hasRole && !req.session.user.isAdmin) {
            return res.status(403).json({ error: 'You lack the required role to download this file.' });
        }
    }

    project.downloads++;
    saveProjects();
    sendLog('File Download 📥', `User: **${req.session.user.username}**\nFile: **${project.title}**`, 0x0099ff);
    
    res.json({ success: true, downloadUrl: project.fileUrl || '#' });
});

app.post('/api/admin/projects', (req, res) => {
    if (!req.session.user?.isAdmin) return res.status(403).json({ error: 'Unauthorized access.' });

    const { id, title, category, type, thumbnail, description, images, video, fileUrl, requiredRoles } = req.body;

    if (id) {
        const idx = projects.findIndex(p => p.id == id);
        if (idx !== -1) {
            projects[idx] = { ...projects[idx], title, category, type, thumbnail, description, images, video, fileUrl, requiredRoles };
            saveProjects();
            sendLog('Project Edited ✏️', `Admin: **${req.session.user.username}**\nProject: **${title}**`, 0xffaa00);
            return res.json({ success: true, message: 'Project updated successfully.' });
        }
    }

    const newProject = {
        id: Date.now(),
        title, category, type, thumbnail, description,
        fileUrl: fileUrl || '#',
        images: images || [],
        video: video || '',
        requiredRoles: requiredRoles || [],
        downloads: 0
    };

    projects.push(newProject);
    saveProjects();
    sendLog('New Project Added 📁', `Admin: **${req.session.user.username}**\nProject: **${title}**`, 0x00ff00);
    res.json({ success: true, project: newProject });
});

app.delete('/api/admin/projects/:id', (req, res) => {
    if (!req.session.user?.isAdmin) return res.status(403).json({ error: 'Unauthorized access.' });

    const index = projects.findIndex(p => p.id == req.params.id);
    if (index !== -1) {
        const deleted = projects.splice(index, 1)[0];
        saveProjects();
        sendLog('Project Deleted 🗑️', `Admin: **${req.session.user.username}**\nProject: **${deleted.title}**`, 0xff0000);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Project not found.' });
    }
});

app.get('/api/admin/banned', (req, res) => {
    if (!req.session.user?.isAdmin) return res.status(403).json({ error: 'Unauthorized access.' });
    res.json(bannedUsers);
});

app.post('/api/admin/ban', (req, res) => {
    if (!req.session.user?.isAdmin) return res.status(403).json({ error: 'Unauthorized access.' });

    const { userId, action } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    if (action === 'ban') {
        if (!bannedUsers.includes(userId)) bannedUsers.push(userId);
        sendLog('User Banned 🚫', `Admin: **${req.session.user.username}** banned ID: **${userId}**`, 0xff0000);
    } else {
        bannedUsers = bannedUsers.filter(id => id !== userId);
        sendLog('User Unbanned 🔓', `Admin: **${req.session.user.username}** unbanned ID: **${userId}**`, 0x00ff00);
    }

    saveBanned();
    res.json({ success: true, bannedUsers });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));