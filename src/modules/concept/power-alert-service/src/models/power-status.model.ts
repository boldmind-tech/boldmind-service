// ==================== POWER ALERT ====================
// SERVICES/power-alert-service/src/models/power-status.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IPowerStatus extends Document {
    location: {
        type: 'Point';
        coordinates: [number, number];
        address: string;
        area: string;
        city: string;
        state: string;
    };
    provider: string; // IKEDC, EEDC, PHED, etc.
    status: 'on' | 'off' | 'fluctuating' | 'unknown';
    lastChange: Date;
    duration: number; // minutes since last change
    reportedBy: Array<{
        userId: string;
        timestamp: Date;
        confidence: number;
    }>;
    crowdScore: number; // 0-100 confidence
    predictedRestoration?: Date;
    historicalPatterns: Array<{
        dayOfWeek: number;
        hourOfDay: number;
        probabilityOff: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
}

const PowerStatusSchema = new Schema<IPowerStatus>(
    {
        location: {
            type: { type: String, default: 'Point' },
            coordinates: { type: [Number], required: true },
            address: String,
            area: { type: String, index: true },
            city: { type: String, index: true },
            state: { type: String, index: true }
        },
        provider: { type: String, required: true, index: true },
        status: {
            type: String,
            enum: ['on', 'off', 'fluctuating', 'unknown'],
            default: 'unknown',
            index: true
        },
        lastChange: { type: Date, default: Date.now },
        duration: { type: Number, default: 0 },
        reportedBy: [{
            userId: String,
            timestamp: Date,
            confidence: Number
        }],
        crowdScore: { type: Number, default: 0 },
        predictedRestoration: Date,
        historicalPatterns: [{
            dayOfWeek: Number,
            hourOfDay: Number,
            probabilityOff: Number
        }]
    },
    { timestamps: true, collection: 'power_status' }
);

PowerStatusSchema.index({ location: '2dsphere' });
PowerStatusSchema.index({ area: 1, status: 1 });

export const PowerStatus = mongoose.model<IPowerStatus>('PowerStatus', PowerStatusSchema);

