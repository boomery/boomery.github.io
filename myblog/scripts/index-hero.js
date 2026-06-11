'use strict';

/**
 * 首页 Hero 区块：注入「AI × 个人数字空间」定位文案
 */

function buildHero(root) {
  const r = root.endsWith('/') ? root : `${root}/`;
  return `
<section class="home-hero" aria-label="站点介绍">
  <div class="home-hero__glow" aria-hidden="true"></div>
  <div class="home-hero__inner">
    <span class="home-hero__badge">AI × 个人数字空间</span>
    <h1 class="home-hero__title">在 boomery 构建我的数字人格</h1>
    <p class="home-hero__desc">
      这里不只是博客——是我在 AI 时代的一次个人表达实验：
      用文字记录思考，用 Gallery 存放审美，用工程把想法变成可浏览、可分享的数字空间。
    </p>
    <div class="home-hero__actions">
      <a class="home-hero__btn home-hero__btn--primary" href="${r}gallery/">进入 Gallery</a>
      <a class="home-hero__btn home-hero__btn--ghost" href="${r}categories/技术/">阅读技术思考</a>
      <a class="home-hero__btn home-hero__btn--ghost" href="${r}about">关于我</a>
    </div>
    <ul class="home-hero__tags" aria-label="内容方向">
      <li>产品方案</li>
      <li>工程实现</li>
      <li>审美表达</li>
    </ul>
  </div>
</section>
<div class="home-posts-label">最新记录</div>`;
}

hexo.extend.filter.register('after_render:html', str => {
  if (!str.includes('main-inner index posts-expand')) return str;

  const hero = buildHero(hexo.config.root || '/');
  return str.replace(
    '<div class="main-inner index posts-expand">',
    `<div class="main-inner index posts-expand">${hero}`
  );
});
