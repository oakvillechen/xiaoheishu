'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { cloudinaryThumb } from '@/lib/image-url';

export type EditableProfile = { displayName: string | null; photoURL: string | null; bio: string | null };

const NAME_MAX = 30;
const BIO_MAX = 200;

export default function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  bioAvailable,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: EditableProfile;
  bioAvailable: boolean;
  onSaved: (next: EditableProfile) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(profile.displayName || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [photo, setPhoto] = useState(profile.photoURL);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const message = (e: unknown, fallback: string) =>
    (axios.isAxiosError(e) && (e.response?.data as { error?: string })?.error) || fallback;

  const handleFile = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return setError('请选择图片文件');
    if (file.size > 10 * 1024 * 1024) return setError('图片不能超过 10MB');
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('userId', user.uid);
      const res = await axios.post('/api/upload', form, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      setPhoto(res.data.url || res.data.fileId);
    } catch (e) {
      setError(message(e, '头像上传失败，请稍后重试'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return setError('昵称不能为空');
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, string | null> = { displayName: trimmed };
      if (photo !== profile.photoURL) payload.photoURL = photo;
      if (bioAvailable) payload.bio = bio.trim() || null;
      const res = await axios.patch('/api/users/me', payload, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const bioIgnored = Array.isArray(res.data?.ignoredFields) && res.data.ignoredFields.includes('bio');
      onSaved({ displayName: trimmed, photoURL: photo, bio: bioIgnored ? profile.bio : bio.trim() || null });
      onOpenChange(false);
    } catch (e) {
      setError(message(e, '保存失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑资料</DialogTitle>
          <DialogDescription>昵称、头像和简介会显示在你的主页和笔记上</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100"
              aria-label="更换头像"
            >
              {photo ? (
                <img src={cloudinaryThumb(photo, 160)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-400">
                  {name[0] || 'U'}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-1 text-white">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <p className="text-xs text-slate-500">点击头像更换，支持 JPG / PNG / WebP，不超过 10MB</p>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">昵称</span>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-rose-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 flex justify-between text-sm font-medium text-slate-700">
              简介 <span className="text-xs font-normal text-slate-400">{Array.from(bio).length}/{BIO_MAX}</span>
            </span>
            <textarea
              value={bio}
              maxLength={BIO_MAX}
              disabled={!bioAvailable}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder={bioAvailable ? '介绍一下自己吧，比如：Oakville 新移民，分享租房和带娃日常' : '简介功能暂未开放'}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400 disabled:bg-slate-50"
            />
          </label>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || uploading} className="bg-rose-500 hover:bg-rose-600">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
