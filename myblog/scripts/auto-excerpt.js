'use strict';

/**
 * 首页自动摘要：无 <!--more--> 且无 description 的文章，只显示部分内容。
 */

const EXCERPT_LENGTH = 280;

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildExcerpt(html) {
  const firstP = html.match(/<p[^>]*>[\s\S]*?<\/p>/i);
  if (firstP) {
    const text = stripHtml(firstP[0]);
    if (text.length > 0 && text.length <= EXCERPT_LENGTH + 40) {
      return firstP[0];
    }
  }

  const text = stripHtml(html);
  if (text.length <= EXCERPT_LENGTH) return html;

  return `<p>${text.slice(0, EXCERPT_LENGTH)}…</p>`;
}

function hasMoreTag(post) {
  return Boolean(post.more && stripHtml(post.more).length > 0);
}

hexo.extend.filter.register('template_locals', locals => {
  const { page } = locals;
  if (!page?.posts || page.layout !== 'index') return locals;

  const useDescription = hexo.theme.config.excerpt_description;

  page.posts.forEach(post => {
    if (useDescription && post.description) return;
    if (hasMoreTag(post)) return;

    const html = post.excerpt || post.content || '';
    const text = stripHtml(html);
    if (text.length <= EXCERPT_LENGTH) return;

    post.excerpt = buildExcerpt(html);
  });

  return locals;
});
