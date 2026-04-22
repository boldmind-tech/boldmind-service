// ==================== ANONTRUTH MIC ====================
// SERVICES/anontruth-mic-service/src/models/anonymous-audio.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IAnonymousAudio extends Document {
    anonymousId: string;
    location: {
        type: 'Point';
        coordinates: [number, number];
        accuracy: number; // meters
    };
    audio: {
        url: string;
        duration: number;
        format: string;
        size: number;
        transcription: string;
        voiceDistorted: boolean;
    };
    metadata: {
        category: string;
        tags: string[];
        urgency: 'low' | 'medium' | 'high' | 'critical';
        language: string;
        timestamp: Date;
    };
    moderation: {
        status: 'pending' | 'approved' | 'rejected' | 'flagged';
        reviewedBy: string;
        reviewedAt?: Date;
        flags: Array<{
            type: string;
            reason: string;
            severity: string;
        }>;
        score: number; // Trust score 0-100
    };
    visibility: {
        isPublic: boolean;
        targetAreas: string[];
        expiryAt: Date;
        boostExpiry?: Date;
    };
    engagement: {
        listens: number;
        shares: number;
        reports: number;
        boosts: Array<{
            amount: number;
            boostedAt: Date;
            expiresAt: Date;
        }>;
        comments: Array<{
            anonymousId: string;
            text: string;
            timestamp: Date;
        }>;
    };
    safety: {
        encryptionKey: string;
        ipAddress: string; // Hashed
        deviceFingerprint: string; // Hashed
        deleted: boolean;
        deletionReason?: string;
        deletedAt?: Date;
    };
    createdAt: Date;
}

const AnonymousAudioSchema = new Schema<IAnonymousAudio>(
    {
        anonymousId: { type: String, required: true, index: true },
        location: {
            type: { type: String, default: 'Point' },
            coordinates: { type: [Number], required: true },
            accuracy: Number
        },
        audio: {
            url: { type: String, required: true },
            duration: Number,
            format: String,
            size: Number,
            transcription: String,
            voiceDistorted: { type: Boolean, default: true }
        },
        metadata: {
            category: String,
            tags: [String],
            urgency: {
                type: String,
                enum: ['low', 'medium', 'high', 'critical'],
                default: 'medium'
            },
            language: String,
            timestamp: { type: Date, default: Date.now }
        },
        moderation: {
            status: {
                type: String,
                enum: ['pending', 'approved', 'rejected', 'flagged'],
                default: 'pending',
                index: true
            },
            reviewedBy: String,
            reviewedAt: Date,
            flags: [{
                type: String,
                reason: String,
                severity: String
            }],
            score: { type: Number, default: 50 }
        },
        visibility: {
            isPublic: { type: Boolean, default: true },
            targetAreas: [String],
            expiryAt: { type: Date, required: true },
            boostExpiry: Date
        },
        engagement: {
            listens: { type: Number, default: 0 },
            shares: { type: Number, default: 0 },
            reports: { type: Number, default: 0 },
            boosts: [{
                amount: Number,
                boostedAt: Date,
                expiresAt: Date
            }],
            comments: [{
                anonymousId: String,
                text: String,
                timestamp: { type: Date, default: Date.now }
            }]
        },
        safety: {
            encryptionKey: { type: String, required: true },
            ipAddress: String,
            deviceFingerprint: String,
            deleted: { type: Boolean, default: false },
            deletionReason: String,
            deletedAt: Date
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        collection: 'anonymous_audios'
    }
);

// TTL Index - Auto-delete after 7 days
AnonymousAudioSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });
AnonymousAudioSchema.index({ location: '2dsphere' });
AnonymousAudioSchema.index({ 'moderation.status': 1 });
AnonymousAudioSchema.index({ 'visibility.expiryAt': 1 });

export const AnonymousAudio = mongoose.model<IAnonymousAudio>(
    'AnonymousAudio',
    AnonymousAudioSchema
);