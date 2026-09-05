import React from 'react';
import { Card, Col, Image, Input, Row, Space, Typography, Upload, Button, Alert } from 'antd';
import { BankOutlined, EnvironmentOutlined, IdcardOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useOutletContext } from 'react-router-dom';
import type { SettingsOutletContext } from './SettingsPage';

const { Title, Text } = Typography;

/** Resize + compress an image file to a JPEG data-URL ≤ maxKB. */
function compressImage(file: File, maxWidth = 400, maxKB = 120): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      // Try quality levels until under maxKB
      let quality = 0.85;
      let data = canvas.toDataURL('image/jpeg', quality);
      while (data.length / 1024 > maxKB && quality > 0.2) {
        quality -= 0.1;
        data = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

export const CompaniesSettingsPage: React.FC = () => {
  const { draft, updateDraft } = useOutletContext<SettingsOutletContext>();
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const [logoLoading, setLogoLoading] = React.useState(false);

  if (!draft) {
    return null;
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <Title level={4} style={{ margin: 0 }}>Companies</Title>
        <Text type="secondary">Manage the business identity used across invoices, receipts, and settings.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card bordered={false} style={{ borderRadius: 22 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text type="secondary">Company Name</Text>
                <Input
                  value={draft.companyName}
                  onChange={(event) => updateDraft({ companyName: event.target.value })}
                  size="large"
                  style={{ marginTop: 8 }}
                />
              </div>

              <div>
                <Text type="secondary">KRA PIN / Business PIN</Text>
                <Input
                  value={draft.companyPin || ''}
                  onChange={(event) => updateDraft({ companyPin: event.target.value })}
                  size="large"
                  style={{ marginTop: 8 }}
                />
              </div>

              <div>
                <Text type="secondary">Business Address</Text>
                <Input.TextArea
                  value={draft.companyAddress || ''}
                  onChange={(event) => updateDraft({ companyAddress: event.target.value })}
                  rows={3}
                  style={{ marginTop: 8 }}
                />
              </div>

              <div>
                <Text type="secondary">Receipt Slogan</Text>
                <Input.TextArea
                  value={draft.receiptSlogan || ''}
                  onChange={(event) => updateDraft({ receiptSlogan: event.target.value })}
                  rows={2}
                  style={{ marginTop: 8 }}
                />
              </div>

              <div>
                <Text type="secondary">Company Logo</Text>
                <div style={{ marginTop: 8 }}>
                  {logoError && (
                    <Alert
                      type="error"
                      showIcon
                      message="Logo upload failed"
                      description={logoError}
                      closable
                      onClose={() => setLogoError(null)}
                      style={{ marginBottom: 10 }}
                    />
                  )}
                  {draft.companyLogo ? (
                    <Space direction="vertical" size={8}>
                      <Image
                        src={draft.companyLogo}
                        alt="Company Logo"
                        style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain', borderRadius: 6, border: '1px solid #f0f0f0', padding: 4 }}
                        preview={false}
                      />
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => { updateDraft({ companyLogo: null }); setLogoError(null); }}
                      >
                        Remove logo
                      </Button>
                    </Space>
                  ) : (
                    <Upload
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      showUploadList={false}
                      disabled={logoLoading}
                      beforeUpload={(file) => {
                        const isLt2M = file.size / 1024 / 1024 < 2;
                        if (!isLt2M) {
                          setLogoError('File is too large. Maximum file size is 2 MB.');
                          return Upload.LIST_IGNORE;
                        }
                        setLogoError(null);
                        setLogoLoading(true);
                        compressImage(file)
                          .then((dataUrl) => {
                            updateDraft({ companyLogo: dataUrl });
                          })
                          .catch((err: unknown) => {
                            const msg = err instanceof Error ? err.message : 'Unknown error';
                            setLogoError(`Could not process image: ${msg}`);
                          })
                          .finally(() => setLogoLoading(false));
                        return false;
                      }}
                    >
                      <Button icon={<UploadOutlined />} loading={logoLoading}>
                        {logoLoading ? 'Processing…' : 'Upload logo (PNG / JPG / WebP, max 2 MB)'}
                      </Button>
                    </Upload>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Logo is auto-compressed and displayed at the top of printed POS receipts instead of the company name.
                    </Text>
                  </div>
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card bordered={false} style={{ borderRadius: 22 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Title level={5} style={{ margin: 0 }}>Receipt Identity Preview</Title>

              {draft.companyLogo && (
                <div style={{ textAlign: 'center' }}>
                  <Image
                    src={draft.companyLogo}
                    alt="Logo preview"
                    style={{ maxHeight: 60, maxWidth: 160, objectFit: 'contain' }}
                    preview={false}
                  />
                  <div><Text type="secondary" style={{ fontSize: 11 }}>Will appear at top of printed receipt</Text></div>
                </div>
              )}

              <Space align="start">
                <BankOutlined style={{ fontSize: 18, color: '#6f67ff', marginTop: 4 }} />
                <div>
                  <Text strong>{draft.companyName}</Text>
                  <div><Text type="secondary">Legal / trading name</Text></div>
                </div>
              </Space>

              <Space align="start">
                <IdcardOutlined style={{ fontSize: 18, color: '#1db8a0', marginTop: 4 }} />
                <div>
                  <Text strong>{draft.companyPin || 'No company PIN set'}</Text>
                  <div><Text type="secondary">Used on POS receipts and invoices</Text></div>
                </div>
              </Space>

              <Space align="start">
                <EnvironmentOutlined style={{ fontSize: 18, color: '#d48806', marginTop: 4 }} />
                <div>
                  <Text strong>{draft.companyAddress || 'No company address set'}</Text>
                  <div><Text type="secondary">Printed on branded receipts</Text></div>
                </div>
              </Space>

              <Card size="small" style={{ borderRadius: 16, background: '#faf7ff' }}>
                <Text type="secondary">Receipt slogan preview</Text>
                <div style={{ marginTop: 8 }}>
                  <Text italic>{draft.receiptSlogan || 'No slogan configured'}</Text>
                </div>
              </Card>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};
