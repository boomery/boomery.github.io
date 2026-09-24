'use strict';

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
