'use client';

import React from 'react';
import PostCard from './PostCard';
import { motion } from 'framer-motion';

export default function Feed({ posts }: { posts: any[] }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-sm">暂无内容，快来分享第一篇吧！</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="break-inside-avoid"
          >
            <PostCard post={post} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
