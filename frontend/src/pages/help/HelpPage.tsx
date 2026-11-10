import React, { useState } from 'react';
import {
  Input, Typography, Space, Tag, Button, Row, Col, Spin, Empty,
  Breadcrumb, message as antMessage, Divider, Card,
} from 'antd';
import {
  LikeOutlined, DislikeOutlined, ArrowLeftOutlined,
  CustomerServiceOutlined, SendOutlined, QuestionCircleOutlined,
  MailOutlined, PhoneOutlined, MessageOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { helpApi, type FaqCategory, type FaqArticle } from '../../api/help.api';

const { Title, Text, Paragraph } = Typography;

const CATEGORY_COLORS: Record<string, string> = {
  'getting-started': '#1677ff',
  sales: '#52c41a',
  inventory: '#fa8c16',
  hr: '#722ed1',
  messaging: '#13c2c2',
  errors: '#ff4d4f',
};

const CATEGORY_BG: Record<string, string> = {
  'getting-started': '#e6f4ff',
  sales: '#f6ffed',
  inventory: '#fff7e6',
  hr: '#f9f0ff',
  messaging: '#e6fffb',
  errors: '#fff2f0',
};

const renderMarkdown = (content: string): React.ReactNode => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      elements.push(<Title key={key++} level={4} style={{ marginTop: 20, marginBottom: 8 }}>{line.slice(3)}</Title>);
    } else if (line.startsWith('### ')) {
      elements.push(<Title key={key++} level={5} style={{ marginTop: 16, marginBottom: 6 }}>{line.slice(4)}</Title>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<div key={key++} style={{ paddingLeft: 16, marginBottom: 4, fontSize: 14 }}>• {line.slice(2)}</div>);
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(<div key={key++} style={{ paddingLeft: 16, marginBottom: 4, fontSize: 14 }}>{line}</div>);
    } else if (line.startsWith('> ')) {
      elements.push(
        <div key={key++} style={{ borderLeft: '3px solid #1677ff', paddingLeft: 12, margin: '8px 0', color: '#555', fontStyle: 'italic', fontSize: 14 }}>
          {line.slice(2)}
        </div>
      );
    } else if (line === '') {
      elements.push(<div key={key++} style={{ marginBottom: 8 }} />);
    } else {
      const parts = line.split(/\*\*([^*]+)\*\*/g);
      if (parts.length > 1) {
        elements.push(
          <Paragraph key={key++} style={{ marginBottom: 6 }}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
          </Paragraph>
        );
      } else {
        elements.push(<Paragraph key={key++} style={{ marginBottom: 6, fontSize: 14 }}>{line}</Paragraph>);
      }
    }
  }
  return <>{elements}</>;
};

export const HelpPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({});
  const [aiQuery, setAiQuery] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['help-categories'],
    queryFn: helpApi.listCategories,
  });

  const { data: articles, isLoading: artLoading } = useQuery({
    queryKey: ['help-articles', selectedCategory, search],
    queryFn: () => helpApi.listArticles(selectedCategory, search || undefined),
  });

  const { data: article, isLoading: articleLoading } = useQuery({
    queryKey: ['help-article', selectedArticle],
    queryFn: () => helpApi.getArticle(selectedArticle!),
    enabled: !!selectedArticle,
  });

  const feedbackMut = useMutation({
    mutationFn: ({ slug, helpful }: { slug: string; helpful: boolean }) => helpApi.markHelpful(slug, helpful),
    onSuccess: (_, vars) => {
      setFeedbackGiven(prev => ({ ...prev, [vars.slug]: true }));
      antMessage.success(vars.helpful ? 'Thanks for your feedback!' : 'Thanks — we\'ll improve this article.');
    },
  });

  const handleAiSearch = () => {
    if (!aiQuery.trim()) return;
    setSearch(aiQuery.trim());
    setAiQuery('');
    setSelectedCategory(undefined);
    setSelectedArticle(null);
  };

  /* ── Article detail view ── */
  if (selectedArticle && (article || articleLoading)) {
    const categoryName = categories?.find(c => c.slug === article?.category?.slug)?.name ?? article?.category?.name;
    return (
      <div style={{ padding: '24px 32px', maxWidth: 860, margin: '0 auto' }}>
        <Breadcrumb
          style={{ marginBottom: 20 }}
          items={[
            { title: <span style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => setSelectedArticle(null)}>Help Center</span> },
            { title: categoryName },
            { title: article?.title },
          ]}
        />
        <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedArticle(null)} style={{ marginBottom: 20 }}>
          Back to articles
        </Button>
        <Card style={{ borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {articleLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : article ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <Tag color={CATEGORY_COLORS[article.category?.slug] ?? 'blue'}>{categoryName}</Tag>
                {article.tags?.map((t: string) => <Tag key={t}>{t}</Tag>)}
              </div>
              <Title level={3} style={{ marginBottom: 20 }}>{article.title}</Title>
              <Divider />
              <div style={{ lineHeight: 1.8 }}>{renderMarkdown(article.content)}</div>
              <Divider />
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                {feedbackGiven[article.slug] ? (
                  <Text type="secondary">Thanks for your feedback!</Text>
                ) : (
                  <Space>
                    <Text type="secondary">Was this article helpful?</Text>
                    <Button icon={<LikeOutlined />} size="small" onClick={() => feedbackMut.mutate({ slug: article.slug, helpful: true })}>
                      Yes ({article.helpful})
                    </Button>
                    <Button icon={<DislikeOutlined />} size="small" onClick={() => feedbackMut.mutate({ slug: article.slug, helpful: false })}>
                      No ({article.notHelpful})
                    </Button>
                  </Space>
                )}
              </div>
            </>
          ) : null}
        </Card>
      </div>
    );
  }

  /* ── Main Help Center ── */
  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>

      {/* ── Hero ── */}
      <div style={{ padding: '56px 48px 48px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.2, marginBottom: 32, fontFamily: 'Georgia, serif' }}>
            Need help?
            <div style={{ width: 120, height: 4, background: 'linear-gradient(90deg, #13c2c2, #1677ff)', borderRadius: 2, marginTop: 6 }} />
          </div>

          {/* Search + Submit row */}
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <div style={{ position: 'relative' }}>
                <Input
                  size="large"
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onPressEnter={handleAiSearch}
                  placeholder="Search for help articles…"
                  style={{
                    borderRadius: 10,
                    border: '1.5px solid #d9d9d9',
                    fontSize: 15,
                    paddingRight: 44,
                    height: 50,
                  }}
                  suffix={
                    <Button
                      type="text"
                      icon={<SendOutlined style={{ color: '#8c8c8c' }} />}
                      onClick={handleAiSearch}
                      style={{ padding: 0 }}
                    />
                  }
                />
              </div>
            </Col>
            <Col>
              <Text type="secondary" style={{ fontSize: 15, padding: '0 8px' }}>or</Text>
            </Col>
            <Col>
              <Button
                size="large"
                onClick={() => navigate('/support')}
                style={{
                  height: 50,
                  paddingInline: 28,
                  borderRadius: 10,
                  background: '#7d6a94',
                  borderColor: '#7d6a94',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                Submit a Ticket
              </Button>
            </Col>
          </Row>
        </div>

        {/* Category pills */}
        {!search && (
          <Space wrap size={8} style={{ marginBottom: 24 }}>
            <Button
              shape="round"
              type={!selectedCategory ? 'primary' : 'default'}
              onClick={() => { setSelectedCategory(undefined); setSelectedArticle(null); }}
              size="small"
            >
              All topics
            </Button>
            {(categories ?? []).map((cat: FaqCategory) => (
              <Button
                key={cat.slug}
                shape="round"
                size="small"
                type={selectedCategory === cat.slug ? 'primary' : 'default'}
                onClick={() => { setSelectedCategory(cat.slug === selectedCategory ? undefined : cat.slug); setSelectedArticle(null); }}
                style={selectedCategory !== cat.slug ? { borderColor: CATEGORY_COLORS[cat.slug] ?? '#d9d9d9', color: CATEGORY_COLORS[cat.slug] ?? '#333' } : {}}
              >
                {cat.icon && <span style={{ marginRight: 4 }}>{cat.icon}</span>}
                {cat.name}
              </Button>
            ))}
          </Space>
        )}

        {/* Search results tag */}
        {search && (
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text type="secondary">Showing results for:</Text>
              <Tag closable onClose={() => setSearch('')}>{search}</Tag>
            </Space>
          </div>
        )}

        {/* Articles */}
        {artLoading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
        {!artLoading && (articles ?? []).length === 0 && (
          <Empty description={search ? `No articles found for "${search}"` : 'No articles in this category'} style={{ padding: '40px 0' }} />
        )}

        {/* Category cards when browsing (no search, no filter) */}
        {!search && !selectedCategory && !artLoading && (categories ?? []).length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 48 }}>
            {(categories ?? []).map((cat: FaqCategory) => (
              <Col xs={24} sm={12} md={8} key={cat.id}>
                <Card
                  hoverable
                  onClick={() => setSelectedCategory(cat.slug)}
                  style={{
                    borderRadius: 14,
                    cursor: 'pointer',
                    border: `1.5px solid ${CATEGORY_COLORS[cat.slug] ?? '#e8e8e8'}20`,
                    background: CATEGORY_BG[cat.slug] ?? '#f8f9fa',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{cat.icon ?? '📄'}</div>
                  <Title level={5} style={{ margin: 0, color: CATEGORY_COLORS[cat.slug] ?? '#333' }}>{cat.name}</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {cat._count?.articles ?? 0} article{(cat._count?.articles ?? 0) !== 1 ? 's' : ''}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Article list (filtered or searched) */}
        {(search || selectedCategory) && !artLoading && (
          <div style={{ marginBottom: 48 }}>
            {(articles ?? []).map((art: FaqArticle) => (
              <div
                key={art.id}
                onClick={() => setSelectedArticle(art.slug)}
                style={{
                  padding: '16px 20px',
                  borderRadius: 10,
                  border: '1px solid #f0f0f0',
                  marginBottom: 10,
                  cursor: 'pointer',
                  background: '#fafafa',
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <Row justify="space-between" align="middle">
                  <Col flex="auto">
                    <div style={{ marginBottom: 4 }}>
                      <Tag color={CATEGORY_COLORS[art.category?.slug] ?? 'blue'} style={{ fontSize: 11 }}>{art.category?.name}</Tag>
                    </div>
                    <Text strong style={{ fontSize: 14 }}>{art.title}</Text>
                    <div style={{ marginTop: 4 }}>
                      {art.tags?.map((t: string) => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
                    </div>
                  </Col>
                  <Col>
                    <Space size={4}>
                      <LikeOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>{art.helpful}</Text>
                    </Space>
                  </Col>
                </Row>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Contact Us ── */}
      <div style={{ background: '#f7f7f9', padding: '48px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#1a1a2e', fontFamily: 'Georgia, serif' }}>
              Contact us
              <div style={{ width: 80, height: 4, background: 'linear-gradient(90deg, #faad14, #fa8c16)', borderRadius: 2, marginTop: 6 }} />
            </div>
          </div>
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={8}>
              <Card
                style={{ borderRadius: 14, textAlign: 'center', border: '1px solid #e8e8e8', cursor: 'pointer' }}
                hoverable
                onClick={() => navigate('/support')}
              >
                <CustomerServiceOutlined style={{ fontSize: 32, color: '#1677ff', marginBottom: 12 }} />
                <Title level={5}>Submit a Ticket</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Open a support request and we'll get back to you within 1 business day.
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card
                style={{ borderRadius: 14, textAlign: 'center', border: '1px solid #e8e8e8' }}
                hoverable
              >
                <MailOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 12 }} />
                <Title level={5}>Email Support</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Reach us at <strong>support@nexus-erp.co.ke</strong><br />
                  Mon–Fri, 8 am – 6 pm EAT
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card
                style={{ borderRadius: 14, textAlign: 'center', border: '1px solid #e8e8e8' }}
                hoverable
              >
                <MessageOutlined style={{ fontSize: 32, color: '#13c2c2', marginBottom: 12 }} />
                <Title level={5}>WhatsApp / Chat</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Chat with us on WhatsApp<br />
                  <strong>+254 700 000 000</strong>
                </Text>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
