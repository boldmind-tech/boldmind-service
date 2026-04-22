// ==================== AFROCOPY AI ====================
// SERVICES/afrocopy-ai-service/src/models/copywriting-project.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ICopywritingProject extends Document {
    userId: string;
    projectName: string;
    language: 'pidgin' | 'english' | 'yoruba' | 'igbo' | 'hausa';
    tone: 'formal' | 'casual' | 'persuasive' | 'funny' | 'professional' | 'friendly';
    purpose: 'social_media' | 'ad_copy' | 'email' | 'blog_post' | 'product_description' | 'video_script';
    input: {
        productDetails: string;
        targetAudience: string;
        keyBenefits: string[];
        callToAction: string;
        keywords: string[];
        examples: string[];
    };
    generatedContent: Array<{
        version: number;
        content: string;
        wordCount: number;
        readabilityScore: number;
        engagementScore: number;
        selected: boolean;
    }>;
    variations: Array<{
        tone: string;
        length: string;
        focus: string;
        content: string;
    }>;
    optimization: {
        seoScore: number;
        sentiment: string;
        predictedEngagement: number;
    };
    performance?: {
        actualEngagement: number;
        conversionRate: number;
        feedback: string;
    };
    status: 'generating' | 'reviewing' | 'optimizing' | 'completed';
    createdAt: Date;
    updatedAt: Date;
}

const CopywritingProjectSchema = new Schema<ICopywritingProject>(
    {
        userId: { type: String, required: true, index: true },
        projectName: { type: String, required: true },
        language: {
            type: String,
            enum: ['pidgin', 'english', 'yoruba', 'igbo', 'hausa'],
            default: 'pidgin'
        },
        tone: {
            type: String,
            enum: ['formal', 'casual', 'persuasive', 'funny', 'professional', 'friendly'],
            default: 'casual'
        },
        purpose: {
            type: String,
            enum: ['social_media', 'ad_copy', 'email', 'blog_post', 'product_description', 'video_script'],
            required: true
        },
        input: {
            productDetails: { type: String, required: true },
            targetAudience: String,
            keyBenefits: [String],
            callToAction: String,
            keywords: [String],
            examples: [String]
        },
        generatedContent: [{
            version: Number,
            content: String,
            wordCount: Number,
            readabilityScore: Number,
            engagementScore: Number,
            selected: { type: Boolean, default: false }
        }],
        variations: [{
            tone: String,
            length: String,
            focus: String,
            content: String
        }],
        optimization: {
            seoScore: Number,
            sentiment: String,
            predictedEngagement: Number
        },
        performance: {
            actualEngagement: Number,
            conversionRate: Number,
            feedback: String
        },
        status: {
            type: String,
            enum: ['generating', 'reviewing', 'optimizing', 'completed'],
            default: 'generating'
        }
    },
    { timestamps: true, collection: 'copywriting_projects' }
);

CopywritingProjectSchema.index({ userId: 1, status: 1 });
CopywritingProjectSchema.index({ createdAt: -1 });

export const CopywritingProject = mongoose.model<ICopywritingProject>(
    'CopywritingProject',
    CopywritingProjectSchema
);
