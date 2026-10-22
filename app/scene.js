/**
 * The dusk scene follows the real day and the real weather.
 *
 * Time: the sky and water colours shift through dawn, day, dusk and night, and stars come out at
 * night (the sun stays put, in the focused app's colour), and the character image (app/characters/morning|day|evening|night.png) swaps with them.
 * Updated every minute.
 *
 * Weather: Open-Meteo (free, no key). The location is CONFIG.weatherCity when set, otherwise the
 * TV's public IP. Shown after the greeting as "24° · Clear in Tokyo"; the three cloud streaks always cross the sun,
 * overcast adds more, rain and snow fall across the screen. Refreshed every 20 minutes.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var stars = $('stars'), precip = $('precip'), weatherEl = $('weather');

  // ---- time of day ---------------------------------------------------------------------------

  // [hour, sky, water]
  var SKY = [
    [0, [12, 15, 29], [7, 9, 16]],
    [5, [12, 15, 29], [7, 9, 16]],
    [6.5, [58, 42, 63], [26, 20, 32]],
    [8, [36, 50, 74], [20, 27, 40]],
    [16, [36, 50, 74], [20, 27, 40]],
    [18, [59, 36, 51], [26, 16, 24]],
    [19.5, [12, 15, 29], [7, 9, 16]],
    [24, [12, 15, 29], [7, 9, 16]]
  ];
  var NIGHT_START = 19, NIGHT_END = 5.5;

  function mix(a, b, t) {
    return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * t); }).join(',') + ')';
  }

  function skyAt(h) {
    for (var i = 0; i < SKY.length - 1; i++) {
      var a = SKY[i], b = SKY[i + 1];
      if (h >= a[0] && h <= b[0]) {
        var t = (h - a[0]) / (b[0] - a[0]);
        return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
      }
    }
    return [mix(SKY[0][1], SKY[0][1], 0), mix(SKY[0][2], SKY[0][2], 0)];
  }

  function updateTime() {
    var d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    document.body.classList.toggle('night', h < NIGHT_END || h >= NIGHT_START);
    var c = skyAt(h);
    root.style.setProperty('--sky', c[0]);
    root.style.setProperty('--sea', c[1]);
    updateCharacter(h);
  }

  // ---- character: app/characters/<phase>.png, crossfaded when the phase changes ---------------

  var chars = [$('charA'), $('charB')], charFront = 0, charPhase = null;

  function phaseAt(h) {
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }

  function updateCharacter(h) {
    var phase = phaseAt(h);
    if (phase === charPhase) return;
    charPhase = phase;
    var next = chars[1 - charFront], prev = chars[charFront];
    next.onload = function () {
      next.className = 'shown';
      prev.className = '';
      charFront = 1 - charFront;
    };
    next.onerror = function () { prev.className = ''; };   // no image for this phase: show none
    next.src = 'characters/' + phase + '.png';
  }

  // ---- weather -------------------------------------------------------------------------------

  // WMO weather codes → [label, sky]: sky is clear | some | overcast | rain | snow | storm
  function describe(code) {
    if (code === 0) return ['Clear', 'clear'];
    if (code === 1) return ['Mostly clear', 'clear'];
    if (code === 2) return ['Partly cloudy', 'some'];
    if (code === 3) return ['Cloudy', 'overcast'];
    if (code === 45 || code === 48) return ['Fog', 'overcast'];
    if (code >= 51 && code <= 57) return ['Drizzle', 'rain'];
    if (code >= 61 && code <= 67) return ['Rain', 'rain'];
    if (code >= 71 && code <= 77) return ['Snow', 'snow'];
    if (code >= 80 && code <= 82) return ['Showers', 'rain'];
    if (code === 85 || code === 86) return ['Snow showers', 'snow'];
    if (code >= 95) return ['Thunderstorm', 'storm'];
    return ['', 'some'];
  }

  function getJSON(url, done) {
    var x = new XMLHttpRequest();
    x.open('GET', url);
    x.timeout = 10000;
    x.onload = function () {
      var data = null;
      try { data = JSON.parse(x.responseText); } catch (e) { /* ignore */ }
      done(x.status === 200 ? data : null);
    };
    x.onerror = x.ontimeout = function () { done(null); };
    x.send();
  }

  var place_ = null;   // { name, lat, lon }

  function locate(done) {
    var city = window.CONFIG && CONFIG.weatherCity;
    if (city) {
      getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(city), function (d) {
        var r = d && d.results && d.results[0];
        done(r ? { name: r.name, lat: r.latitude, lon: r.longitude } : null);
      });
    } else {
      getJSON('https://ipwho.is/', function (d) {
        done(d && d.success !== false && d.latitude ? { name: d.city, lat: d.latitude, lon: d.longitude } : null);
      });
    }
  }

  function updateWeather() {
    if (!place_) {
      locate(function (p) { if (p) { place_ = p; updateWeather(); } });
      return;
    }
    getJSON('https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code&timezone=auto' +
      '&latitude=' + place_.lat + '&longitude=' + place_.lon, function (d) {
      if (!d || !d.current) return;
      var w = describe(d.current.weather_code);
      var temp = Math.round(d.current.temperature_2m) + '°';
      weatherEl.textContent = temp + (w[0] ? ' · ' + w[0] : '') + (place_.name ? ' in ' + place_.name : '');
      weatherEl.className = 'shown';
      document.body.setAttribute('data-sky', w[1]);
    });
  }

  // ---- precipitation layer: streaks for rain, flakes for snow, placed once ---------------------

  for (var i = 0; i < 28; i++) {
    var drop = document.createElement('i');
    drop.style.left = Math.round(Math.random() * 1920) + 'px';
    drop.style.animationDelay = -(Math.random() * 3).toFixed(2) + 's';
    drop.style.animationDuration = (0.8 + Math.random() * 0.6).toFixed(2) + 's';
    precip.appendChild(drop);
  }

  updateTime();
  setInterval(updateTime, 60000);
  updateWeather();
  setInterval(updateWeather, 20 * 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) updateTime(); });
})();
