'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, ImageIcon, FileText, Upload, X, RefreshCw, ZoomIn, Download, ChevronRight, MessageSquare, Video, Play } from 'lucide-react';
import { toast } from 'sonner';

interface GenerationResult {
  titles: string[];
  images: Record<string, string>;
}

const IMAGE_SIZES = {
  '1340x1787': { width: 1340, height: 1787, label: '1340×1787 (3:4 竖图)', ratio: '3:4' },
  '800x800': { width: 800, height: 800, label: '800×800 (1:1 方图)', ratio: '1:1' },
};

const IMAGE_LABELS: Record<string, string> = {
  main_img: '主图',
  model_img: '模特上身图',
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSize, setImageSize] = useState<'1340x1787' | '800x800'>('1340x1787');

  useEffect(() => { setMounted(true); }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
      reader.readAsDataURL(file);
      setResult(null);
    }
  }, []);

  const handleGenerate = async () => {
    if (!uploadedFile) { toast.error('请先上传商品图片'); return; }
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);
      formData.append('imagePrompts', JSON.stringify({}));
      formData.append('imageSize', imageSize);
      const response = await fetch('/api/generate', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('生成请求失败');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.titles) {
        setResult({ titles: data.titles, images: data.images || {} });
        toast.success('生成成功！');
      }
    } catch (error) {
      console.error('生成失败:', error);
      toast.error(error instanceof Error ? error.message : '生成失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const currentSize = IMAGE_SIZES[imageSize];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">电商商品标题生成器</h1>
          <p className="text-muted-foreground">上传商品图片，AI 帮你生成爆款标题</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>上传商品图片</CardTitle>
              <CardDescription>支持 JPG、PNG 图片，建议尺寸 800×800 以上</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center gap-2">
                {uploadedImage ? <img src={uploadedImage} alt="预览" className="max-h-64 object-contain" /> : <><Upload className="w-12 h-12 text-muted-foreground" /><span className="text-muted-foreground">点击上传图片</span></>}
              </button>
              {uploadedImage && (
                <Button variant="outline" size="sm" onClick={() => { setUploadedImage(null); setUploadedFile(null); setResult(null); }}>
                  <X className="w-4 h-4 mr-2" /> 清除图片
                </Button>
              )}
              <div className="space-y-2">
                <Label>图片尺寸</Label>
                <Select value={imageSize} onValueChange={(v: '1340x1787' | '800x800') => setImageSize(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1340x1787">1340×1787 (3:4 竖图) - Temu</SelectItem>
                    <SelectItem value="800x800">800×800 (1:1 方图) - 其他平台</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerate} disabled={!uploadedFile || isLoading} className="w-full" size="lg">
                {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 生成中...</> : <><Sparkles className="w-4 h-4 mr-2" /> AI生成标题</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>生成结果</CardTitle>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] text-center text-muted-foreground">
                  <FileText className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg">上传图片后点击生成</p>
                  <p className="text-sm mt-2">AI 将分析商品并生成爆款标题</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2"><FileText className="w-4 h-4" /> 爆款标题</h3>
                  <div className="space-y-2">
                    {result.titles.map((title, index) => (
                      <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border-l-4 border-blue-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => { navigator.clipboard.writeText(title); toast.success('标题已复制到剪贴板'); }}>
                        <p className="font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground mt-1">点击复制</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
