import mongoose, { Schema, Document, Types } from 'mongoose';


export type SocialPlatform =
    | 'instagram'
    | 'facebook'
    | 'twitter_x'
    | 'tiktok'
    | 'linkedin'
    | 'youtube';

export interface ISocialPost extends Document {
    userId: string; // References Postgres User.id
    accountConnectionId?: Types.ObjectId;
    calendarId?: Types.ObjectId;
    platform: SocialPlatform;
    caption: string;
    hashtags: string[];
    mediaUrls: string[]; // R2 URLs
    mediaType: 'image' | 'video' | 'carousel' | 'reel' | 'story' | 'text';
    status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
    scheduledFor?: Date;
    publishedAt?: Date;
    platformPostId?: string; // returned by platform after publish
    platformUrl?: string;
    n8nWorkflowId?: string;
    isAIGenerated: boolean;
    generationPrompt?: string;
    brandVoice?: string;
    engagementStats?: {
        likes: number;
        comments: number;
        shares: number;
        reach: number;
        impressions: number;
        savedCount: number;
        fetchedAt: Date;
    };
    errorMessage?: string;
    retryCount: number;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

const SocialPostSchema = new Schema<ISocialPost>(
    {
        userId: { type: String, required: true, index: true },
        accountConnectionId: { type: Schema.Types.ObjectId, ref: 'AccountConnection' },
        calendarId: { type: Schema.Types.ObjectId, ref: 'ContentCalendar' },
        platform: {
            type: String,
            enum: ['instagram', 'facebook', 'twitter_x', 'tiktok', 'linkedin', 'youtube'],
            required: true,
            index: true,
        },
        caption: { type: String, required: true },
        hashtags: [{ type: String, lowercase: true }],
        mediaUrls: [String],
        mediaType: {
            type: String,
            enum: ['image', 'video', 'carousel', 'reel', 'story', 'text'],
            required: true,
        },
        status: {
            type: String,
            enum: ['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'],
            default: 'draft',
            index: true,
        },
        scheduledFor: { type: Date, index: true },
        publishedAt: Date,
        platformPostId: String,
        platformUrl: String,
        n8nWorkflowId: String,
        isAIGenerated: { type: Boolean, default: false },
        generationPrompt: String,
        brandVoice: String,
        engagementStats: {
            likes: { type: Number, default: 0 },
            comments: { type: Number, default: 0 },
            shares: { type: Number, default: 0 },
            reach: { type: Number, default: 0 },
            impressions: { type: Number, default: 0 },
            savedCount: { type: Number, default: 0 },
            fetchedAt: Date,
        },
        errorMessage: String,
        retryCount: { type: Number, default: 0 },
        tags: [String],
    },
    {
        timestamps: true,
        collection: 'social_posts',
    }
);

SocialPostSchema.index({ userId: 1, status: 1, scheduledFor: 1 });
SocialPostSchema.index({ userId: 1, platform: 1, publishedAt: -1 });

export const SocialPost = mongoose.model<ISocialPost>('SocialPost', SocialPostSchema);

// ─────────────────────────────────────────────────────────────────────────────

export interface IContentCalendar extends Document {
    userId: string;
    name: string;
    description?: string;
    platforms: SocialPlatform[];
    brandVoice?: string; // AI personality description
    contentPillars: string[]; // e.g. ["educational", "promotional", "entertaining"]
    postingFrequency: Record<SocialPlatform, number>; // posts per week per platform
    colorCode: string;
    isActive: boolean;
    totalPosts: number;
    publishedPosts: number;
    createdAt: Date;
    updatedAt: Date;
}

const ContentCalendarSchema = new Schema<IContentCalendar>(
    {
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        description: String,
        platforms: [
            {
                type: String,
                enum: ['instagram', 'facebook', 'twitter_x', 'tiktok', 'linkedin', 'youtube'],
            },
        ],
        brandVoice: String,
        contentPillars: [String],
        postingFrequency: { type: Schema.Types.Mixed, default: {} },
        colorCode: { type: String, default: '#3B82F6' },
        isActive: { type: Boolean, default: true },
        totalPosts: { type: Number, default: 0 },
        publishedPosts: { type: Number, default: 0 },
    },
    { timestamps: true, collection: 'content_calendars' }
);

export const ContentCalendar = mongoose.model<IContentCalendar>(
    'ContentCalendar',
    ContentCalendarSchema
);

// ─────────────────────────────────────────────────────────────────────────────

export interface IAccountConnection extends Document {
    userId: string;
    platform: SocialPlatform;
    accountId: string;       // platform's account/page ID
    accountName: string;
    accountAvatar?: string;
    accessToken: string;     // encrypted
    refreshToken?: string;   // encrypted
    tokenExpiresAt?: Date;
    scope: string[];
    isActive: boolean;
    lastSyncAt?: Date;
    followerCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

const AccountConnectionSchema = new Schema<IAccountConnection>(
    {
        userId: { type: String, required: true, index: true },
        platform: {
            type: String,
            enum: ['instagram', 'facebook', 'twitter_x', 'tiktok', 'linkedin', 'youtube'],
            required: true,
        },
        accountId: { type: String, required: true },
        accountName: { type: String, required: true },
        accountAvatar: String,
        accessToken: { type: String, required: true, select: false }, // Never return by default
        refreshToken: { type: String, select: false },
        tokenExpiresAt: Date,
        scope: [String],
        isActive: { type: Boolean, default: true, index: true },
        lastSyncAt: Date,
        followerCount: Number,
    },
    { timestamps: true, collection: 'account_connections' }
);

AccountConnectionSchema.index({ userId: 1, platform: 1 }, { unique: true });

export const AccountConnection = mongoose.model<IAccountConnection>(
    'AccountConnection',
    AccountConnectionSchema
);