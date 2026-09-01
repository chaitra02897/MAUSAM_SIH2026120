const bcrypt = require('bcryptjs');
const {
    createSession,
    getPool,
    isValidCustomId,
    normalizeCustomId,
    readJson,
    sendJson,
} = require('../../lib/auth');

module.exports = async function register(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const body = await readJson(req);
        const customId = normalizeCustomId(body.customId || body.username);
        const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : null;
        const password = typeof body.password === 'string' ? body.password : '';
        const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

        if (!isValidCustomId(customId)) {
            return sendJson(res, 400, { error: 'Custom ID must be 3-50 letters, numbers, dots, underscores, or hyphens' });
        }
        if (password.length < 8 || password.length > 72) {
            return sendJson(res, 400, { error: 'Password must be between 8 and 72 characters' });
        }
        if (password !== confirmPassword) {
            return sendJson(res, 400, { error: 'Passwords do not match' });
        }

        const connection = await getPool().getConnection();
        try {
            await connection.beginTransaction();
            const [userResult] = await connection.execute(
                `INSERT INTO users
                    (name, daily_routine, outdoor_time, weather_interests, weather_use)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    typeof body.name === 'string' && body.name.trim() ? body.name.trim() : customId,
                    'pending',
                    'pending',
                    JSON.stringify(['pending']),
                    'pending'
                ]
            );

            const userId = userResult.insertId;
            const passwordHash = await bcrypt.hash(password, 12);
            await connection.execute(
                `INSERT INTO login_data (user_id, custom_id, email, password_hash)
                 VALUES (?, ?, ?, ?)`,
                [userId, customId, email, passwordHash]
            );
            await createSession(userId, res, connection);
            await connection.commit();
            return sendJson(res, 201, { user: { user_id: userId, name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : customId, customId, onboardingCompleted: false } });
        } catch (error) {
            await connection.rollback();
            if (error.code === 'ER_DUP_ENTRY') {
                return sendJson(res, 409, { error: 'That Custom ID is already in use' });
            }
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error.statusCode) {
            return sendJson(res, error.statusCode, { error: error.message });
        }
        return sendJson(res, 500, { error: 'Unable to create account' });
    }
};
