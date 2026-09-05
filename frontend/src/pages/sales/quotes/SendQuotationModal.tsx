import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Space, Typography, message, Alert } from 'antd';
import { MailOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { salesApi } from '../../../api/sales.api';

const { TextArea } = Input;
const { Text } = Typography;

interface Props {
  open: boolean;
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  customerEmail?: string;
  onClose: () => void;
  onSent: () => void;
}

export function SendQuotationModal({
  open,
  quoteId,
  quoteNumber,
  customerName,
  customerEmail,
  onClose,
  onSent,
}: Props) {
  const [form] = Form.useForm();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Pre-fill form whenever the modal opens
  useEffect(() => {
    if (open) {
      setPreviewUrl(null);
      form.setFieldsValue({
        to: customerEmail ?? '',
        subject: `Quotation ${quoteNumber} from Nexora ERP`,
        body: `Dear ${customerName},\n\nPlease find attached your quotation ${quoteNumber}.\n\nKindly review and let us know if you have any questions.\n\nBest regards,\nNexora ERP`,
      });
    }
  }, [open, customerEmail, customerName, quoteNumber, form]);

  const sendMutation = useMutation({
    mutationFn: (values: { to: string; subject: string; body: string }) =>
      salesApi.sendQuoteByEmail(quoteId, values),
    onSuccess: (res) => {
      if (res.preview) {
        setPreviewUrl(res.preview);
        message.success('Email sent (dev mode — see preview link below)');
      } else {
        message.success('Quotation emailed successfully');
        onSent();
        onClose();
        form.resetFields();
      }
    },
    onError: (e: unknown) => {
      const ae = e as AxiosError<{ message?: string }>;
      message.error(ae.response?.data?.message ?? 'Failed to send email');
    },
  });

  const handleOk = () => {
    form.validateFields().then((values) => sendMutation.mutate(values));
  };

  return (
    <Modal
      title={
        <Space>
          <MailOutlined style={{ color: '#1976d2' }} />
          Send Quotation by Email
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={640}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          {/* WhatsApp — coming soon */}
          <Button
            icon={<WhatsAppOutlined />}
            disabled
            title="WhatsApp sending — coming soon"
            style={{ color: '#25D366', borderColor: '#25D366' }}
          >
            Send via WhatsApp
          </Button>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              icon={<MailOutlined />}
              loading={sendMutation.isPending}
              onClick={handleOk}
            >
              Send Email
            </Button>
          </Space>
        </Space>
      }
    >
      {previewUrl ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Alert
            type="info"
            message="Development Mode — Email Preview"
            description={
              <>
                <Text>No SMTP server is configured. The email was captured by Ethereal for preview.</Text>
                <br />
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  Open email preview ↗
                </a>
              </>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" onClick={() => { onSent(); onClose(); form.resetFields(); }}>
            Close
          </Button>
        </div>
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item
            label="To"
            name="to"
            rules={[
              { required: true, message: 'Recipient email is required' },
              { type: 'email', message: 'Enter a valid email address' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="customer@example.com" />
          </Form.Item>
          <Form.Item
            label="Subject"
            name="subject"
            rules={[{ required: true, message: 'Subject is required' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Message"
            name="body"
            rules={[{ required: true, message: 'Message body is required' }]}
          >
            <TextArea rows={8} showCount maxLength={2000} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
