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

interface VideoResult {
  videoUrl: string;
  videoType: string;
  prompt: string;
}

// 图片尺寸配置
const IMAGE_SIZES = {
  '1340x1787': { width: 1340, height: 1787, label: '1340×1787 (3:4 竖图)', ratio: '3:4' },
  '800x800': { width: 800, height: 800, label: '800×800 (1:1 方图)', ratio: '1:1' },
};

const IMAGE_LABELS: Record<string, string> = {
  main_img: '主图',
  model_img: '模特上身图',
  detail_img_1: '细节图1-面料',
  detail_img_2: '细节图2-缝线',
  detail_img_3: '细节图3-特性',
  feature_img: '功能说明图',
  scene_img: '场景图',
};

const DEFAULT_PROMPTS: Record<string, string> = {
  main_img: '专业电商主图，产品居中，专业影棚灯光，高质量，突出产品特点，优雅构图',
  model_img: '真人模特自然穿着效果，展示产品真实上身版型和垂感，服装与身体自然贴合，不露脸，自然站姿或走动姿势',
  detail_img_1: '产品面料纹理特写，微距摄影，展示面料材质和品质',
  detail_img_2: '产品缝线细节特写，微距摄影，展示缝制质量',
  detail_img_3: '产品材质特性特写，微距摄影，展示纽扣拉链等细节',
  feature_img: '产品卖点说明图，顶部大标题，中央产品平铺展示，四周环绕卖点标注，用指引线连接产品部位，每个卖点配图标和英文标签，如Quick Dry速干、Breathable透气、Elastic弹力等',
  scene_img: '生活场景图，欧洲男模特在自然环境中使用产品，不露脸',
};

const PLACEHOLDER_PROMPTS: Record<string, string> = {
  main_img: '例如：背景使用蓝色渐变，添加促销标签"NEW ARRIVAL"...',
  model_img: '例如：模特自然站立展示修身版型，或走动展示裙摆飘逸效果...',
  detail_img_1: '例如：聚焦领口位置，突出材质纹理...',
  detail_img_2: '例如：展示袖口缝线细节...',
  detail_img_3: '例如：展示拉链细节，强调品质感...',
  feature_img: '例如：标注Quick Dry速干、Breathable透气、Zipper Pockets拉链口袋、Elastic Waist弹力腰头等卖点...',
  scene_img: '例如：咖啡厅休闲场景，慵懒午后风格...',
};

// 视频类型配置
const VIDEO_TYPES = {
  'functional': { label: '功能型/工具类', desc: '真人实际使用场景展示商品核心功能' },
  'apparel': { label: '鞋服/饰品/彩妆类', desc: '真人试穿、试戴或试用展示效果' },
  'decor': { label: '装饰摆设类', desc: '真实家居环境展示装饰效果' },
};

// 视频比例配置
const VIDEO_RATIOS = {
  '3:4': { label: '3:4 竖版', desc: '适合移动端商品展示' },
  '1:1': { label: '1:1 方形', desc: '适合社交媒体分享' },
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 分类型图片生成要求
  const [imagePrompts, setImagePrompts] = useState<Record<string, string>>({});
  
  // 高级设置展开状态
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  // 图片尺寸选择
  const [imageSize, setImageSize] = useState<'1340x1787' | '800x800'>('1340x1787');
  
  // 视频生成相关状态
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [videoType, setVideoType] = useState<'functional' | 'apparel' | 'decor'>('apparel');
  const [videoRatio, setVideoRatio] = useState<'3:4' | '1:1'>('3:4');
  const [videoPrompt, setVideoPrompt] = useState('');
  
  // 当前标签页
  const [activeTab, setActiveTab] = useState<'images' | 'video'>('images');
  
  // 重绘对话框状态
  const [regenerateDialog, setRegenerateDialog] = useState<{ key: string; prompt: string } | null>(null);
  
  // 每张图片的历史提示词（用于重绘时保留上下文）
  const [imagePromptHistory, setImagePromptHistory] = useState<Record<string, string>>({});

  // 客户端挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }

    setUploadedFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    setResult(null);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setUploadedImage(null);
    setUploadedFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 生成进度状态
  const [generatingProgress, setGeneratingProgress] = useState<string>('');

  const handleGenerate = async () => {
    if (!uploadedFile) {
      toast.error('请先上传商品图片');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setGeneratingProgress('正在准备...');

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);
      formData.append('imagePrompts', JSON.stringify(imagePrompts));
      formData.append('imageSize', imageSize);

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('生成请求失败');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let tempResult: GenerationResult = {
        titles: [],
        images: {} as any,
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.step) {
                setGeneratingProgress(data.message || '处理中...');
              }
              
              if (data.titles) {
                tempResult.titles = data.titles;
                setResult({ titles: data.titles, images: tempResult.images });
                setGeneratingProgress('标题生成完成，正在生成图片...');
              }
              
              if (data.key && data.url) {
                const key = data.key as keyof typeof IMAGE_LABELS;
                tempResult.images[key] = data.url;
                // 批量更新，减少渲染次数
                setResult({ titles: tempResult.titles, images: { ...tempResult.images } });
                setGeneratingProgress(`${IMAGE_LABELS[key] || key} 生成完成`);
              }
              
              if (data.message === '生成完成') {
                toast.success('生成成功！');
                // 保存用户输入的提示词到历史记录
                setImagePromptHistory(imagePrompts);
              }
              
              if (data.error) {
                throw new Error(data.error);
              }
              
              if (data.message && data.message.includes('失败')) {
                throw new Error(data.message);
              }
            } catch (parseError) {
              // 只记录解析错误，不中断流程
              if (parseError instanceof SyntaxError) {
                // JSON 解析失败，忽略
              } else {
                // 其他错误，重新抛出
                throw parseError;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('生成失败:', error);
      toast.error(error instanceof Error ? error.message : '生成失败，请稍后重试');
    } finally {
      setIsLoading(false);
      setGeneratingProgress('');
    }
  };

  const handleOpenRegenerateDialog = (imageKey: string) => {
    // 获取该图片的历史提示词
    const historyPrompt = imagePromptHistory[imageKey] || '';
    setRegenerateDialog({
      key: imageKey,
      prompt: historyPrompt,
    });
  };

  const handleRegenerateImage = async () => {
    if (!regenerateDialog || !uploadedFile) {
      toast.error('请先上传商品图片');
      return;
    }

    const { key, prompt } = regenerateDialog;
    setRegeneratingKey(key);

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);
      
      // 获取历史提示词
      const historyPrompt = imagePromptHistory[key] || '';
      
      // 合并提示词：如果有新输入，则追加到历史提示词后面
      let finalPrompt = '';
      if (prompt.trim()) {
        // 用户输入了新的需求
        if (historyPrompt) {
          // 有历史记录，在历史基础上追加新需求
          finalPrompt = `${historyPrompt}，${prompt.trim()}`;
        } else {
          // 没有历史记录，使用新需求
          finalPrompt = prompt.trim();
        }
      } else {
        // 用户没有输入新需求，使用历史提示词
        finalPrompt = historyPrompt || imagePrompts[key]?.trim() || '';
      }
      
      formData.append('prompt', finalPrompt);
      formData.append('imageKey', key);
      formData.append('userPrompt', prompt.trim());
      formData.append('historyPrompt', historyPrompt);
      formData.append('imageSize', imageSize);
      const sizeConfig = IMAGE_SIZES[imageSize];
      formData.append('width', sizeConfig.width.toString());
      formData.append('height', sizeConfig.height.toString());

      const response = await fetch('/api/regenerate-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '重新生成失败');
      }

      // 更新单张图片
      setResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          images: {
            ...prev.images,
            [key]: data.imageUrl,
          },
        };
      });
      
      // 保存这次使用的提示词到历史记录
      setImagePromptHistory(prev => ({
        ...prev,
        [key]: finalPrompt,
      }));

      toast.success(`${IMAGE_LABELS[key]} 重新生成成功！`);
      setRegenerateDialog(null);
    } catch (error) {
      console.error('重新生成失败:', error);
      toast.error(error instanceof Error ? error.message : '重新生成失败，请稍后重试');
    } finally {
      setRegeneratingKey(null);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    if (!url) {
      toast.error('图片地址无效');
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('下载失败');
      }
      const blob = await response.blob();
      // 限制文件大小，防止内存溢出
      if (blob.size > 50 * 1024 * 1024) {
        toast.error('文件过大，请直接在新窗口打开下载');
        window.open(url, '_blank');
        return;
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // 延迟释放 URL，确保下载完成
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      toast.success('下载成功');
    } catch {
      toast.error('下载失败');
    }
  };

  // 视频生成
  const handleGenerateVideo = async () => {
    if (!uploadedFile) {
      toast.error('请先上传商品图片');
      return;
    }

    setIsGeneratingVideo(true);
    setVideoResult(null);

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);
      formData.append('videoType', videoType);
      formData.append('videoRatio', videoRatio);
      formData.append('prompt', videoPrompt.trim());

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '视频生成失败');
      }

      setVideoResult(data);
      toast.success('视频生成成功！');
    } catch (error) {
      console.error('视频生成失败:', error);
      toast.error(error instanceof Error ? error.message : '视频生成失败，请稍后重试');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const currentSize = IMAGE_SIZES[imageSize];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Temu 上新助手
            </h1>
          </div>
        </div>

        {/* 主要内容区 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 输入区域 */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                上传商品图片
              </CardTitle>
              <CardDescription>
                上传一张商品图片，输入您的需求，AI 将生成优化的标题和营销图片
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 图片上传区域 */}
              <div className="space-y-2">
                <Label className="text-base font-medium">商品图片</Label>
                <div
                  className="relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 hover:border-blue-500 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  {uploadedImage ? (
                    <div className="relative">
                      <img
                        src={uploadedImage}
                        alt="上传的商品图片"
                        className="max-h-80 mx-auto rounded-lg shadow-md"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage();
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <ImageIcon className="w-16 h-16 mb-4 opacity-40" />
                      <p className="text-lg font-medium">点击上传商品图片</p>
                      <p className="text-sm mt-2">支持 JPG、PNG、WebP 格式，最大 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 图片尺寸选择 */}
              <div className="space-y-2">
                <Label className="text-base font-medium">图片尺寸</Label>
                <Select value={imageSize} onValueChange={(v) => setImageSize(v as '1340x1787' | '800x800')}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择图片尺寸" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1340x1787">1340×1787 (3:4 竖图)</SelectItem>
                    <SelectItem value="800x800">800×800 (1:1 方图)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  3:4 竖图适合 Temu 商品展示，1:1 方图适合其他平台
                </p>
              </div>

              {/* 分类型图片生成要求 - 折叠面板 */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      高级设置：分类型图片要求
                    </span>
                    <ChevronRight className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-90' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    可针对每种图片类型分别设置要求，留空则使用默认风格生成
                  </p>
                  
                  {/* 主图和模特图 - 主要展示 */}
                  <div className="grid grid-cols-1 gap-4">
                    {['main_img', 'model_img', 'feature_img', 'scene_img'].map((key) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-sm font-medium flex items-center justify-between">
                          <span>{IMAGE_LABELS[key]}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {key === 'feature_img' ? '产品卖点图，指引线+图标+英文标签' : DEFAULT_PROMPTS[key]}
                          </span>
                        </Label>
                        <Textarea
                          placeholder={PLACEHOLDER_PROMPTS[key]}
                          value={imagePrompts[key] || ''}
                          onChange={(e) => setImagePrompts(prev => ({ ...prev, [key]: e.target.value }))}
                          rows={2}
                          className="resize-none text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  
                  {/* 细节图 - 折叠 */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                        <span>细节图设置</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-2">
                      {['detail_img_1', 'detail_img_2', 'detail_img_3'].map((key) => (
                        <div key={key} className="space-y-1.5">
                          <Label className="text-sm font-medium">{IMAGE_LABELS[key]}</Label>
                          <Textarea
                            placeholder={PLACEHOLDER_PROMPTS[key]}
                            value={imagePrompts[key] || ''}
                            onChange={(e) => setImagePrompts(prev => ({ ...prev, [key]: e.target.value }))}
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={handleGenerate}
                disabled={isLoading || !uploadedImage}
                className="w-full h-12 text-base font-medium"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {generatingProgress || '正在生成...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    开始生成
                  </>
                )}
              </Button>

              {isLoading && (
                <div className="text-center text-sm text-muted-foreground space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span>实时生成中，图片将逐张显示...</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 结果展示区域 */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                生成结果
              </CardTitle>
              <CardDescription>
                AI 生成的爆款标题和营销素材（点击图片可预览，不满意可重新生成）
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* 标签页切换 */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'images' | 'video')}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="images" className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    营销图片
                  </TabsTrigger>
                  <TabsTrigger value="video" className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    商品视频
                  </TabsTrigger>
                </TabsList>

                {/* 图片结果 */}
                <TabsContent value="images">
                  {!result ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] text-center text-muted-foreground">
                      <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-lg">上传图片后点击生成</p>
                      <p className="text-sm mt-2">AI 将分析商品并生成优化的标题和营销图片</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* 标题展示 */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          爆款标题
                        </h3>
                        <div className="space-y-2">
                          {result.titles.map((title, index) => (
                            <div
                              key={index}
                              className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border-l-4 border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              onClick={() => {
                                navigator.clipboard.writeText(title);
                                toast.success('标题已复制到剪贴板');
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  {title.split('\n').map((line, lineIndex) => (
                                    <p key={lineIndex} className={lineIndex === 0 ? "font-medium" : "text-sm text-muted-foreground mt-1"}>
                                      {line}
                                    </p>
                                  ))}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">点击复制</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 图片展示 */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          营销图片（{currentSize.label}）
                        </h3>
                        
                        {/* 主图和模特图 */}
                        <div className="grid grid-cols-2 gap-4">
                          {['main_img', 'model_img'].map((key) => (
                            <ImageCard
                              key={key}
                              imageKey={key}
                              url={result.images[key as keyof typeof result.images]}
                              label={IMAGE_LABELS[key]}
                              onPreview={() => setPreviewImage({ url: result.images[key as keyof typeof result.images], label: IMAGE_LABELS[key] })}
                              onRegenerate={() => handleOpenRegenerateDialog(key)}
                              onDownload={() => handleDownload(result.images[key as keyof typeof result.images], `${IMAGE_LABELS[key]}_${currentSize.width}x${currentSize.height}.png`)}
                              isRegenerating={regeneratingKey === key}
                            />
                          ))}
                        </div>

                        {/* 细节图 - 3张 */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">细节图</p>
                          <div className="grid grid-cols-3 gap-3">
                            {['detail_img_1', 'detail_img_2', 'detail_img_3'].map((key) => (
                              <ImageCard
                                key={key}
                                imageKey={key}
                                url={result.images[key as keyof typeof result.images]}
                                label={IMAGE_LABELS[key].replace('细节图', '')}
                                onPreview={() => setPreviewImage({ url: result.images[key as keyof typeof result.images], label: IMAGE_LABELS[key] })}
                                onRegenerate={() => handleOpenRegenerateDialog(key)}
                                onDownload={() => handleDownload(result.images[key as keyof typeof result.images], `${IMAGE_LABELS[key]}_${currentSize.width}x${currentSize.height}.png`)}
                                isRegenerating={regeneratingKey === key}
                                small
                              />
                            ))}
                          </div>
                        </div>

                        {/* 功能说明图和场景图 */}
                        <div className="grid grid-cols-2 gap-4">
                          {['feature_img', 'scene_img'].map((key) => (
                            <ImageCard
                              key={key}
                              imageKey={key}
                              url={result.images[key as keyof typeof result.images]}
                              label={IMAGE_LABELS[key]}
                              onPreview={() => setPreviewImage({ url: result.images[key as keyof typeof result.images], label: IMAGE_LABELS[key] })}
                              onRegenerate={() => handleOpenRegenerateDialog(key)}
                              onDownload={() => handleDownload(result.images[key as keyof typeof result.images], `${IMAGE_LABELS[key]}_${currentSize.width}x${currentSize.height}.png`)}
                              isRegenerating={regeneratingKey === key}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* 视频结果 */}
                <TabsContent value="video">
                  <div className="space-y-6">
                    {/* 视频类型选择 */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        视频类型
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(VIDEO_TYPES).map(([key, config]) => (
                          <div
                            key={key}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                              videoType === key
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            onClick={() => setVideoType(key as 'functional' | 'apparel' | 'decor')}
                          >
                            <div className="font-medium">{config.label}</div>
                            <div className="text-sm text-muted-foreground">{config.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 视频比例选择 */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">视频比例</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(VIDEO_RATIOS).map(([key, config]) => (
                          <div
                            key={key}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${
                              videoRatio === key
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            onClick={() => setVideoRatio(key as '3:4' | '1:1')}
                          >
                            <div className="font-medium">{config.label}</div>
                            <div className="text-xs text-muted-foreground">{config.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 视频要求 */}
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-base font-medium">视频要求（可选）</Label>
                        <Textarea
                          placeholder="例如：模特自然转身展示服装侧面和背面细节，动作流畅不僵硬..."
                          value={videoPrompt}
                          onChange={(e) => setVideoPrompt(e.target.value)}
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                      
                      {/* 视频质量提示 */}
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg space-y-2">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">💡 优质视频建议</p>
                        <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                          <li>前5秒展示核心卖点，真人试用/试穿演示</li>
                          <li>模特姿势自然放松，避免僵硬站姿</li>
                          <li>动作流畅：可描述"转身"、"走动"、"抬手"等自然动作</li>
                          <li>视频时长约10秒，内容简洁清晰</li>
                          <li>视频为静音输出，无背景音乐</li>
                        </ul>
                      </div>
                      
                      {/* 动作参考建议 */}
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                            <span>🎯 动作参考建议</span>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3 space-y-2">
                          <div className="grid grid-cols-1 gap-2 text-xs">
                            <div 
                              className="p-2 bg-slate-50 dark:bg-slate-800 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                              onClick={() => setVideoPrompt(prev => prev + (prev ? '，' : '') + '模特自然走动转身，展示服装前后效果')}
                            >
                              <span className="font-medium">服装类：</span>模特自然走动转身，展示服装前后效果
                            </div>
                            <div 
                              className="p-2 bg-slate-50 dark:bg-slate-800 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                              onClick={() => setVideoPrompt(prev => prev + (prev ? '，' : '') + '真人手部操作演示产品功能，动作连贯自然')}
                            >
                              <span className="font-medium">功能型：</span>真人手部操作演示产品功能，动作连贯自然
                            </div>
                            <div 
                              className="p-2 bg-slate-50 dark:bg-slate-800 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                              onClick={() => setVideoPrompt(prev => prev + (prev ? '，' : '') + '镜头环绕展示产品在真实环境中的装饰效果')}
                            >
                              <span className="font-medium">装饰类：</span>镜头环绕展示产品在真实环境中的装饰效果
                            </div>
                            <div 
                              className="p-2 bg-slate-50 dark:bg-slate-800 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                              onClick={() => setVideoPrompt(prev => prev + (prev ? '，' : '') + '模特抬手展示饰品细节，动作优雅自然')}
                            >
                              <span className="font-medium">饰品/彩妆：</span>模特抬手展示饰品细节，动作优雅自然
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">点击上方建议可快速填入</p>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* 生成按钮 */}
                    <Button
                      onClick={handleGenerateVideo}
                      disabled={isGeneratingVideo || !uploadedImage}
                      className="w-full h-12 text-base font-medium"
                      size="lg"
                    >
                      {isGeneratingVideo ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          正在生成视频...
                        </>
                      ) : (
                        <>
                          <Video className="w-5 h-5 mr-2" />
                          生成商品视频
                        </>
                      )}
                    </Button>

                    {isGeneratingVideo && (
                      <div className="text-center text-sm text-muted-foreground space-y-2">
                        <p className="font-medium">视频生成中...</p>
                        <p className="text-xs">视频生成需要较长时间，预计 1-3 分钟</p>
                      </div>
                    )}

                    {/* 视频结果展示 */}
                    {videoResult && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <Play className="w-4 h-4" />
                          生成结果
                        </h3>
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                          <video
                            src={videoResult.videoUrl}
                            controls
                            className="w-full max-h-[500px]"
                            poster={uploadedImage || undefined}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              navigator.clipboard.writeText(videoResult.videoUrl);
                              toast.success('视频链接已复制');
                            }}
                          >
                            复制链接
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={() => {
                              const timestamp = new Date().getTime();
                              handleDownload(videoResult.videoUrl, `product_video_${timestamp}.mp4`);
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            下载视频
                          </Button>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
                          <p className="text-muted-foreground">视频类型：{videoResult.videoType}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* 底部说明 */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>上传商品图片 → 输入需求 → AI 分析 → 生成爆款标题和营销图片</p>
        </div>
      </div>

      {/* 图片预览弹窗 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>{previewImage?.label || '图片预览'}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative">
              <img
                src={previewImage.url}
                alt={previewImage.label}
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleDownload(previewImage.url, `${previewImage.label}_${currentSize.width}x${currentSize.height}.png`)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载图片
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 重绘对话框 */}
      <Dialog open={!!regenerateDialog} onOpenChange={() => setRegenerateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600" />
              重新生成 {regenerateDialog && IMAGE_LABELS[regenerateDialog.key]}
            </DialogTitle>
            <DialogDescription>
              输入调整要求，AI 会在保留需求的基础上重新生成图片
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* 显示历史提示词 */}
            {regenerateDialog && imagePromptHistory[regenerateDialog.key] && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">当前已保留的需求</Label>
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-md text-sm">
                  {imagePromptHistory[regenerateDialog.key]}
                </div>
                <p className="text-xs text-muted-foreground">
                  AI 会在以上需求基础上进行调整
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>新增调整要求</Label>
              <Textarea
                placeholder={regenerateDialog && imagePromptHistory[regenerateDialog.key] 
                  ? "例如：把背景改成蓝色、增加光影效果..."
                  : "例如：换成红色背景，产品角度调整为45度，添加文字'SPECIAL OFFER'..."}
                value={regenerateDialog?.prompt || ''}
                onChange={(e) => setRegenerateDialog(prev => prev ? { ...prev, prompt: e.target.value } : null)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {regenerateDialog && imagePromptHistory[regenerateDialog.key]
                  ? "新需求会追加到已有需求后面，AI会在原基础上调整"
                  : "首次重绘会记录您的需求，后续重绘会在基础上调整"}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRegenerateDialog(null)} className="flex-1">
                取消
              </Button>
              <Button onClick={handleRegenerateImage} disabled={!!regeneratingKey} className="flex-1">
                {regeneratingKey ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新生成
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 图片卡片组件 - 使用 'use client' 避免 hydration 问题
function ImageCard({
  imageKey,
  url,
  label,
  onPreview,
  onRegenerate,
  onDownload,
  isRegenerating,
  small = false,
}: {
  imageKey: string;
  url: string;
  label: string;
  onPreview: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
  isRegenerating: boolean;
  small?: boolean;
}) {
  // 简化状态管理，避免 hydration 问题
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!url) {
    return (
      <div className="space-y-2">
        <p className={`font-medium text-muted-foreground ${small ? 'text-xs' : 'text-sm'}`}>
          {label}
        </p>
        <div className={`relative bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center aspect-[3/4]`}>
          <p className="text-xs text-muted-foreground">等待生成</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between">
        <p className={`font-medium text-muted-foreground ${small ? 'text-xs' : 'text-sm'}`}>
          {label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className={`text-xs ${small ? 'h-6 px-1.5' : 'h-7 px-2'}`}
          onClick={onRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-1" />
          )}
          重绘
        </Button>
      </div>
      <div className="relative bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden aspect-[3/4]">
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        {/* 悬停操作层 - 仅在客户端挂载后显示 */}
        {mounted && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onPreview}
            >
              <ZoomIn className="w-4 h-4 mr-1" />
              预览
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onDownload}
            >
              <Download className="w-4 h-4 mr-1" />
              下载
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
