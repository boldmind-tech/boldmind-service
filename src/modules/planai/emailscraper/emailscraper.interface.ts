import { Document } from 'mongoose';

export interface IEmailLead extends Document {
    userId: string;
    listId?: string;
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    title?: string;
    company?: string;
    industry?: string;
    website?: string;
    location?: string;
    linkedinUrl?: string;
    phone?: string;
    source: 'website' | 'directory';
    confidence?: number;
    verificationStatus: 'valid' | 'invalid' | 'catch_all' | 'webmail' | 'disposable' | 'unknown';
    verifiedAt?: Date;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface IScrapeJob extends Document {
    userId: string;
    jobType: 'website' | 'directory';
    status: 'queued' | 'running' | 'completed' | 'failed';
    inputData: any;
    totalFound: number;
    totalValid: number;
    totalSaved: number;
    error?: string;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ILeadList extends Document {
    userId: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
