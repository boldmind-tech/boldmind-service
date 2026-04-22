//service/src/modules/content/src/services/video-factory.service.ts
// this should call ai service that generate text to video which will be in the socail factory service AND also use the automation sercice to 

import axios from 'axios';

export class VideoFactoryService {
    private static baseUrl = process.env['SOCIAL_FACTORY_SERVICE_URL'] || 'http://localhost:4023';

    static async convertPostToVideo(post: any) {
        try {
            const response = await axios.post(`${this.baseUrl}/jobs`, {
                sourceType: 'amebogist',
                sourceId: post._id || post.id,
                title: post.title,
                content: post.content.pidgin || post.content.english || post.content,
                media: post.media?.featuredImage,
                targetPlatforms: ['facebook', 'instagram', 'tiktok']
            });
            return response.data;
        } catch (error: any) {
            console.error('Social Factory Integration Error:', error.message);
            // Don't throw, just log for now as it's a "delicate" optional integration
            return null;
        }
    }
}
