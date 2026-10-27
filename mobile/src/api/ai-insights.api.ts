import { apiClient } from './client';

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface Insight {
  type: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  entity?: { type: string; id: string; code?: string };
  metric?: Record<string, unknown>;
}

export interface InsightsResponse {
  generatedAt: string;
  insights: Insight[];
}

export const aiInsightsApi = {
  getInsights: async (): Promise<InsightsResponse> => {
    const res = await apiClient.get('/ai-insights');
    return res.data;
  },
};
