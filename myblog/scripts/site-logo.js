'use strict';

const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../source/images/boomery-logo.svg');
const LOGO_SVG = fs.readFileSync(LOGO_PATH, 'utf8').trim();
const LOGO_MARK = LOGO_SVG.replace(/\sid="[^"]+"/g, '');

const FAVICON_TAG = '<link rel="icon" href="/images/boomery-logo.svg" type="image/svg+xml" />';
const BRAND_LOGO = `<span class="site-logo" aria-hidden="true">${LOGO_MARK}</span>`;

hexo.extend.filter.register('after_render:html', str => {
  if (!str.includes('class="site-title"')) return str;

  let out = str;
  if (!out.includes('boomery-logo.svg')) {
    out = out.replace('</head>', `${FAVICON_TAG}\n</head>`);
  }

  out = out.replace(
    /<a([^>]*class="brand"[^>]*)>\s*<i class="logo-line"><\/i>\s*<h1 class="site-title">/g,
    (match, attrs) => {
      const merged = attrs.includes('site-brand-link')
        ? attrs
        : attrs.replace('class="brand"', 'class="brand site-brand-link"');
      return `<a${merged}>${BRAND_LOGO}<h1 class="site-title">`;
    }
  );
  out = out.replace(/<\/h1>\s*<i class="logo-line"><\/i>/g, '</h1>');

  return out;
});
