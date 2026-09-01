const crypto = require('crypto');
const mysql = require('mysql2/promise');

let pool;

function getPool() {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not configured');
        }
        pool = mysql.createPool(process.env.DATABASE_URL);
    }
    return pool;
}

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

async function readJson(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    let rawBody = '';
    for await (const chunk of req) rawBody += chunk;
    if (!rawBody) return {};
    try {
        return JSON.parse(rawBody);
    } catch {
        const error = new Error('Request body must be valid JSON');
        error.statusCode = 400;
        throw error;
    }
}

function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validatePreferences(body, requireName = true) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const dailyRoutine = typeof body.dailyRoutine === 'string' ? body.dailyRoutine.trim() : typeof body.daily_routine === 'string' ? body.daily_routine.trim() : '';
    const outdoorTime = typeof body.outdoorTime === 'string' ? body.outdoorTime.trim() : typeof body.outdoor_time === 'string' ? body.outdoor_time.trim() : '';
    const weatherUse = typeof body.weatherUse === 'string' ? body.weatherUse.trim() : typeof body.weather_use === 'string' ? body.weather_use.trim() : '';
    const weatherInterests = Array.isArray(body.weatherInterests) ? body.weatherInterests : body.weather_interests;
    if (requireName && (!name || name.length > 100)) return { error: 'Name is required and must be 100 characters or fewer' };
    if (!dailyRoutine || !outdoorTime || !weatherUse) return { error: 'All questionnaire preferences are required' };
    if (!Array.isArray(weatherInterests) || weatherInterests.length < 1 || weatherInterests.length > 3) return { error: 'Choose between one and three weather interests' };
    if (weatherInterests.some((interest) => typeof interest !== 'string' || interest.length > 40)) return { error: 'Weather interests are invalid' };
    return { value: { ...(requireName ? { name } : {}), dailyRoutine, outdoorTime, weatherInterests, weatherUse } };
}

function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function getCookie(req, name) {
    const cookies = req.headers.cookie || '';
    const prefix = `${name}=`;
    const cookie = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

async function createSession(userId, res, database = getPool()) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await database.execute(
        `INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
        [userId, hashSessionToken(token), expiresAt]
    );
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `mausam_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureFlag}`);
}

async function getAuthenticatedUser(req) {
    const token = getCookie(req, 'mausam_session');
    if (!token) return null;
    const [rows] = await getPool().execute(
        `SELECT u.user_id FROM auth_sessions AS s JOIN users AS u ON u.user_id = s.user_id WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP`,
        [hashSessionToken(token)]
    );
    return rows[0] || null;
}

module.exports = { createSession, getAuthenticatedUser, getPool, isValidEmail, normalizeEmail, readJson, sendJson, validatePreferences };