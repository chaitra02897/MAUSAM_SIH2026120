const {
    getAuthenticatedUser,
    getPool,
    readJson,
    sendJson,
    validatePreferences
} = require('../../lib/auth');

module.exports = async function preferences(req, res) {
    if (req.method !== 'PUT') {
        res.setHeader('Allow', 'PUT');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Authentication required' });
        }

        const body = await readJson(req);
        const validation = validatePreferences(body, false);
        if (validation.error) {
            return sendJson(res, 400, { error: validation.error });
        }

        await getPool().execute(
            `UPDATE users
             SET daily_routine = ?,
                 outdoor_time = ?,
                 weather_interests = ?,
                 weather_use = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?`,
            [
                validation.value.dailyRoutine,
                validation.value.outdoorTime,
                JSON.stringify(validation.value.weatherInterests),
                validation.value.weatherUse,
                user.user_id
            ]
        );

        return sendJson(res, 200, { message: 'Preferences saved' });
    } catch (error) {
        if (error.statusCode) {
            return sendJson(res, error.statusCode, { error: error.message });
        }
        return sendJson(res, 500, { error: 'Unable to save preferences' });
    }
};
