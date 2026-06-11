'use strict';

/**
 * 首页策展：隐藏 archive 文章、featured 置顶、最多 5 篇
 */

const INDEX_LIMIT = 5;

hexo.extend.filter.register('template_locals', locals => {
  const { page } = locals;
  if (!page?.__index || !page.posts?.toArray) return locals;

  const curated = page.posts
    .toArray()
    .filter(post => !post.archive)
    .sort((a, b) => {
      const af = a.featured ? 1 : 0;
      const bf = b.featured ? 1 : 0;
      if (bf !== af) return bf - af;
      return b.date - a.date;
    })
    .slice(0, INDEX_LIMIT);

  page.posts.data = curated;
  page.posts.length = curated.length;

  return locals;
});
