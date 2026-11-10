import { apiClient } from './client';

export interface FaqCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  _count?: { articles: number };
}

export interface FaqArticle {
  id: string;
  categoryId: string;
  category: { name: string; slug: string; icon: string | null };
  title: string;
  slug: string;
  content: string;
  tags: string[];
  helpful: number;
  notHelpful: number;
  createdAt: string;
}

export const helpApi = {
  seed: () => apiClient.get('/help/seed').then(r => r.data),
  listCategories: () => apiClient.get<FaqCategory[]>('/help/categories').then(r => r.data),
  listArticles: (category?: string, search?: string) =>
    apiClient.get<FaqArticle[]>('/help/articles', { params: { category, search } }).then(r => r.data),
  getArticle: (slug: string) => apiClient.get<FaqArticle>(`/help/articles/${slug}`).then(r => r.data),
  markHelpful: (slug: string, helpful: boolean) =>
    apiClient.post(`/help/articles/${slug}/feedback`, { helpful }).then(r => r.data),
};
