const bcrypt = require('bcryptjs');
const {
    createSession,
    getPool,
    isValidEmail,
    normalizeEmail,
    readJson,
    sendJson
} = require('../../lib/auth');

const INVALID_CREDENTIALS = 'Invalid email or password';

module.exports = async function login(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const body = await readJson(req);
        const email = normalizeEmail(body.email);
        const password = typeof body.password === 'string' ? body.password : '';

        if (!isValidEmail(email) || !password) {
            return sendJson(res, 401, { error: INVALID_CREDENTIALS });
        }

        const [rows] = await getPool().execute(
            `SELECT l.user_id, l.password_hash, u.name
             FROM login_data AS l
             JOIN users AS u ON u.user_id = l.user_id
             WHERE l.email = ?`,
            [email]
        );
        const account = rows[0];
        const passwordMatches = account
            ? await bcrypt.compare(password, account.password_hash)
            : false;

        if (!account || !passwordMatches) {
            return sendJson(res, 401, { error: INVALID_CREDENTIALS });
        }

        await createSession(account.user_id, res);
        return sendJson(res, 200, {
            user: { user_id: account.user_id, name: account.name, email }
        });
    } catch (error) {
        if (error.statusCode) {
            return sendJson(res, error.statusCode, { error: error.message });
        }
        return sendJson(res, 500, { error: 'Unable to log in' });
    }
};
