const bcrypt = require('bcryptjs');
const {
    createSession,
    getPool,
    isValidEmail,
    normalizeEmail,
    readJson,
    sendJson,
    validatePreferences
} = require('../../lib/auth');

module.exports = async function register(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const body = await readJson(req);
        const email = normalizeEmail(body.email);
        const password = typeof body.password === 'string' ? body.password : '';
        const preferences = validatePreferences(body);

        if (!isValidEmail(email)) {
            return sendJson(res, 400, { error: 'A valid email is required' });
        }
        if (password.length < 8 || password.length > 72) {
            return sendJson(res, 400, { error: 'Password must be between 8 and 72 characters' });
        }
        if (preferences.error) {
            return sendJson(res, 400, { error: preferences.error });
        }

        const connection = await getPool().getConnection();
        try {
            await connection.beginTransaction();
            const [userResult] = await connection.execute(
                `INSERT INTO users
                    (name, daily_routine, outdoor_time, weather_interests, weather_use)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    preferences.value.name,
                    preferences.value.dailyRoutine,
                    preferences.value.outdoorTime,
                    JSON.stringify(preferences.value.weatherInterests),
                    preferences.value.weatherUse
                ]
            );

            const userId = userResult.insertId;
            const passwordHash = await bcrypt.hash(password, 12);
            await connection.execute(
                `INSERT INTO login_data (user_id, email, password_hash)
                 VALUES (?, ?, ?)`,
                [userId, email, passwordHash]
            );
            await createSession(userId, res, connection);
            await connection.commit();
            return sendJson(res, 201, { user: { user_id: userId, name: preferences.value.name, email } });
        } catch (error) {
            await connection.rollback();
            if (error.code === 'ER_DUP_ENTRY') {
                return sendJson(res, 409, { error: 'An account with that email already exists' });
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
