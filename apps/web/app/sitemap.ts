import type { MetadataRoute } from 'next';
import { blogPosts } from './blog/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://h1bfriend.com';

  return [
    { url: `${siteUrl}/`, lastModified: new Date() },
    { url: `${siteUrl}/blog`, lastModified: new Date() },
    { url: `${siteUrl}/companies`, lastModified: new Date() },
    { url: `${siteUrl}/jobs`, lastModified: new Date() },
    { url: `${siteUrl}/titles`, lastModified: new Date() },
    ...blogPosts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
    })),
  ];
}
