/* Night gate: GSAP choreography + RaindropFX optics + Howler soundscape.
 * Dependencies are pinned locally; all visual effects are optional. */
(function () {
  'use strict';
  const gate = document.getElementById('gate');
  if (!gate) return;
  const $ = (id) => document.getElementById(id);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const soundButton = $('gateSound');
  const weatherButton = $('gateWeather');
  const hint = $('gateListen');
  const scene = $('gateScene');
  const canvas = $('rainBg');
  const gsap = window.gsap;
  const events = new AbortController();
  const timelines = new Set();
  const pendingSounds = new Set();
  let alive = true;
  let touched = false;
  let playing = false;
  let glass = null;
  let glassContext = null;
  let glassStarting = false;
  let glassTick = null;
  let heavyPaused = false;
  let lightningCall = null;
  let thunderCall = null;
  let resizeTimer = null;
  let sounds = [];
  let rain = null;
  let music = null;
  let thunder = null;
  let entrance = null;
  let muted = readPreference('night-gate-muted') === '1';
  let weather = readPreference('night-gate-weather') !== '0';

  function readPreference(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function savePreference(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* Private browsing. */ }
  }
  function moving() { return alive && weather && !motionQuery.matches && !document.hidden; }
  function syncSound() {
    soundButton.classList.toggle('is-playing', playing && !muted && !document.hidden);
    soundButton.setAttribute('aria-pressed', String(playing && !muted));
    soundButton.title = muted || !touched ? '开启音乐、雨声与远雷' : '关闭音乐、雨声与远雷';
    $('soundLabel').textContent = muted ? '静音' : playing ? '雨声' : '听雨';
    hint.classList.toggle('is-gone', muted || playing);
  }
  function initAudio() {
    if (!window.Howl || sounds.length) return;
    // Howls are created only after a gesture. preload:true is needed because
    // Howler queues play() on an unloaded sound without starting the download.
    const options = { preload: true, volume: 0, onplayerror: () => {
      pendingSounds.clear();
      playing = false;
      hint.textContent = '轻触「听雨」，开启声音';
      syncSound();
    }, onloaderror: () => {
      pendingSounds.clear();
      hint.textContent = '声音暂未载入，可继续启程';
      hint.classList.remove('is-gone');
    } };
    rain = new Howl(Object.assign({}, options, { src: ['audio/rain.mp3'], loop: true }));
    music = new Howl(Object.assign({}, options, { src: ['audio/title.mp3'], loop: true }));
    thunder = new Howl(Object.assign({}, options, { src: ['audio/thunder.mp3'], loop: false }));
    sounds = [rain, music, thunder];
    [rain, music].forEach((sound) => sound.on('play', () => {
      pendingSounds.delete(sound);
      // A queued decode/play may finish after the user has switched away.
      if (!alive || muted || document.hidden) { sound.pause(); return; }
      playing = true;
      syncSound();
    }));
  }
  function playAmbience() {
    if (!alive || muted || !touched || document.hidden) return;
    initAudio();
    if (!rain) {
      hint.textContent = '声音暂不可用，可继续启程';
      return;
    }
    if (window.Howler.ctx && window.Howler.ctx.state === 'suspended') {
      window.Howler.ctx.resume().catch(() => {});
    }
    [[rain, .40, 1000], [music, .25, 1800]].forEach(([sound, volume, fade]) => {
      if (!sound.playing() && !pendingSounds.has(sound)) {
        pendingSounds.add(sound);
        sound.volume(0);
        sound.play();
        sound.fade(0, volume, fade);
      }
    });
  }
  function unlockAudio(event) {
    if (event && event.target.closest && event.target.closest('#gateSound, #gateWeather, a')) return;
    touched = true;
    playAmbience();
  }
  function pauseAudio() {
    sounds.forEach((sound) => sound.pause());
    playing = false;
    syncSound();
  }

  // Fixed DOM pools; repeating timelines never accumulate nodes or tween handles.
  function makeRain() {
    const field = $('gateRainfall');
    field.replaceChildren();
    const width = gate.clientWidth + 160;
    const height = gate.clientHeight + 160;
    const count = gate.clientWidth < 700 ? 38 : 82;
    for (let i = 0; i < count; i++) {
      const near = i % 5 === 0;
      const drop = document.createElement('i');
      drop.className = 'rain-streak' + (near ? ' is-near' : '');
      drop.style.height = (near ? 55 : 19 + Math.random() * 23) + 'px';
      drop.style.opacity = String(near ? .30 : .12 + Math.random() * .22);
      field.appendChild(drop);
      const x = Math.random() * (width + 200);
      const duration = (near ? .65 : .95) + Math.random() * .55;
      const tween = gsap.fromTo(drop,
        { x: x, y: -80, rotation: 14 },
        { x: x - height * .25, y: height + 80, duration, ease: 'none', repeat: -1 }
      );
      tween.progress(Math.random());
      timelines.add(tween);
    }
  }
  function waterNode(layer, className) {
    const node = document.createElement('i');
    node.className = className;
    layer.appendChild(node);
    return node;
  }
  function makeSurfaceWater() {
    document.querySelectorAll('.rain-surface').forEach((surface) => {
      const layer = surface.querySelector('.surface-water');
      layer.replaceChildren();
      const width = surface.offsetWidth;
      const height = surface.offsetHeight;
      if (!width || !height) return;
      for (let slot = 0; slot < 2; slot++) {
        const x = width * (.32 + slot * .37);
        const incoming = waterNode(layer, 'water-drop');
        const impact = waterNode(layer, 'water-impact');
        const rim = waterNode(layer, 'water-rim');
        const beads = [waterNode(layer, 'water-drop'), waterNode(layer, 'water-drop')];
        const spray = Array.from({ length: 4 }, () => waterNode(layer, 'water-spray'));
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 + slot * 1.1, delay: slot * 1.9 + .4 });
        tl.set([incoming, impact, rim, ...beads, ...spray], { opacity: 0 })
          .set(incoming, { x: x + 20, y: -86, scaleX: .45, scaleY: 2.8, opacity: .55 })
          .to(incoming, { x, y: -4, duration: .31, ease: 'power1.in' })
          .set(incoming, { opacity: 0 })
          .fromTo(impact, { x: x - 6, y: -2, opacity: .7, scale: .2 }, { scaleX: 2.4, scaleY: .6, opacity: 0, duration: .45 }, .30)
          .fromTo(rim, { x, y: -.5, width: 1, opacity: .65 }, { x: 2, width: width - 4, opacity: 0, duration: 1.6, ease: 'power2.out' }, .34);
        spray.forEach((node, index) => {
          const side = index < 2 ? -1 : 1;
          const dx = side * (8 + index % 2 * 12);
          tl.fromTo(node, { x, y: -2, opacity: .75, scale: 1 }, { x: x + dx, y: -8 - index % 2 * 6, duration: .16, ease: 'power2.out' }, .31)
            .to(node, { x: x + dx * 1.7, y: 10, opacity: 0, duration: .32, ease: 'power2.in' }, .47);
        });
        beads.forEach((bead, side) => {
          const edge = side ? width - 3 : -1;
          tl.fromTo(bead, { x, y: -2, opacity: .8, scaleX: 1.6, scaleY: .45 },
            { x: edge, y: -1, scaleX: .9, scaleY: .75, duration: 1.15 + side * .17, ease: 'power2.out' }, .33)
            .to(bead, { y: 6, scaleX: .7, scaleY: 1.3, duration: .27, ease: 'sine.inOut' }, 1.58 + side * .17)
            .to(bead, { y: height - 3, scaleY: 1.7, duration: .85, ease: 'power1.in' }, 1.85 + side * .17)
            .to(bead, { y: height + 42, scaleX: .4, scaleY: 2.4, opacity: 0, duration: .32, ease: 'power2.in' }, 2.70 + side * .17);
        });
        timelines.add(tl);
      }
    });
  }
  function scheduleLightning(first) {
    if (lightningCall) lightningCall.kill();
    if (!moving() || !gsap) return;
    lightningCall = gsap.delayedCall(first ? 4.5 : 14 + Math.random() * 15, strike);
  }
  function strike() {
    lightningCall = null;
    if (!moving()) return;
    // Light first, then a distant field recording. Never strobe continuously.
    const flash = $('gateFlash');
    const cloud = $('gateCloudlight');
    const bolt = $('gateLightning');
    const tl = gsap.timeline({ onComplete: () => { timelines.delete(tl); scheduleLightning(false); } });
    timelines.add(tl);
    tl.to(cloud, { opacity: .52, duration: .11, ease: 'power2.out' }, 0)
      .to(flash, { opacity: .13, duration: .10 }, 0)
      .to(bolt, { opacity: .65, duration: .05 }, .04)
      .to(bolt, { opacity: 0, duration: .24 }, .11)
      .to(cloud, { opacity: .09, duration: .25 }, .13)
      .to(flash, { opacity: 0, duration: .42 }, .13)
      .to(cloud, { opacity: .30, duration: .14 }, .53)
      .to(cloud, { opacity: 0, duration: 1.35, ease: 'sine.out' }, .67);
    thunderCall = gsap.delayedCall(1.2 + Math.random() * 1.0, () => {
      thunderCall = null;
      if (!moving() || muted || !playing || !thunder) return;
      thunder.stop();
      thunder.volume(.30 + Math.random() * .08);
      thunder.play();
    });
  }

  function destroyGlass() {
    if (glassTick && gsap) gsap.ticker.remove(glassTick);
    glassTick = null;
    if (glass) {
      try { glass.stop(); } catch (_) {}
      glass = null;
    }
    canvas.classList.remove('is-on');
    glassContext = null;
    // Never WEBGL_lose_context.loseContext(): Chrome/Safari can broadcast
    // webglcontextlost to Godot's canvas and alert "please reload the page".
    if (canvas.parentNode) canvas.remove();
  }
  function glassBackground() {
    const scale = Math.min(1, 1440 / gate.clientWidth);
    const w = Math.round(gate.clientWidth * scale);
    const h = Math.round(gate.clientHeight * scale);
    const background = document.createElement('canvas');
    background.width = w; background.height = h;
    const context = background.getContext('2d');
    const cover = Math.max(w / scene.naturalWidth, h / scene.naturalHeight);
    const iw = scene.naturalWidth * cover, ih = scene.naturalHeight * cover;
    context.drawImage(scene, (w - iw) * .61, (h - ih) * .5, iw, ih);
    return background;
  }
  async function startGlass() {
    if (heavyPaused || !window.RaindropFX || !gsap || glassStarting || glass || !moving() || gate.clientWidth < 900) return;
    glassStarting = true;
    let fx = null;
    try {
      if (!scene.complete) await scene.decode();
      if (!alive || !moving() || heavyPaused) return;
      glassContext = canvas.getContext('webgl2');
      if (!glassContext) return;
      // Render at bounded resolution; the original sharp photograph remains underneath.
      const background = glassBackground();
      const w = background.width, h = background.height;
      canvas.width = w; canvas.height = h;
      fx = new RaindropFX({ canvas, width: w, height: h,
        spawnInterval: [.55, 1.1], spawnSize: [16, 32], spawnLimit: 45,
        gravity: 1700, slipRate: .65, evaporate: 22,
        xShifting: [.01, .04], dropletsPerSeconds: 12, dropletSize: [3, 9],
        backgroundBlurSteps: 0, mist: false, refractBase: .2, refractScale: .3,
        raindropDiffuseLight: [.22, .27, .29], raindropSpecularLight: [.08, .10, .11],
        raindropLightPos: [.65, .2, 2, 1]
      });
      await fx.setBackground(background);
      await fx.start();
      fx.stop();
      if (!alive || heavyPaused) {
        try { fx.stop(); } catch (_) {}
        canvas.classList.remove('is-on');
        if (!alive) destroyGlass();
        return;
      }
      glass = fx;
      // The pinned library exposes update(); share GSAP's lifecycle instead of a second RAF loop.
      let last = 0;
      glassTick = (time) => {
        if (!moving() || gate.clientWidth < 900 || time - last < 1 / 30) return;
        last = time;
        glass.update({ dt: 1 / 30, total: time });
      };
      gsap.ticker.add(glassTick);
      canvas.classList.add('is-on');
    } catch (error) {
      if (fx) fx.stop();
      canvas.classList.remove('is-on');
      console.info('Night gate: using the lightweight rain layer.', error.message);
    } finally { glassStarting = false; }
  }
  function buildMotion() {
    if (!gsap || !alive) return;
    timelines.forEach((tl) => tl.kill());
    timelines.clear();
    gsap.set([$('gateFlash'), $('gateCloudlight'), $('gateLightning')], { opacity: 0 });
    makeRain();
    makeSurfaceWater();
    timelines.add(gsap.to('.gate-mist--far', { xPercent: 7, opacity: .19, duration: 19, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
    timelines.add(gsap.to('.gate-mist--near', { xPercent: -6, duration: 14, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
    applyWeather();
  }
  function applyWeather() {
    const enabled = weather && !motionQuery.matches && !!gsap;
    gate.classList.toggle('is-still', !enabled);
    gate.classList.toggle('is-paused', document.hidden);
    weatherButton.setAttribute('aria-pressed', String(enabled));
    weatherButton.disabled = motionQuery.matches || !gsap;
    weatherButton.title = motionQuery.matches ? '已遵循系统的减少动态效果设置' : '切换雨、雾与雷电动画';
    $('weatherState').textContent = enabled ? '开' : '静';
    timelines.forEach((tl) => moving() ? tl.resume() : tl.pause());
    if (!moving()) {
      if (lightningCall) lightningCall.kill();
      if (thunderCall) thunderCall.kill();
      lightningCall = thunderCall = null;
      if (thunder) thunder.stop();
      if (gsap) gsap.set([$('gateFlash'), $('gateCloudlight'), $('gateLightning')], { opacity: 0 });
    } else {
      scheduleLightning(true);
      startGlass();
    }
  }
  function onResize() {
    if (!alive) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!alive) return;
      buildMotion();
      if (glass && gate.clientWidth >= 900) {
        const background = glassBackground();
        glass.resize(background.width, background.height);
        glass.setBackground(background).catch(() => canvas.classList.remove('is-on'));
      }
    }, 180);
  }
  function onMotionPreferenceChange() {
    if (motionQuery.matches && entrance) entrance.progress(1);
    if (!timelines.size && gsap && !motionQuery.matches) buildMotion();
    else applyWeather();
  }
  function ease() {
    heavyPaused = true;
    if (glassTick && gsap) gsap.ticker.remove(glassTick);
    glassTick = null;
    if (glass) {
      try { glass.stop(); } catch (_) {}
      glass = null;
    }
    if (canvas) canvas.classList.remove('is-on');
  }
  function restore() {
    heavyPaused = false;
    if (alive && moving()) startGlass();
  }
  function stopAll() {
    if (!alive) return;
    alive = false;
    events.abort();
    motionQuery.removeEventListener('change', onMotionPreferenceChange);
    clearTimeout(resizeTimer);
    pendingSounds.clear();
    timelines.forEach((tl) => tl.kill()); timelines.clear();
    if (entrance) entrance.kill();
    if (lightningCall) lightningCall.kill();
    if (thunderCall) thunderCall.kill();
    destroyGlass();
    sounds.forEach((sound) => sound.unload());
    sounds = [];
    gate.classList.add('is-paused');
  }

  window.NightGateAtmosphere = { stop: stopAll, ease: ease, restore: restore };
  soundButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!touched) { touched = true; muted = false; }
    else muted = !muted;
    savePreference('night-gate-muted', muted ? '1' : '0');
    if (muted) pauseAudio(); else playAmbience();
    syncSound();
  }, { signal: events.signal });
  weatherButton.addEventListener('click', () => {
    weather = !weather;
    savePreference('night-gate-weather', weather ? '1' : '0');
    applyWeather();
  }, { signal: events.signal });
  gate.addEventListener('pointerdown', unlockAudio, { signal: events.signal });
  gate.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') unlockAudio(event);
  }, { signal: events.signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAudio(); else playAmbience();
    applyWeather();
  }, { signal: events.signal });
  window.addEventListener('resize', onResize, { signal: events.signal });
  // pagehide may enter the back-forward cache: pause here, dispose only on game entry.
  window.addEventListener('pagehide', pauseAudio, { signal: events.signal });
  window.addEventListener('pageshow', () => { applyWeather(); playAmbience(); }, { signal: events.signal });
  motionQuery.addEventListener('change', onMotionPreferenceChange);
  syncSound();
  if (gsap && !motionQuery.matches) {
    entrance = gsap.from('.gate-kicker, .gate-title-wrap, .gate-tagline, .gate-story, .gate-actions', {
      opacity: 0, y: 14, duration: 1.4, stagger: .12, ease: 'power2.out', clearProps: 'opacity,transform'
    });
    buildMotion();
  } else applyWeather();
})();
