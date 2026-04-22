
import 'dotenv/config';
import 'reflect-metadata';
import mongoose from 'mongoose';
import slugify from 'slugify';
import { Post } from '../../schemas/post.schema';
import { generateGeminiText } from '../../../ai/ai.service';

async function testSingle() {
    console.log("🚀 Starting Inlined Single Post Test...");
    const MONGO_URI = process.env['MONGODB_URL'];
    if (!MONGO_URI) {
        console.error("❌ MONGODB_URL not found");
        return;
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");

        const topic = "Top AI trends for Nigerian entrepreneurs 2025";
        const systemPrompt = "You are an expert Nigerian journalist. Write in Pidgin English. Be engaging.";
        const prompt = `Write a news article about: ${topic}. Include title, excerpt, and content. Format as JSON.`;

        console.log(`🤖 Calling generateGeminiText for: ${topic}...`);
        const result = await generateGeminiText(prompt, 'gemini-2.5-flash', systemPrompt);
        console.log("✅ AI result length:", result.length);

        const aiData = JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || result);
        console.log("✅ Parsed AI Response title:", aiData.title);

        const slug = slugify(aiData.title, { lower: true, strict: true });
        
        const newPost = new Post({
            slug,
            title: aiData.title,
            content: { pidgin: aiData.content },
            excerpt: aiData.excerpt,
            category: 'ai-tech',
            tags: aiData.tags || [],
            author: { id: "test-id", name: "Tester", isVerified: true },
            media: { gallery: [] },
            engagement: { views: 10, likes: 0, shares: 0, commentsCount: 0, readingTime: 2 },
            seo: { metaTitle: aiData.title, metaDescription: aiData.excerpt, keywords: [] },
            monetization: { hasAds: true, affiliateLinks: [], sponsored: false },
            status: 'published',
            source: 'ai',
            publishedAt: new Date()
        });

        await newPost.save();
        console.log(`✅ Post saved successfully with slug: ${slug}`);

    } catch (err: any) {
        console.error("💥 Test failed:", err.message);
        if (err.stack) console.error(err.stack);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected.");
    }
}

testSingle();
