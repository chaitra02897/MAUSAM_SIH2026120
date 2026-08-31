(function () {
    'use strict';

    // Add your real OpenWeather API key here before running the app.
    // Safe option for a plain HTML/JS project: set window.OPENWEATHER_API_KEY = 'YOUR_KEY';
    // before weather.js loads, or replace the placeholder below.
    const DEFAULT_API_KEY = 'PASTE_YOUR_OPENWEATHER_API_KEY_HERE';
    const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
    const OPENWEATHER_GEO_URL = 'https://api.openweathermap.org/geo/1.0';

    function getApiKey() {
        const configuredKey = (window.OPENWEATHER_API_KEY || DEFAULT_API_KEY || '').trim();
        if (!configuredKey || configuredKey === 'PASTE_YOUR_OPENWEATHER_API_KEY_HERE') {
            return null;
        }
        return configuredKey;
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function formatWeatherLabel(value) {
        if (!value) return 'Unavailable';
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function toTitleCase(value) {
        if (!value) return 'Unavailable';
        return value
            .split(' ')
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function getAqiLabel(aqiIndex) {
        const mapping = {
            1: 'Good',
            2: 'Fair',
            3: 'Moderate',
            4: 'Poor',
            5: 'Very Poor'
        };
        return mapping[aqiIndex] || 'Unavailable';
    }

    function getWeatherIconClass(iconCode) {
        if (!iconCode) return 'fa-cloud-sun';

        if (iconCode.includes('01')) return 'fa-sun';
        if (iconCode.includes('02')) return 'fa-cloud-sun';
        if (iconCode.includes('03')) return 'fa-cloud';
        if (iconCode.includes('04')) return 'fa-cloud';
        if (iconCode.includes('09')) return 'fa-cloud-showers-heavy';
        if (iconCode.includes('10')) return 'fa-cloud-rain';
        if (iconCode.includes('11')) return 'fa-bolt';
        if (iconCode.includes('13')) return 'fa-snowflake';
        if (iconCode.includes('50')) return 'fa-smog';

        return 'fa-cloud-sun';
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) {
            let errorMessage = 'OpenWeather API request failed';
            try {
                const payload = await response.json();
                errorMessage = payload && payload.message ? payload.message : errorMessage;
            } catch (error) {
                errorMessage = errorMessage;
            }
            throw new Error(errorMessage);
        }
        return response.json();
    }

    async function reverseGeocode(lat, lon) {
        const key = getApiKey();
        if (!key) {
            return { cityName: 'Your location' };
        }

        try {
            const payload = await fetchJson(
                `${OPENWEATHER_GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${key}`
            );

            const result = (payload && payload.length && payload[0]) || null;
            if (!result) {
                return { cityName: 'Your location' };
            }

            const city = result.name || 'Your location';
            const region = result.state || result.country || '';
            const cityName = region ? `${city}, ${region}` : city;
            return { cityName };
        } catch (error) {
            return { cityName: 'Your location' };
        }
    }

    async function searchCity(cityName) {
        const key = getApiKey();
        if (!key) {
            return null;
        }

        try {
            const payload = await fetchJson(
                `${OPENWEATHER_GEO_URL}/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${key}`
            );

            const result = (payload && payload.length && payload[0]) || null;
            if (!result) {
                return null;
            }

            return {
                cityName: result.state ? `${result.name}, ${result.state}` : result.name,
                latitude: result.lat,
                longitude: result.lon
            };
        } catch (error) {
            return null;
        }
    }

    async function fetchWeatherData({ lat, lon, cityName }) {
        const apiKey = getApiKey();

        const fallback = {
            locationLabel: cityName || 'Your location',
            temperatureC: null,
            feelsLikeC: null,
            humidity: null,
            weatherCondition: 'Unavailable',
            precipitation: null,
            windSpeedKmh: null,
            aqi: null,
            aqiLabel: 'Unavailable',
            pm25: null,
            pm10: null,
            iconClass: 'fa-cloud-sun',
            error: apiKey ? 'OpenWeather request failed' : 'Missing API key'
        };

        if (!apiKey) {
            return fallback;
        }

        try {
            const currentWeatherUrl = `${OPENWEATHER_BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
            const airPollutionUrl = `${OPENWEATHER_BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
            const [currentWeather, airData] = await Promise.all([
                fetchJson(currentWeatherUrl).catch(() => null),
                fetchJson(airPollutionUrl).catch(() => null)
            ]);

            const weatherMain = currentWeather && currentWeather.main ? currentWeather.main : {};
            const weatherInfo = currentWeather && currentWeather.weather && currentWeather.weather[0] ? currentWeather.weather[0] : {};
            const rainInfo = currentWeather && currentWeather.rain ? currentWeather.rain : {};
            const snowInfo = currentWeather && currentWeather.snow ? currentWeather.snow : {};
            const airQuality = airData && airData.list && airData.list[0] ? airData.list[0] : {};
            const airComponents = airQuality.components || {};
            const windSpeedKmh = currentWeather && currentWeather.wind && isFiniteNumber(currentWeather.wind.speed)
                ? Math.round(currentWeather.wind.speed * 3.6)
                : null;

            const precipitationValue =
                isFiniteNumber(rainInfo['1h']) ? rainInfo['1h'] :
                isFiniteNumber(rainInfo['3h']) ? rainInfo['3h'] :
                isFiniteNumber(snowInfo['1h']) ? snowInfo['1h'] :
                isFiniteNumber(snowInfo['3h']) ? snowInfo['3h'] :
                0;

            const aqiValue = airQuality.main && isFiniteNumber(airQuality.main.aqi) ? airQuality.main.aqi : null;

            const weatherCondition = weatherInfo.description ? toTitleCase(weatherInfo.description) : 'Unavailable';
            const iconClass = getWeatherIconClass(weatherInfo.icon || '');

            return {
                locationLabel: cityName || 'Your location',
                temperatureC: isFiniteNumber(weatherMain.temp) ? weatherMain.temp : null,
                feelsLikeC: isFiniteNumber(weatherMain.feels_like) ? weatherMain.feels_like : null,
                humidity: isFiniteNumber(weatherMain.humidity) ? weatherMain.humidity : null,
                weatherCondition,
                precipitation: precipitationValue,
                windSpeedKmh,
                aqi: aqiValue,
                aqiLabel: aqiValue ? getAqiLabel(aqiValue) : 'Unavailable',
                pm25: isFiniteNumber(airComponents.pm2_5) ? airComponents.pm2_5 : null,
                pm10: isFiniteNumber(airComponents.pm10) ? airComponents.pm10 : null,
                iconClass,
                error: null
            };
        } catch (error) {
            return {
                ...fallback,
                error: error && error.message ? error.message : 'OpenWeather request failed'
            };
        }
    }

    window.MausamWeather = {
        getApiKey,
        searchCity,
        getLocationFromCoordinates: reverseGeocode,
        fetchWeatherData
    };
})();
