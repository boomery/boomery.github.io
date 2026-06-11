'use strict';

/**
 * 首页 Hero 粒子动画（轻量 canvas）
 */

const PARTICLE_SCRIPT = `
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var canvas = document.getElementById('heroParticles');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dots = [];
  var raf = null;
  var w = 0, h = 0;

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = Math.floor(rect.width);
    h = canvas.height = Math.floor(rect.height);
  }

  function init() {
    resize();
    dots = Array.from({ length: Math.min(48, Math.floor(w * h / 9000)) || 24 }, function () {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.4,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        a: Math.random() * 0.45 + 0.15,
      };
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < dots.length; i++) {
      for (var j = i + 1; j < dots.length; j++) {
        var dx = dots[i].x - dots[j].x;
        var dy = dots[i].y - dots[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(74,95,212,' + (0.12 * (1 - dist / 110)) + ')';
          ctx.lineWidth = 0.6;
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.stroke();
        }
      }
    }
    dots.forEach(function (d) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0 || d.x > w) d.vx *= -1;
      if (d.y < 0 || d.y > h) d.vy *= -1;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(74,95,212,' + d.a + ')';
      ctx.fill();
    });
    raf = requestAnimationFrame(draw);
  }

  init();
  draw();
  window.addEventListener('resize', init);
})();
`;

hexo.extend.filter.register('after_render:html', str => {
  if (!str.includes('id="heroParticles"')) return str;
  return str.replace('</body>', `<script>${PARTICLE_SCRIPT}</script>\n</body>`);
});
