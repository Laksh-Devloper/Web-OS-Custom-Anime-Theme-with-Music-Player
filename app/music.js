/**
 * Background music for the launcher: a calm JioSaavn playlist played quietly while the launcher
 * is in front. Fades out when an app opens or the launcher is hidden, and back in on return.
 * The play/pause button under the clock and the remote's media keys control it
 * (Play/Pause, Fast-forward = next, Rewind = previous). A song that fails to load stops playback.
 */
(function () {
  var CALM = [
    { title: 'Reflections', artist: 'The Neighbourhood', src: 'https://aac.saavncdn.com/545/0504777e189bb912a6b830075bb617e3_320.mp4' },
    { title: 'Strangers', artist: 'Kenya Grace', src: 'https://aac.saavncdn.com/238/c08b90823063200f03b34a1f6e4c7aeb_320.mp4' },
    { title: 'BIRDS OF A FEATHER', artist: 'Billie Eilish', src: 'https://aac.saavncdn.com/707/761fa325ce0600e1463336f0431d82b3_320.mp4' },
    { title: 'BLUE', artist: 'Billie Eilish', src: 'https://aac.saavncdn.com/707/1fdb20aae031031a50b08b0ee6a2e240_320.mp4' }
  ];
  var VOLUME = 0.35;
  var KEY = { PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413, FF: 417, RW: 412 };
  var ICON_PLAY = 'M8,5v14l11,-7z';
  var ICON_PAUSE = 'M6,19h4V5H6v14zM14,5v14h4V5H14z';

  var $ = function (id) { return document.getElementById(id); };
  var box = $('nowPlaying'), label = $('npTitle'), playIcon = $('playIcon');

  var audio = new Audio();
  audio.preload = 'auto';
  audio.volume = 0;
  // app/playlist.js (from sync-playlist.py) replaces the built-in list when present.
  if (window.PLAYLIST && PLAYLIST.length) CALM = PLAYLIST;
  var queue = CALM, index = Math.floor(Math.random() * CALM.length);
  var wanted = true;          // false once the user pauses
  var fadeTimer = null;

  // ---- player ------------------------------------------------------------------------------

  function load(i) {
    index = (i + queue.length) % queue.length;
    var t = queue[index];
    audio.src = t.src;
    label.textContent = t.title + ' · ' + t.artist;
  }

  function fadeTo(target, ms, done) {
    clearInterval(fadeTimer);
    var start = audio.volume, steps = Math.max(1, Math.round(ms / 40)), n = 0;
    fadeTimer = setInterval(function () {
      n++;
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * n / steps));
      if (n >= steps) { clearInterval(fadeTimer); if (done) done(); }
    }, 40);
  }

  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () { /* autoplay refused: the next key press starts it */ });
    box.className = 'playing';
    playIcon.setAttribute('d', ICON_PAUSE);
    fadeTo(VOLUME, 1200);
  }

  function pause(ms) {
    box.className = 'paused';
    playIcon.setAttribute('d', ICON_PLAY);
    fadeTo(0, ms || 400, function () { audio.pause(); });
  }

  function toggle() {
    wanted = !wanted;
    if (wanted) play(); else pause();
  }

  function skip(step) { load(index + step); wanted = true; play(); }

  audio.addEventListener('ended', function () { skip(1); });
  // A song that won't load stops playback with a message; skipping on would race through the list.
  audio.addEventListener('error', function () {
    if (!audio.src) return;
    var t = queue[index];
    wanted = false;
    pause(0);
    label.textContent = "Couldn't play " + t.title;
  });

  // ---- media keys and lifecycle -------------------------------------------------------------

  function handleMediaKey(k) {
    if (k === KEY.PLAY) { wanted = true; play(); }
    else if (k === KEY.PAUSE || k === KEY.STOP) { wanted = false; pause(); }
    else if (k === KEY.PLAYPAUSE) toggle();
    else if (k === KEY.FF) skip(1);
    else if (k === KEY.RW) skip(-1);
    else return false;
    return true;
  }

  document.addEventListener('keydown', function (e) {
    if (handleMediaKey(e.keyCode)) return;
    if (wanted && audio.paused && !document.hidden) play();   // first key press unlocks autoplay
  });

  document.addEventListener('launcher:launch', function () { pause(350); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause(200);
    else if (wanted) play();
  });
  document.addEventListener('webOSRelaunch', function () { if (wanted) play(); });

  window.Music = { toggle: toggle, skip: skip };

  load(index);
  play();
})();
