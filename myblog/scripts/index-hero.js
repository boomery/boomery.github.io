'use strict';

// Keep the writing index separate from the curated homepage.
hexo.extend.generator.register('creative-home', locals => [
  { path: 'index.html', layout: 'creative-home', data: { title: 'boomery · 个人创作空间', posts: locals.posts.sort('-date').limit(3), worksOnly: false } },
  { path: 'works/index.html', layout: 'creative-home', data: { title: '作品 · boomery', worksOnly: true } }
]);
