'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Loader2, ImagePlus, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const MAX_IMAGES = 9;

import { SUPPORTED_CITIES_CN } from '@/lib/constants/cities';

export default function CreatePostModal() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const previewUrls = useMemo(() => selectedFiles.map((file) => URL.createObjectURL(file)), [selectedFiles]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    city: '',
    tags: '',
    category: 'Life',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('请先登录');
      }

      if (selectedFiles.length === 0) {
        throw new Error('请至少上传一张图片');
      }

      const token = await user.getIdToken();
      const uploadedFileIds: string[] = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        const payload = new FormData();
        payload.append('file', file);
        payload.append('userId', user.uid);

        const uploadRes = await axios.post('/api/upload', payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        uploadedFileIds.push(uploadRes.data.fileId);
        setUploadProgress(Math.round(((index + 1) / selectedFiles.length) * 100));
      }

      await axios.post(
        '/api/posts',
        {
          title: formData.title,
          content: formData.content,
          images: uploadedFileIds,
          userId: user.uid,
          city: formData.city,
          tags: formData.tags,
          category: formData.category,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setOpen(false);
      setSelectedFiles([]);
      setUploadProgress(0);
      setErrorMessage('');
      setFormData({ title: '', content: '', city: '', tags: '', category: 'Life' });
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.error || '发布失败，请稍后重试');
        return;
      }

      if (error instanceof Error) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage('发布失败，请稍后重试');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || mutation.isPending) return;

    setErrorMessage('');
    setUploadProgress(0);
    mutation.mutate();
  };

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list) {
      return;
    }

    const files = Array.from(list);
    const next = [...selectedFiles, ...files].slice(0, MAX_IMAGES);
    setSelectedFiles(next);

    if (selectedFiles.length + files.length > MAX_IMAGES) {
      setErrorMessage(`最多只能上传 ${MAX_IMAGES} 张图片`);
    }
  };

  const removeFileAtIndex = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="rounded-full bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-200">
            <Plus className="h-4 w-4 mr-1" /> 发布内容
          </Button>
        }
      />
      <DialogContent className="max-w-[calc(100%-1rem)] w-full sm:max-w-2xl rounded-3xl p-0 max-h-[92dvh] overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold">分享你的发现</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col h-[calc(92dvh-3rem)]">
          <div className="space-y-4 p-5 pb-24 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="images">图片（最多9张）</Label>
              <label
                htmlFor="images"
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500 cursor-pointer"
              >
                <ImagePlus className="h-8 w-8 mb-2" />
                <span className="text-sm">点击上传，或在手机上拍照/选相册</span>
                <span className="text-xs text-slate-400 mt-1">支持 JPG / PNG / WebP / HEIC</span>
              </label>
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleSelectFiles}
              />

              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="relative rounded-xl overflow-hidden bg-slate-100 aspect-square">
                      <img src={previewUrls[index]} alt={file.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                        onClick={() => removeFileAtIndex(index)}
                        aria-label="删除图片"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                placeholder="起一个吸引人的标题"
                className="rounded-xl"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">正文</Label>
              <Textarea
                id="content"
                placeholder="分享你的真实经历和建议"
                className="rounded-xl min-h-28"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">城市</Label>
                <select
                  id="city"
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                >
                  <option value="">选择城市 (可选)</option>
                  {SUPPORTED_CITIES_CN.map((city: string) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                  <option value="Other">其他</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">分类</Label>
                <select
                  id="category"
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Life">生活</option>
                  <option value="Job">职场</option>
                  <option value="Immigration">移民</option>
                  <option value="Study">留学</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">标签（逗号分隔）</Label>
              <Input
                id="tags"
                placeholder="移民, 求职, 合租"
                className="rounded-xl"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>

            {uploadProgress > 0 && mutation.isPending && (
              <p className="text-sm text-slate-500">图片上传中：{uploadProgress}%</p>
            )}

            {errorMessage && <p className="text-sm text-rose-500">{errorMessage}</p>}
          </div>

          <div className="sticky bottom-0 p-4 border-t border-slate-100 bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <Button
              type="submit"
              className="w-full rounded-xl bg-rose-500 hover:bg-rose-600 h-11"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '立即发布'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
