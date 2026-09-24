'use strict';

// Cover feedback is independent of the Gallery request and also runs on /works/.
(function () {
  document.querySelectorAll('.project').forEach(project => {
    const image = project.querySelector('.project-art');
    const status = project.querySelector('.project-loading');
    if (!image || !status) return;
    const label = status.querySelector('.project-loading-text');
    let settled = false;
    let timer;
    function finish(success) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      project.classList.remove('is-loading', 'is-slow');
      project.classList.add(success ? 'is-loaded' : 'is-error');
      status.hidden = success;
      label.textContent = success ? '' : '封面暂未加载，可直接进入体验';
    }
    image.addEventListener('load', () => finish(true), { once: true });
    image.addEventListener('error', () => finish(false), { once: true });
    // A warm cache may complete before the deferred script runs.
    if (image.complete) {
      finish(image.naturalWidth > 0);
      return;
    }
    project.classList.add('is-loading');
    label.textContent = '正在载入江湖…';
    status.hidden = false;
    timer = setTimeout(() => {
      project.classList.add('is-slow');
      label.textContent = '封面加载较慢，可先进入体验';
    }, 12000);
  });
})();

// The static Gallery entrance remains usable if the API or any image fails.
(async function () {
  const container = document.getElementById('home-photos');
  if (!container) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://gallery-api.boomery.top/api/photos', { signal: controller.signal });
    if (!response.ok) return;
    const photos = await response.json();
    if (!Array.isArray(photos)) return;
    const candidates = photos.filter(photo => {
      try { return new URL(photo.src).protocol === 'https:'; } catch { return false; }
    }).slice(0, 3);
    const tiles = await Promise.all(candidates.map(photo => new Promise(resolve => {
      const link = document.createElement('a');
      link.href = '/gallery/';
      const img = new Image();
      img.alt = photo.title || '打开 Gallery 浏览影像';
      img.decoding = 'async';
      const timer = setTimeout(() => resolve(null), 7000);
      img.onload = () => { clearTimeout(timer); link.append(img); resolve(link); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = photo.src;
    })));
    const visible = tiles.filter(Boolean);
    if (visible.length) {
      container.replaceChildren(...visible);
      container.style.gridTemplateColumns = `repeat(${visible.length}, minmax(0, 1fr))`;
    }
  } catch { /* Keep the static Gallery entrance. */ }
  finally { clearTimeout(timeout); }
})();
