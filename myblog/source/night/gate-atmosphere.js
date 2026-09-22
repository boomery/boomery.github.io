(function () {
  const MUTE_KEY = 'night-gate-muted';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const gate = document.getElementById('gate');
  const flash = document.getElementById('gateFlash');
  const rainBg = document.getElementById('rainBg');
  const enterBtn = document.getElementById('enterBtn');
  const logoWrap = document.getElementById('logoWrap') || document.querySelector('.gate-logo');
  const card = document.querySelector('.gate-card');
  const soundBtn = document.getElementById('gateSound');
  const listenHint = document.getElementById('gateListen');

  if (!gate) return;

  let muted = localStorage.getItem(MUTE_KEY) === '1';
  let alive = true;
  let unlocked = false;
  let rainHowl = null;
  let bgmHowl = null;
  let bgFx = null;
  let lightningTimer = 0;
  let tweens = [];

  function hasWebGL2() {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch (err) {
      return false;
    }
  }

  function paintNightGlass(width, height) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, width);
    c.height = Math.max(2, height);
    const g = c.getContext('2d');
    const sky = g.createRadialGradient(width * 0.5, height * 0.02, 20, width * 0.5, height * 0.08, height * 0.72);
    sky.addColorStop(0, '#4a1c16');
    sky.addColorStop(0.28, '#1a100e');
    sky.addColorStop(1, '#070605');
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);
    const corner = g.createRadialGradient(width * 0.86, height * 0.92, 0, width * 0.86, height * 0.92, height * 0.55);
    corner.addColorStop(0, 'rgba(42, 32, 78, 0.45)');
    corner.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = corner;
    g.fillRect(0, 0, width, height);
    g.strokeStyle = 'rgba(239, 230, 214, 0.045)';
    g.lineWidth = 1;
    for (let x = 0; x < width; x += 48) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, height); g.stroke();
    }
    for (let y = 0; y < height; y += 48) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(width, y); g.stroke();
    }
    return c;
  }

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w: canvas.width, h: canvas.height };
  }

  function nightOptions() {
    const mobile = window.innerWidth < 720;
    return {
      spawnInterval: mobile ? [0.12, 0.22] : [0.06, 0.14],
      spawnSize: mobile ? [18, 42] : [22, 64],
      spawnLimit: mobile ? 180 : 320,
      slipRate: 0.78,
      xShifting: [0.08, 0.2],
      gravity: 2400,
      evaporate: 16,
      mist: false,
      backgroundBlurSteps: 3,
      dropletsPerSeconds: mobile ? 36 : 72,
      dropletSize: [8, 22],
      raindropDiffuseLight: [0.42, 0.28, 0.18],
      raindropLightPos: [0.5, 0.08, 1.6, 1],
      raindropSpecularLight: [0.16, 0.13, 0.1],
      raindropShadowOffset: 0.72,
    };
  }

  async function startFx(canvas) {
    if (!window.RaindropFX || !hasWebGL2() || reduceMotion) return null;
    const size = fitCanvas(canvas);
    if (size.w < 8 || size.h < 8) return null;
    try {
      const fx = new RaindropFX(Object.assign({
        canvas: canvas,
        width: size.w,
        height: size.h,
      }, nightOptions()));
      await fx.setBackground(paintNightGlass(size.w, size.h));
      await fx.start();
      canvas.classList.add('is-on');
      return fx;
    } catch (err) {
      console.warn('RaindropFX 未能启动', err);
      return null;
    }
  }

  function markPlaying() {
    unlocked = true;
    hideHint();
  }

  function playIfAllowed(howl, targetVol, fadeMs) {
    if (!howl || muted) return;
    try {
      if (!howl.playing()) howl.play();
      howl.fade(howl.volume(), targetVol, fadeMs);
    } catch (err) {}
  }

  function hideHint() {
    if (listenHint) listenHint.classList.add('is-gone');
  }

  function syncSoundBtn() {
    if (!soundBtn) return;
    soundBtn.classList.toggle('is-muted', muted);
    soundBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    soundBtn.title = muted ? '开雨声' : '闭雨声';
    soundBtn.textContent = muted ? '静' : '雨';
  }

  function setMuted(next) {
    muted = next;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    syncSoundBtn();
    if (!rainHowl || !bgmHowl) return;
    if (muted) {
      rainHowl.fade(rainHowl.volume(), 0, 280);
      bgmHowl.fade(bgmHowl.volume(), 0, 280);
    } else {
      playIfAllowed(rainHowl, 0.46, 500);
      playIfAllowed(bgmHowl, 0.32, 900);
    }
  }

  function unlockAudio() {
    if (!alive) return;
    if (muted) {
      hideHint();
      return;
    }
    playIfAllowed(rainHowl, 0.46, 700);
    playIfAllowed(bgmHowl, 0.32, 1200);
  }

  function flashLightning() {
    if (!flash || !window.gsap || !alive) return;
    const tl = gsap.timeline();
    tl.set(flash, { opacity: 0 })
      .to(flash, { opacity: 0.07, duration: 0.04, ease: 'power1.out' })
      .to(flash, { opacity: 0, duration: 0.18, ease: 'power2.in' })
      .to(flash, { opacity: 0.04, duration: 0.05, delay: 0.1 })
      .to(flash, { opacity: 0, duration: 0.55, ease: 'power2.out' });
    scheduleLightning();
  }

  function scheduleLightning() {
    if (!alive || reduceMotion) return;
    lightningTimer = window.setTimeout(flashLightning, 11000 + Math.random() * 16000);
  }

  function startBeads() {
    if (!window.gsap || reduceMotion) return;
    const wrap = document.getElementById('enterWrap');
    if (!wrap) return;
    const beads = wrap.querySelectorAll('.gate-bead');
    beads.forEach(function (bead, i) {
      function loop() {
        if (!alive || !enterBtn || enterBtn.classList.contains('is-hidden')) {
          gsap.set(bead, { opacity: 0 });
          return;
        }
        const w = wrap.offsetWidth;
        const h = wrap.offsetHeight;
        const startX = 12 + Math.random() * Math.max(8, w - 24);
        const goLeft = startX > w / 2 ? Math.random() < 0.72 : Math.random() < 0.28;
        const rimX = goLeft ? 4 + Math.random() * 8 : w - 12 - Math.random() * 8;
        gsap.set(bead, {
          x: startX,
          y: -8,
          opacity: 0,
          scaleX: 0.55 + Math.random() * 0.35,
          scaleY: 0.75 + Math.random() * 0.4,
        });
        const tl = gsap.timeline({
          delay: 0.08 + Math.random() * 0.7,
          onComplete: loop,
        });
        tweens.push(tl);
        tl.to(bead, { opacity: 0.92, y: 2, duration: 0.18, ease: 'power2.out' })
          .to(bead, { scaleY: 0.45, scaleX: 1.15, duration: 0.08, ease: 'power1.out' })
          .to(bead, { scaleY: 0.85, scaleX: 0.7, duration: 0.12, ease: 'sine.out' })
          .to(bead, {
            x: rimX,
            y: 4 + Math.random() * 6,
            duration: 0.7 + Math.random() * 0.55,
            ease: 'sine.inOut',
          })
          .to(bead, {
            y: h + 12,
            scaleY: 1.15,
            scaleX: 0.45,
            opacity: 0,
            duration: 0.32 + Math.random() * 0.18,
            ease: 'power2.in',
          });
      }
      window.setTimeout(loop, 180 + i * 180);
    });
  }

  function startMotion() {
    if (!window.gsap || reduceMotion) return;
    if (logoWrap) {
      tweens.push(gsap.to(logoWrap, {
        y: -7,
        rotation: 1.6,
        duration: 3.4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      }));
      tweens.push(gsap.to(logoWrap, {
        boxShadow: '0 18px 50px rgba(0,0,0,0.45), 0 0 28px rgba(243, 201, 138, 0.28)',
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      }));
    }
    if (card) {
      gsap.from(card, { opacity: 0, y: 18, duration: 1.1, ease: 'power2.out' });
    }
    scheduleLightning();
  }

  async function startRain() {
    if (!rainBg) return;
    bgFx = await startFx(rainBg);
  }

  function startAudio() {
    if (!window.Howl) return;
    rainHowl = new Howl({
      src: ['audio/rain.mp3'],
      loop: true,
      volume: 0,
      html5: false,
    });
    bgmHowl = new Howl({
      src: ['audio/title.mp3'],
      loop: true,
      volume: 0,
      html5: false,
    });
    rainHowl.on('play', markPlaying);
    bgmHowl.on('play', markPlaying);
    rainHowl.once('unlock', unlockAudio);
    bgmHowl.once('unlock', unlockAudio);
    if (!muted) {
      playIfAllowed(rainHowl, 0.46, 1600);
      playIfAllowed(bgmHowl, 0.32, 2200);
      window.setTimeout(function () {
        if (!unlocked && listenHint) listenHint.classList.add('is-on');
      }, 900);
    } else {
      hideHint();
    }
  }

  function stopAll() {
    if (!alive) return;
    alive = false;
    window.clearTimeout(lightningTimer);
    tweens.forEach(function (t) { try { t.kill(); } catch (err) {} });
    tweens = [];
    if (window.gsap && flash) gsap.set(flash, { opacity: 0 });
    if (bgFx) {
      try { bgFx.stop(); } catch (err) {}
      try { bgFx.destroy(); } catch (err) {}
      bgFx = null;
    }
    if (rainBg) rainBg.classList.remove('is-on');
    if (rainHowl) {
      rainHowl.fade(rainHowl.volume(), 0, 700);
      window.setTimeout(function () { rainHowl.stop(); }, 760);
    }
    if (bgmHowl) {
      bgmHowl.fade(bgmHowl.volume(), 0, 900);
      window.setTimeout(function () { bgmHowl.stop(); }, 960);
    }
  }

  function onResize() {
    if (!alive || !bgFx || !rainBg) return;
    const size = fitCanvas(rainBg);
    bgFx.resize(size.w, size.h);
    bgFx.setBackground(paintNightGlass(size.w, size.h));
  }

  window.NightGateAtmosphere = {
    stop: stopAll,
  };

  syncSoundBtn();
  if (soundBtn) {
    soundBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      unlockAudio();
      setMuted(!muted);
    });
  }
  gate.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  document.addEventListener('visibilitychange', function () {
    if (!alive || muted || !rainHowl || !bgmHowl) return;
    if (document.hidden) {
      rainHowl.pause();
      bgmHowl.pause();
    } else {
      rainHowl.play();
      bgmHowl.play();
    }
  });
  window.addEventListener('resize', onResize);

  startAudio();
  startMotion();
  startBeads();
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  fontsReady.then(function () { return startRain(); }).catch(function () { startRain(); });
})();
