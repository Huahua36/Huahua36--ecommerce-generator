import { NextRequest } from 'next/server';
import { LLMClient, ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 支持的图片尺寸配置
const SUPPORTED_SIZES: Record<string, { apiSize: string; displaySize: string }> = {
  '1340x1787': { apiSize: '2560x3413', displaySize: '1340×1787' },
  '800x800': { apiSize: '2560x2560', displaySize: '800×800' },
};

// 各类型图片的默认提示词（精简版，减少生成时间）
const DEFAULT_PROMPTS: Record<string, string> = {
  main_img: 'Professional e-commerce product image, clean background, studio lighting, high quality',
  model_img: 'Real model naturally wearing the product, showing natural fit and drape, fabric naturally conforms to body, no face visible, natural standing or walking pose, authentic wearing effect',
  detail_img_1: 'Product fabric texture close-up, macro photography, high detail, clean background',
  detail_img_2: 'Product stitching detail close-up, macro photography, quality craftsmanship',
  detail_img_3: 'Product feature close-up, macro photography, buttons zippers details',
  feature_img: 'Product features infographic, top title, center product flat lay, surrounding feature callouts with callout lines pointing to product details, each feature with icon and English label like Quick Dry, Breathable, Elastic, Zipper Pockets',
  scene_img: 'Lifestyle scene, model using product in natural environment, no face visible, warm atmosphere',
};

const IMAGE_ORDER = ['main_img', 'model_img', 'detail_img_1', 'detail_img_2', 'detail_img_3', 'feature_img', 'scene_img'];

const IMAGE_LABELS: Record<string, string> = {
  main_img: '主图',
  model_img: '模特上身图',
  detail_img_1: '细节图1',
  detail_img_2: '细节图2',
  detail_img_3: '细节图3',
  feature_img: '功能说明图',
  scene_img: '场景图',
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const imageFile = formData.get('image') as File;
  const imageSizeKey = formData.get('imageSize') as string || '1340x1787';
  const imagePromptsStr = formData.get('imagePrompts') as string || '{}';
  const imagePrompts: Record<string, string> = JSON.parse(imagePromptsStr);

  if (!imageFile) {
    return new Response(JSON.stringify({ error: '请上传商品图片' }), { status: 400 });
  }

  const sizeConfig = SUPPORTED_SIZES[imageSizeKey] || SUPPORTED_SIZES['1340x1787'];
  const imageBuffer = await imageFile.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString('base64');
  const mimeType = imageFile.type || 'image/jpeg';
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const llmClient = new LLMClient(config, customHeaders);
        const imageClient = new ImageGenerationClient(config, customHeaders);

        // Step 1: 并行执行图片分析和标题生成（加快速度）
        sendEvent('progress', { step: 'analyzing', message: '正在分析商品...' });

        const analyzeMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }> = [
          {
            role: 'system',
            content: 'You are an e-commerce expert. Briefly describe the product type and key features in 2 sentences.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this product? Brief description.' },
              { type: 'image_url', image_url: { url: dataUri, detail: 'low' } }, // 使用 low detail 加快速度
            ],
          },
        ];

        const analyzePromise = llmClient.invoke(analyzeMessages, {
          temperature: 0.7,
          model: 'doubao-seed-1-6-vision-250815',
        });

        // 同时准备标题生成
        const titleMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          {
            role: 'system',
            content: `你是一位电商爆款标题专家。

【核心原则：整合多个卖点成一句话】

一个产品往往有多个优势，必须整合成一句话，而不是拆分成多个独立标题！

【正确示例：整合多个卖点】
✅ "装重物不变形、夏天穿不闷热、洗多次还像新，加固车线+速干面料+定型工艺三重保障"
   → 前半句整合3个优势效果
   → 后半句用具体工艺支撑

✅ "不起球不掉色越洗越软，新疆长绒棉天生自带柔光滤镜"
   → 整合2个优势：不起球+不掉色
   → 原因：新疆长绒棉

✅ "百元价格穿出千元质感，大牌同款工艺省去品牌溢价"
   → 价格优势+品质效果整合
   → 原因：大牌同款工艺

【错误示例：拆分成多个独立标题】
❌ 标题1：口袋装重物不变形，加固车线设计
   标题2：夏天穿不闷热，速干面料透气
   标题3：洗多次还像新，定型工艺持久
   → 问题：同一产品的优势被拆分，每个标题都不完整

【标题结构】
前半句：整合产品多个优势效果（用顿号或逗号连接）
后半句：具体原因/工艺支撑

【输出格式】
共生成3个不同的标题方案，每个标题2行（中文+英文翻译）
不要编号，不要包含颜色描述
每个标题都要整合产品的多个卖点，形成完整有力的表达`,
          },
        ];

        // 等待分析完成
        const analyzeResponse = await analyzePromise;
        const productAnalysis = analyzeResponse.content;
        sendEvent('progress', { step: 'analyzed', message: '商品分析完成' });

        // Step 2: 生成标题
        sendEvent('progress', { step: 'titles', message: '正在生成标题...' });
        
        titleMessages.push({
          role: 'user',
          content: `商品信息：${productAnalysis}

请生成3个爆款标题方案。

关键要求：
1. 每个标题要整合产品的多个卖点，形成一句话
2. 前半句写效果/优势，后半句写具体原因/工艺
3. 不要把同一产品的优势拆分成多个独立标题
4. 每个标题2行（中文+英文翻译）
5. 不包含颜色描述`,
        });

        const titleResponse = await llmClient.invoke(titleMessages, {
          temperature: 0.8,
          model: 'doubao-seed-1-8-251228',
        });

        // 解析双语标题：每2行为一个标题（中文+英文）
        const lines = titleResponse.content
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0);
        
        const titles: string[] = [];
        for (let i = 0; i < lines.length && titles.length < 3; i += 2) {
          const chinese = lines[i] || '';
          const english = lines[i + 1] || '';
          if (chinese && english) {
            titles.push(`${chinese}\n${english}`);
          } else if (chinese) {
            titles.push(chinese);
          }
        }

        sendEvent('titles', { titles });

        // Step 3: 并行生成所有图片（批量生成，加快速度）
        sendEvent('progress', { step: 'images', message: '正在生成图片...' });

        // 构建图片生成提示词
        const buildPrompt = (imageKey: string) => {
          const basePrompt = DEFAULT_PROMPTS[imageKey] || '';
          const customPrompt = imagePrompts[imageKey]?.trim();
          if (customPrompt) {
            return `${basePrompt}, ${customPrompt}`;
          }
          return basePrompt;
        };

        // 使用 Promise.allSettled 并行生成所有图片
        const imagePromises = IMAGE_ORDER.map(async (key) => {
          try {
            const prompt = buildPrompt(key);
            console.log(`开始生成图片: ${key}`);
            
            const response = await imageClient.generate({
              prompt,
              image: dataUri,
              size: sizeConfig.apiSize,
              watermark: false,
            });

            const helper = imageClient.getResponseHelper(response);
            console.log(`图片 ${key} 生成结果:`, { 
              success: helper.success, 
              imageUrls: helper.imageUrls.length,
              error: (helper as any).error_message 
            });
            
            if (helper.success && helper.imageUrls.length > 0) {
              return { key, url: helper.imageUrls[0], success: true };
            }
            return { key, success: false, error: (helper as any).error_message };
          } catch (error) {
            console.error(`图片 ${key} 生成异常:`, error);
            return { key, success: false, error: String(error) };
          }
        });

        // 并行生成，但按完成顺序返回
        const results = await Promise.allSettled(imagePromises);
        
        const images: Record<string, string> = {};
        let successCount = 0;
        let failCount = 0;
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success && result.value.url) {
            successCount++;
            images[result.value.key] = result.value.url;
            sendEvent('image', { 
              key: result.value.key, 
              url: result.value.url,
              label: IMAGE_LABELS[result.value.key]
            });
          } else if (result.status === 'fulfilled' && result.value.error) {
            failCount++;
            console.error(`图片 ${result.value.key} 失败:`, result.value.error);
          }
        }
        
        console.log(`图片生成完成: 成功 ${successCount}/${IMAGE_ORDER.length}, 失败 ${failCount}`);
        console.log('成功生成的图片:', Object.keys(images));

        sendEvent('done', { 
          message: '生成完成',
          images,
          titles 
        });

      } catch (error) {
        sendEvent('error', { 
          message: error instanceof Error ? error.message : '生成失败' 
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
