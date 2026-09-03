// penguin.js - Penguin notification widget for MAUSAM
// - Injects a scoped #penguin-notification element
// - Uses Open-Meteo (no API key) to fetch current weather
// - Reuses window.mausamLocation / sessionStorage 'mausamLocation' if available
// - Auto-shows on DOMContentLoaded, waves, then hides
(function () {
  const weatherCodeMap = {
    0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog',48:'depositing rime fog',51:'light drizzle',53:'moderate drizzle',55:'dense drizzle',
    56:'freezing drizzle',57:'dense freezing drizzle',61:'slight rain',63:'moderate rain',65:'heavy rain',
    66:'freezing rain',67:'heavy freezing rain',71:'slight snow',73:'moderate snow',75:'heavy snow',
    77:'snow grains',80:'rain showers',81:'moderate rain showers',82:'violent rain showers',
    85:'snow showers',86:'heavy snow showers',95:'thunderstorm',96:'thunderstorm with slight hail',99:'thunderstorm with heavy hail'
  };

  function friendlyMessage(tempC, weatherCode) {
    if (weatherCode >= 80 && weatherCode <= 82) return `Looks rainy — don't forget an umbrella!`;
    if (weatherCode >= 95) return `Thunderstorms nearby — stay safe indoors!`;
    if ([71,73,75,85,86].includes(weatherCode)) return `Brr — it's snowy out! Perfect for slides.`;
    if (tempC <= 0) return `It's freezing (${Math.round(tempC)}°C). Brrr!`;
    if (tempC <= 10) return `Chilly (${Math.round(tempC)}°C) — a cosy scarf helps.`;
    if (tempC <= 20) return `Cool and comfy (${Math.round(tempC)}°C).`;
    if (tempC <= 28) return `Nice weather: ${Math.round(tempC)}°C — a good day to waddle around.`;
    return `Warm day (${Math.round(tempC)}°C)! Stay hydrated.`;
  }

  async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current_weather=true`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    if (!data.current_weather) throw new Error('No current_weather');
    return { temp: data.current_weather.temperature, code: data.current_weather.weathercode };
  }

  function createMarkup() {
    const wrapper = document.createElement('div');
    wrapper.id = 'penguin-notification';
    wrapper.setAttribute('aria-live', 'polite');
    wrapper.setAttribute('role', 'status');
    wrapper.innerHTML = `
      <div class="penguin-wrap" aria-hidden="true">
        <svg width="96" height="120" viewBox="0 0 96 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g transform="translate(8,4)">
            <ellipse cx="40" cy="70" rx="32" ry="40" fill="#0b5b82" />
            <ellipse cx="40" cy="70" rx="18" ry="28" fill="#fff" />
            <circle cx="40" cy="34" r="22" fill="#0b5b82" />
            <ellipse cx="40" cy="36" rx="12" ry="10" fill="#fff" />
            <circle cx="34" cy="34" r="2" fill="#07203a" />
            <circle cx="46" cy="34" r="2" fill="#07203a" />
            <path d="M40 40 l6 6 h-12z" fill="#ffb34d" />
            <path d="M14 68 q-10 12 2 22 q18 6 18 0 q-6-18-10-28 q-6-8 -10-14z" fill="#073c52" opacity="0.98"/>
            <g class="wave" transform="translate(56,60)">
              <path d="M0 0 q8 -10 18 -6 q12 6 6 22 q-6 16 -18 12 q-12-4 -12-24z" fill="#073c52" />
            </g>
            <ellipse cx="28" cy="108" rx="8" ry="4" fill="#ffb34d" />
            <ellipse cx="52" cy="108" rx="8" ry="4" fill="#ffb34d" />
          </g>
        </svg>
      </div>
      <div class="bubble">
        <strong id="penguin-title">Hello!</strong>
        <div id="penguin-message">Checking the weather...</div>
      </div>
    `;
    return wrapper;
  }

  async function determineLocation() {
    try {
      if (window.mausamLocation && window.mausamLocation.latitude && window.mausamLocation.longitude) {
        return [window.mausamLocation.latitude, window.mausamLocation.longitude];
      }
      const stored = sessionStorage.getItem('mausamLocation');
      if (stored) {
        const s = JSON.parse(stored);
        if (s.latitude && s.longitude) return [s.latitude, s.longitude];
      }
    } catch (e) { /* ignore */ }

    if (navigator.geolocation) {
      return await new Promise((resolve, reject) => {
        let handled = false;
        const id = navigator.geolocation.getCurrentPosition(
          pos => { handled = true; resolve([pos.coords.latitude, pos.coords.longitude]); },
          err => { handled = true; reject(err); },
          { timeout: 9000 }
        );
        setTimeout(()=> { if(!handled) { try { navigator.geolocation.clearWatch(id) } catch(e){}; reject(new Error('geolocation timeout')) } }, 10000);
      });
    }
    return [51.5072, -0.1276];
  }

  async function showPenguinNotification(options = {}) {
    try {
      const duration = options.duration || 6000;
      const wrapperId = 'penguin-notification';
      let wrapper = document.getElementById(wrapperId);
      if (!wrapper) {
        wrapper = createMarkup();
        document.body.appendChild(wrapper);
      }

      const titleEl = wrapper.querySelector('#penguin-title');
      const msgEl = wrapper.querySelector('#penguin-message');

      wrapper.classList.remove('out');
      requestAnimationFrame(()=> wrapper.classList.add('show', 'waving'));

      let lat, lon;
      try {
        [lat, lon] = await determineLocation();
      } catch (e) {
        lat = options.lat ?? 51.5072;
        lon = options.lon ?? -0.1276;
      }

      try {
        const w = await fetchWeather(lat, lon);
        titleEl.textContent = weatherCodeMap[w.code] ? weatherCodeMap[w.code][0].toUpperCase() + weatherCodeMap[w.code].slice(1) : 'Weather';
        msgEl.textContent = friendlyMessage(w.temp, w.code);
      } catch (err) {
        titleEl.textContent = 'Weather unavailable';
        msgEl.textContent = 'I could not fetch the weather right now.';
      }

      const wavingDuration = Math.max(3000, duration - 1000);
      setTimeout(()=> wrapper.classList.remove('waving'), wavingDuration);

      clearTimeout(wrapper._hideTimeout);
      wrapper._hideTimeout = setTimeout(()=> {
        wrapper.classList.remove('show');
        wrapper.classList.add('out');
      }, duration);
    } catch (err) {
      console.error('Penguin notification failed:', err);
    }
  }

  window.showPenguinNotification = showPenguinNotification;

  function autoShow() {
    const defaultDelay = 1200;
    const startup = document.getElementById('startup-screen');
    let delay = defaultDelay;
    if (startup) delay = 4000;
    setTimeout(()=> showPenguinNotification({ duration: 7000 }), delay);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    autoShow();
  } else {
    document.addEventListener('DOMContentLoaded', autoShow);
  }
})();
