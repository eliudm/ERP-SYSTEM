import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spin, Result } from 'antd';
import { pluginsApi } from '../../api/plugins.api';

export const PluginEmbedPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: plugin, isLoading, isError } = useQuery({
    queryKey: ['plugins', id],
    queryFn: () => pluginsApi.getPlugin(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (isError || !plugin?.pageUrl) {
    return <Result status="404" title="Plugin not found" subTitle="This plugin does not exist or has no page URL." />;
  }

  if (plugin.status !== 'ACTIVE') {
    return <Result status="warning" title="Plugin inactive" subTitle="This plugin is currently disabled. Enable it in Settings → Plugins." />;
  }

  return (
    <div style={{ height: 'calc(100vh - 112px)', margin: '-24px' }}>
      <iframe
        src={plugin.pageUrl}
        title={plugin.pageLabel ?? plugin.name}
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};
