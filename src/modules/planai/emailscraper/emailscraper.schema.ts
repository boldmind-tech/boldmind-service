import { Schema } from 'mongoose';

export const EmailLeadSchema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        listId: { type: String, index: true },
        email: { type: String, required: true, index: true },
        firstName: String,
        lastName: String,
        fullName: String,
        title: String,
        company: { type: String, index: true },
        industry: String,
        website: String,
        location: String,
        linkedinUrl: String,
        phone: String,
        source: { type: String, enum: ['website', 'directory'], default: 'website' },
        confidence: Number,
        verificationStatus: {
            type: String,
            enum: ['valid', 'invalid', 'catch_all', 'webmail', 'disposable', 'unknown'],
            default: 'unknown'
        },
        verifiedAt: Date,
        tags: [String],
    },
    { timestamps: true }
);

// Compound index for uniqueness per user
EmailLeadSchema.index({ userId: 1, email: 1 }, { unique: true });

export const ScrapeJobSchema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        jobType: { type: String, enum: ['website', 'directory'], required: true },
        status: {
            type: String,
            enum: ['queued', 'running', 'completed', 'failed'],
            default: 'queued'
        },
        inputData: Schema.Types.Mixed,
        totalFound: { type: Number, default: 0 },
        totalValid: { type: Number, default: 0 },
        totalSaved: { type: Number, default: 0 },
        error: String,
        completedAt: Date,
    },
    { timestamps: true }
);

export const LeadListSchema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        description: String,
    },
    { timestamps: true }
);
