import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { blogPosts, getBlogPost } from '../posts';

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: 'Blog',
    };
  }

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) notFound();

  return (
    <article style={{ maxWidth: 820, margin: '0 auto' }}>
      <Link href="/blog" style={{ textDecoration: 'none', color: '#1D4ED8', fontWeight: 700, fontSize: 14 }}>
        {'<- Back to Blog'}
      </Link>

      <header style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: '#F3F4F6',
              color: '#374151',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {post.category}
          </span>
          <span style={{ color: '#6B7280', fontSize: 13 }}>{post.readingTime}</span>
          <span style={{ color: '#6B7280', fontSize: 13 }}>{post.publishedAt}</span>
        </div>

        <h1 style={{ margin: '14px 0 0', fontSize: 'clamp(32px, 5vw, 46px)', letterSpacing: '-0.03em', lineHeight: 1.08 }}>
          {post.title}
        </h1>
        <p style={{ margin: '14px 0 0', color: '#556070', lineHeight: 1.8, fontSize: 18 }}>
          {post.description}
        </p>
      </header>

      <div
        style={{
          marginTop: 24,
          padding: '22px 20px',
          borderRadius: 20,
          background: '#fff',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        }}
      >
        {post.content.map((block, index) => {
          if (block.type === 'heading') {
            return (
              <h2 key={index} style={{ margin: index === 0 ? 0 : '28px 0 0', fontSize: 24, letterSpacing: '-0.02em' }}>
                {block.text}
              </h2>
            );
          }

          if (block.type === 'list') {
            return (
              <ul key={index} style={{ margin: '14px 0 0', paddingLeft: 22, color: '#374151', lineHeight: 1.8 }}>
                {block.items.map((item) => (
                  <li key={item} style={{ margin: '8px 0' }}>
                    {item}
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={index} style={{ margin: '14px 0 0', color: '#374151', lineHeight: 1.85, fontSize: 16 }}>
              {block.text}
            </p>
          );
        })}
      </div>
    </article>
  );
}
